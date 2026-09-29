import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Estados de diseño en la línea del pedido (en_diseno → diseno_listo → esperando_aprobacion →
// en_preparacion → listo_para_retirar | listo_para_enviar → enviado → entregado), rótulos con
// tilde, select del pedido agrupado y sin los estados de cobro, y confirmación que solo pregunta
// si el ESTADO cambió. Backend simulado.

const base = { metodo_pago: 'mercadopago', creado_en: new Date().toISOString(), items_orden: [], usuarios: { nombre: 'Ana', apellido: 'Gómez' }, direccion_envio: {} };
const paga = (monto: number) => [{ id: 'p-' + monto, estado: 'aprobado', monto }];

const web = (id: string, estado: string, extra: Record<string, unknown> = {}) => ({
  ...base, id, canal: 'web', estado, total: 9000, estado_pago: 'pagado', monto_cobrado: 9000, saldo: 0, pagos: paga(9000), ...extra,
});
const manual = (id: string, estado: string, extra: Record<string, unknown> = {}) => ({
  ...base, id, canal: 'admin_manual', metodo_pago: 'efectivo', estado, total: 10000, estado_pago: 'parcial', monto_cobrado: 4000, saldo: 6000, pagos: paga(4000), usuarios: null, ...extra,
});

const fila = (page: Page, id: string) => page.locator('tr', { hasText: `#${id.slice(0, 8).toUpperCase()}` });
const selectEstado = (page: Page) => page.locator('select').filter({ has: page.locator('optgroup') });

async function abrir(page: Page, ordenes: unknown[]) {
  await loginComoAdmin(page);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: ordenes, total: ordenes.length, page: 1, totalPages: 1 } }));
  await page.goto('/admin/ordenes');
}

function capturarPut(page: Page, id: string) {
  const cap: { body: Record<string, any> | null } = { body: null };
  return page
    .route(`**/api/v1/ordenes/${id}`, (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      cap.body = route.request().postDataJSON();
      route.fulfill({ json: { id } });
    })
    .then(() => cap);
}

function recordarDialogos(page: Page) {
  const mensajes: string[] = [];
  page.on('dialog', (d) => {
    mensajes.push(d.message());
    void d.accept();
  });
  return mensajes;
}

test.describe('Admin — Órdenes — estados de diseño en la lista', () => {
  test('cada estado nuevo se ve con su rótulo (con tilde), sin dejar la clave cruda', async ({ page }) => {
    await abrir(page, [
      web('aaaaaaaa-1', 'en_diseno'),
      web('bbbbbbbb-2', 'diseno_listo'),
      web('cccccccc-3', 'esperando_aprobacion'),
      web('dddddddd-4', 'listo_para_enviar'),
    ]);

    await expect(fila(page, 'aaaaaaaa-1')).toContainText('En diseño');
    await expect(fila(page, 'bbbbbbbb-2')).toContainText('Diseño listo');
    await expect(fila(page, 'cccccccc-3')).toContainText('Esperando OK del cliente');
    await expect(fila(page, 'dddddddd-4')).toContainText('Listo para enviar');
    await expect(page.locator('tbody')).not.toContainText('en_diseno');
    await expect(page.locator('tbody')).not.toContainText('en diseno');
  });

  test('en diseño con solo la seña: el cobro sigue "pago parcial" y el pedido "En diseño"', async ({ page }) => {
    await abrir(page, [manual('eeeeeeee-5', 'en_diseno')]);
    const f = fila(page, 'eeeeeeee-5');
    await expect(f.getByTestId('badge-pago')).toHaveText('pago parcial');
    await expect(f).toContainText('En diseño');
    await expect(f).toContainText('saldo $6.000');
  });

  test('esperando OK del cliente es ámbar (esperar a alguien de afuera) y en diseño es azul', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'en_diseno'), web('cccccccc-3', 'esperando_aprobacion')]);
    await expect(fila(page, 'aaaaaaaa-1').getByText('En diseño')).toHaveClass(/bg-blue-100/);
    await expect(fila(page, 'cccccccc-3').getByText('Esperando OK del cliente')).toHaveClass(/bg-amber-100/);
  });

  test('el filtro por estado ofrece los nuevos con rótulo, y manda el valor interno', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'en_diseno')]);
    const filtro = page.locator('select').filter({ has: page.locator('option', { hasText: 'Todos los estados' }) });
    await expect(filtro.locator('option', { hasText: 'Esperando OK del cliente' })).toHaveCount(1);
    await expect(filtro.locator('option', { hasText: 'Listo para enviar' })).toHaveCount(1);
    await filtro.selectOption('en_diseno');
    await expect(filtro).toHaveValue('en_diseno');
  });
});

test.describe('Admin — Órdenes — cambiar el estado del pedido', () => {
  test('el select está agrupado (Diseño / Producción / Entrega / Cerrar) y no ofrece estados de cobro', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'pagado')]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();

    const select = selectEstado(page);
    const grupos = await select.locator('optgroup').evaluateAll((gs) => gs.map((g) => (g as HTMLOptGroupElement).label));
    expect(grupos).toEqual(['Diseño', 'Producción', 'Entrega', 'Cerrar']);
    const opciones = await select.locator('option').allTextContents();
    expect(opciones).toEqual([
      'En diseño', 'Diseño listo', 'Esperando OK del cliente',
      'Sin empezar (pagado)', 'En preparación',
      'Listo para retirar', 'Listo para enviar', 'Enviado', 'Entregado',
      'Cancelado',
    ]);
  });

  test('un estado de espera de pago (reservado) se ve como "(actual)" para no dejar el select en blanco', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'reservado', { estado_pago: 'pendiente', monto_cobrado: 0, saldo: 9000, pagos: [] })]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    const select = selectEstado(page);
    await expect(select).toHaveValue('reservado');
    await expect(select.locator('option').first()).toHaveText('Reservado (actual)');
  });

  test('pasar a "En diseño" manda el estado nuevo al backend', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'pagado')]);
    const put = await capturarPut(page, 'aaaaaaaa-1');
    const dialogos = recordarDialogos(page);

    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await selectEstado(page).selectOption('en_diseno');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => put.body).not.toBeNull();
    expect(put.body!.estado).toBe('en_diseno');
    expect(dialogos).toHaveLength(1);
    expect(dialogos[0]).toContain('"En diseño"');
  });

  test('guardar solo notas o seguimiento NO pregunta nada (el estado no cambió)', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'en_diseno')]);
    const put = await capturarPut(page, 'aaaaaaaa-1');
    const dialogos = recordarDialogos(page);

    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await page.getByPlaceholder('Ej: CA123456789AR').fill('CA123456789AR');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => put.body).not.toBeNull();
    expect(put.body).toMatchObject({ estado: 'en_diseno', numero_seguimiento: 'CA123456789AR' });
    expect(dialogos).toHaveLength(0);
  });

  test('orden web: avisa que el cliente lo ve y que "Enviado" manda un mail', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'en_preparacion')]);
    await capturarPut(page, 'aaaaaaaa-1');
    const dialogos = recordarDialogos(page);

    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await selectEstado(page).selectOption('enviado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => dialogos.length).toBe(1);
    expect(dialogos[0]).toContain('"Enviado"');
    expect(dialogos[0]).toContain('El cliente puede ver este estado desde su cuenta');
    expect(dialogos[0]).toContain('mail');
  });

  test('venta manual: NO dice que el cliente lo ve (no tiene cuenta) ni promete un mail', async ({ page }) => {
    await abrir(page, [manual('eeeeeeee-5', 'en_preparacion')]);
    await capturarPut(page, 'eeeeeeee-5');
    const dialogos = recordarDialogos(page);

    await fila(page, 'eeeeeeee-5').getByRole('button', { name: 'Gestionar' }).click();
    await selectEstado(page).selectOption('enviado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => dialogos.length).toBe(1);
    expect(dialogos[0]).toContain('"Enviado"');
    expect(dialogos[0]).not.toContain('cliente puede ver');
    expect(dialogos[0]).not.toContain('mail');
  });

  test('editar los productos de una venta manual: se puede en diseño, no con el paquete armado (listo para enviar)', async ({ page }) => {
    await abrir(page, [
      manual('eeeeeeee-5', 'en_diseno', { metodo_envio_id: null, metodos_envio: null, envios_orden: [], es_prueba: false }),
      manual('ffffffff-6', 'listo_para_enviar', { metodo_envio_id: null, metodos_envio: null, envios_orden: [], es_prueba: false }),
    ]);

    await fila(page, 'eeeeeeee-5').getByRole('button', { name: 'Gestionar' }).click();
    await expect(page.getByRole('button', { name: '+ Agregar producto' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    await fila(page, 'ffffffff-6').getByRole('button', { name: 'Gestionar' }).click();
    await expect(page.getByRole('button', { name: '+ Agregar producto' })).toHaveCount(0);
    await expect(page.getByText('Ya está lista para enviar')).toBeVisible();
  });

  test('cancelar una orden web en diseño pide decidir el stock (ya estaba paga)', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'en_diseno', { items_orden: [{ id: 'i1', producto_id: 'p1', nombre_producto: 'Mate', cantidad: 1, stock_origen: 'producto' }] })]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await selectEstado(page).selectOption('cancelado');
    await expect(page.getByText('Devolver el producto al stock')).toBeVisible();
  });
});

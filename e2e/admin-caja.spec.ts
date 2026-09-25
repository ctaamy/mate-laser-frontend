import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { hoyART, mockCaja, mov } from './fixtures-caja';

// "Caja y compras" (Fase 1): hub con pestañas Resumen y Movimientos, hojas para
// cargar gasto / ingreso / pasar plata / contar la caja, y paso inicial de
// cuentas. El backend está simulado (ver fixtures-caja.ts).

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const hoja = (page: import('@playwright/test').Page, nombre: string) => page.getByRole('dialog', { name: nombre });

test.describe('Caja — acceso desde el admin', () => {
  test('el Dashboard tiene UNA tarjeta "Caja y compras" que abre el hub, y ya no está "Pagos y transacciones"', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.route('**/api/v1/ordenes/estadisticas', (r) => r.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }));
    await page.route('**/api/v1/ordenes?**', (r) => r.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (r) => r.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByText('Pagos y transacciones')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Caja y compras/ })).toHaveCount(1);
    await page.getByRole('link', { name: /Caja y compras/ }).click();

    await expect(page).toHaveURL(/\/admin\/caja$/);
    await expect(page.getByRole('heading', { name: 'Caja y compras' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Movimientos' })).toBeVisible();
  });
});

test.describe('Caja — paso inicial', () => {
  test('sin cuentas pide "¿Cuánta plata tenés hoy?", precarga los socios con los admins y arma el setup', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { configurada: false });

    await page.goto('/admin/caja');

    await expect(page.getByRole('heading', { name: '¿Cuánta plata tenés hoy en cada cuenta?' })).toBeVisible();
    await expect(page.getByTestId('setup-socios').getByText('Tami')).toBeVisible();
    await expect(page.getByTestId('setup-socios').getByText('Facu')).toBeVisible();
    // Sin cuentas no se ofrece cargar nada todavía.
    await expect(page.getByRole('button', { name: 'Gasto' })).toHaveCount(0);

    const cuentas = page.getByTestId('setup-cuenta');
    await cuentas.nth(0).getByLabel('Hay ahora').fill('5.000');
    await cuentas.nth(1).getByLabel('Hay ahora').fill('1.500,50');
    await page.getByRole('button', { name: 'Empezar' }).click();

    await expect.poll(() => cap.setups.length).toBe(1);
    expect(cap.setups[0]).toEqual({
      fecha_inicio: hoyART(),
      cuentas: [
        { nombre: 'Efectivo', tipo: 'efectivo', saldo_inicial: 5000 },
        { nombre: 'Banco', tipo: 'banco', saldo_inicial: 1500.5 },
        { nombre: 'Mercado Pago', tipo: 'mercadopago', saldo_inicial: 0 },
      ],
      socios: ['Tami', 'Facu'],
    });
    await expect(page.getByTestId('total-negocio')).toBeVisible();
  });
});

test.describe('Caja — Resumen', () => {
  test('muestra la plata disponible SIN el bolsillo, las cuentas por titular y lo que se le debe a Facu', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);

    await page.goto('/admin/caja');

    // 98.500 + 20.000 + 3.000 + 5.000: el bolsillo de Facu (−12.000) no es plata del negocio.
    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    await expect(page.getByTestId('socios')).toContainText('Le debemos a Facu');
    await expect(page.getByTestId('socios')).toContainText('$12.000');

    const grupos = page.getByTestId('grupo-titular');
    await expect(grupos).toHaveCount(3);
    // Un titular con una sola cuenta es una fila; con dos, un grupo con subtotal.
    await expect(grupos.filter({ hasText: 'Banco Tami' })).toContainText('$98.500');
    await expect(grupos.filter({ hasText: 'Efectivo' })).toContainText('$5.000');
    const facu = grupos.filter({ hasText: 'Mercado Pago (Facu)' });
    await expect(facu).toContainText('$23.000');
    await expect(facu).toContainText('Banco Facu');
    // "Banco Tami" ya dice el banco y el titular: no se repite abajo.
    await expect(grupos.filter({ hasText: 'Banco Tami' })).not.toContainText('a nombre de');
  });

  test('un error del backend no deja la pantalla en blanco', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/caja/**', (r) => r.fulfill({ status: 500, json: { message: 'boom' } }));
    await page.goto('/admin/caja');
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar la caja');
  });
});

test.describe('Caja — cargar un gasto', () => {
  test('el acceso directo ?nuevo=gasto abre la hoja; el monto se entiende en es-AR y se confirma con una frase', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);

    await page.goto('/admin/caja?nuevo=gasto');

    const h = hoja(page, 'Nuevo gasto');
    await expect(h).toBeVisible();
    const monto = h.getByLabel('Monto');
    await expect(monto).toHaveAttribute('inputmode', 'decimal');

    const guardar = h.getByRole('button', { name: 'Guardar', exact: true });
    await expect(guardar).toBeDisabled();

    await monto.fill('1.500,50');
    await expect(h.getByText(/\$\s1\.500,50/)).toBeVisible(); // eco en vivo
    await expect(guardar).toBeDisabled(); // falta categoría y cuenta
    await h.getByRole('radio', { name: 'Insumos' }).click();
    await h.getByRole('radio', { name: 'Efectivo' }).click();

    await expect(h.getByText('Vas a anotar que salieron $1.500,50 de Efectivo.')).toBeVisible();
    await guardar.click();

    await expect.poll(() => cap.movimientos.length).toBe(1);
    expect(cap.movimientos[0]).toMatchObject({ tipo: 'gasto', cuenta_id: 'c-efectivo', monto: 1500.5, categoria: 'insumos' });
    expect(cap.movimientos[0].clave_cliente).toMatch(UUID_V4);
    await expect(h).toHaveCount(0);
    await expect(page).not.toHaveURL(/nuevo=/);
    await expect(page.getByRole('status')).toContainText('Gasto anotado: $1.500,50');
  });

  test('un monto que no se entiende se marca y no se puede guardar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');
    await h.getByLabel('Monto').fill('mil quinientos');
    await expect(h.getByText('No entiendo ese monto')).toBeVisible();
    await h.getByRole('radio', { name: 'Insumos' }).click();
    await h.getByRole('radio', { name: 'Efectivo' }).click();
    await expect(h.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  });

  test('"1.500" es mil quinientos, no uno con cinco', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');
    await h.getByLabel('Monto').fill('1.500');
    await h.getByRole('radio', { name: 'Servicios' }).click();
    await h.getByRole('radio', { name: 'Banco Tami' }).click();
    await h.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => cap.movimientos.length).toBe(1);
    expect(cap.movimientos[0].monto).toBe(1500);
  });

  test('si el guardado falla, reintentar manda la MISMA clave: no se duplica el gasto', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { estadosPostMovimiento: [500, 201] });
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');
    await h.getByLabel('Monto').fill('800');
    await h.getByRole('radio', { name: 'Envíos' }).click();
    await h.getByRole('radio', { name: 'Efectivo' }).click();

    await h.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(h.getByRole('alert')).toContainText('Error de prueba');
    await expect(h).toBeVisible(); // no se perdió lo tipeado

    await h.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => cap.movimientos.length).toBe(2);
    expect(cap.movimientos[1].clave_cliente).toBe(cap.movimientos[0].clave_cliente);
    await expect(h).toHaveCount(0);
  });

  test('"Guardar y cargar otro" deja la hoja abierta, la vacía y usa una clave nueva', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');

    await h.getByLabel('Monto').fill('1500');
    await h.getByRole('radio', { name: 'Insumos' }).click();
    await h.getByRole('radio', { name: 'Efectivo' }).click();
    await h.getByRole('button', { name: 'Guardar y cargar otro' }).click();

    await expect.poll(() => cap.movimientos.length).toBe(1);
    await expect(h).toBeVisible();
    await expect(h.getByLabel('Monto')).toHaveValue('');
    await expect(h.getByRole('status')).toContainText('Gasto anotado: $1.500');
    // La cuenta se conserva (es lo que suele repetirse); la categoría no.
    await expect(h.getByRole('radio', { name: 'Efectivo' })).toHaveAttribute('aria-checked', 'true');
    await expect(h.getByRole('radio', { name: 'Insumos' })).toHaveAttribute('aria-checked', 'false');

    await h.getByLabel('Monto').fill('300');
    await h.getByRole('radio', { name: 'Publicidad' }).click();
    await h.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => cap.movimientos.length).toBe(2);
    expect(cap.movimientos[1].clave_cliente).not.toBe(cap.movimientos[0].clave_cliente);
  });

  test('cerrar con datos sin guardar pide confirmación', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');
    await h.getByLabel('Monto').fill('999');

    page.once('dialog', (d) => { expect(d.message()).toContain('cambios sin guardar'); void d.dismiss(); });
    await h.getByRole('button', { name: 'Cerrar' }).click();
    await expect(h).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await h.getByRole('button', { name: 'Cerrar' }).click();
    await expect(h).toHaveCount(0);
  });

  test('desde un bolsillo pregunta "¿Se lo devolvemos?" y sin responder no se puede guardar', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const h = hoja(page, 'Nuevo gasto');
    const guardar = h.getByRole('button', { name: 'Guardar', exact: true });

    await h.getByLabel('Monto').fill('3.000');
    await h.getByRole('radio', { name: 'Retiro mío' }).click();
    await h.getByRole('radio', { name: 'Bolsillo de Facu' }).click();
    // "Retiro mío" sale de una cuenta del negocio, no de un bolsillo.
    await expect(h.getByRole('radio', { name: 'Retiro mío' })).toHaveCount(0);
    await h.getByRole('radio', { name: 'Insumos' }).click();

    await expect(h.getByRole('radiogroup', { name: '¿Se lo devolvemos a Facu?' })).toBeVisible();
    await expect(guardar).toBeDisabled();

    await h.getByRole('radio', { name: 'No, es un aporte' }).click();
    await expect(h.getByText('Vas a anotar que Facu puso $3.000 de su bolsillo como aporte, sin devolver.')).toBeVisible();
    await guardar.click();

    await expect.poll(() => cap.movimientos.length).toBe(1);
    expect(cap.movimientos[0]).toMatchObject({ cuenta_id: 'c-bolsillo-facu', devolver: false });
  });
});

test.describe('Caja — ingreso', () => {
  test('no ofrece bolsillos y avisa que las ventas entran solas', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=ingreso');
    const h = hoja(page, 'Nuevo ingreso');

    await expect(h.getByText('Las ventas de la tienda y de Mercado Pago entran solas')).toBeVisible();
    await expect(h.getByRole('radio', { name: 'Bolsillo de Facu' })).toHaveCount(0);
    await expect(h.getByRole('radio', { name: 'Ventas' })).toHaveCount(0);

    await h.getByLabel('Monto').fill('50000');
    await h.getByRole('radio', { name: 'Aporte de socio' }).click();
    await h.getByRole('radio', { name: 'Banco Tami' }).click();
    await expect(h.getByText('Vas a anotar que entraron $50.000 en Banco Tami.')).toBeVisible();
    await h.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect.poll(() => cap.movimientos.length).toBe(1);
    expect(cap.movimientos[0]).toMatchObject({ tipo: 'ingreso', categoria: 'aporte_socio', monto: 50000 });
  });
});

test.describe('Caja — pasar plata entre cuentas', () => {
  test('manda origen, destino y monto con una clave, y no deja elegir la misma cuenta dos veces', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=transferencia');
    const h = hoja(page, 'Pasar plata entre cuentas');

    await h.getByLabel('Monto').fill('20.000');
    await h.getByRole('radiogroup', { name: 'Sale de' }).getByRole('radio', { name: 'Banco Tami' }).click();
    // La cuenta de origen ya no se ofrece como destino.
    await expect(h.getByRole('radiogroup', { name: 'Entra en' }).getByRole('radio', { name: 'Banco Tami' })).toHaveCount(0);
    await h.getByRole('radiogroup', { name: 'Entra en' }).getByRole('radio', { name: 'Efectivo' }).click();

    await expect(h.getByText('Vas a pasar $20.000 de Banco Tami a Efectivo.')).toBeVisible();
    await h.getByRole('button', { name: 'Pasar plata' }).click();

    await expect.poll(() => cap.transferencias.length).toBe(1);
    expect(cap.transferencias[0]).toMatchObject({ cuenta_origen_id: 'c-banco-tami', cuenta_destino_id: 'c-efectivo', monto: 20000 });
    expect(cap.transferencias[0].clave_cliente).toMatch(UUID_V4);
  });

  test('desde un bolsillo explica que es plata que el negocio le debe al socio', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja?nuevo=transferencia');
    const h = hoja(page, 'Pasar plata entre cuentas');
    await h.getByRole('radiogroup', { name: 'Sale de' }).getByRole('radio', { name: 'Bolsillo de Facu' }).click();
    await expect(h.getByText('el negocio se la debe hasta que se la devuelva')).toBeVisible();
  });
});

test.describe('Caja — contar la caja', () => {
  test('muestra "Faltan $20" sin anotar y recién al confirmar anota la diferencia', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=arqueo');
    const h = hoja(page, 'Contar la caja');

    await expect(h.getByText('El sistema dice $5.000 en Efectivo.')).toBeVisible();
    await h.getByLabel('¿Cuánto hay?').fill('4.980');
    await h.getByRole('button', { name: 'Ver la diferencia' }).click();

    await expect(h.getByText('Faltan $20')).toBeVisible();
    expect(cap.arqueos).toHaveLength(1);
    expect(cap.arqueos[0].dryRun).toBe(true);

    await h.getByRole('button', { name: 'Anotar la diferencia' }).click();
    await expect.poll(() => cap.arqueos.length).toBe(2);
    expect(cap.arqueos[1].dryRun).toBe(false);
    expect(cap.arqueos[1].body).toMatchObject({ cuenta_id: 'c-efectivo', contado: 4980 });
    expect(cap.arqueos[1].body.clave_cliente).toBe(cap.arqueos[0].body.clave_cliente);
  });

  test('"Volver a contar" no anota nada, y si está justo no hay nada que anotar', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { arqueo: { saldo_sistema: 5000, contado: 5000, diferencia: 0, resultado: 'justo' } });
    await page.goto('/admin/caja?nuevo=arqueo');
    const h = hoja(page, 'Contar la caja');
    await h.getByLabel('¿Cuánto hay?').fill('5000');
    await h.getByRole('button', { name: 'Ver la diferencia' }).click();
    await expect(h.getByText('Está justo')).toBeVisible();
    await expect(h.getByRole('button', { name: 'Anotar la diferencia' })).toHaveCount(0);
    await h.getByRole('button', { name: 'Listo' }).click();
    await expect(h).toHaveCount(0);
    expect(cap.arqueos.every((a) => a.dryRun)).toBe(true);
  });
});

test.describe('Caja — movimientos', () => {
  test('muestra signo, "Entró/Salió" y marca lo anulado; las acciones respetan lo que el backend permite', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, {
      movimientos: [
        mov({ id: 'm-a', monto: -1500, nota: 'Tinta' }),
        mov({ id: 'm-b', monto: 50000, categoria: 'aporte_socio', nota: null, puede_corregir: true }),
        mov({ id: 'm-c', monto: -700, categoria: 'envios', anulado: true, puede_anular: false, puede_corregir: false }),
        mov({ id: 'm-d', monto: -20000, categoria: 'transferencia', grupo_id: 'g-1', puede_corregir: false }),
      ],
    });
    await page.goto('/admin/caja/movimientos');

    const tarjetas = page.getByTestId('movimiento-caja');
    await expect(tarjetas).toHaveCount(4);
    await expect(tarjetas.nth(0)).toContainText('−$1.500');
    await expect(tarjetas.nth(0)).toContainText('Salió');
    await expect(tarjetas.nth(0)).toContainText('Cargó Facu Cardenas');
    await expect(tarjetas.nth(1)).toContainText('+$50.000');
    await expect(tarjetas.nth(1)).toContainText('Entró');
    await expect(tarjetas.nth(2)).toContainText('Anulado');
    await expect(tarjetas.nth(2).getByRole('button', { name: 'Anular' })).toHaveCount(0);
    // Una transferencia se anula, pero no se "corrige" (son dos movimientos).
    await expect(tarjetas.nth(3).getByRole('button', { name: 'Anular' })).toBeVisible();
    await expect(tarjetas.nth(3).getByRole('button', { name: 'Corregir' })).toHaveCount(0);
  });

  test('anular pide confirmación en la propia tarjeta y llama al backend', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja/movimientos');

    const tarjeta = page.getByTestId('movimiento-caja').first();
    await tarjeta.getByRole('button', { name: 'Anular' }).click();
    await expect(tarjeta.getByText('¿Anular este movimiento? Queda tachado y el saldo vuelve a como estaba.')).toBeVisible();
    // "No" vuelve atrás sin llamar a nada.
    await tarjeta.getByRole('button', { name: 'No' }).click();
    expect(cap.anulaciones).toHaveLength(0);

    await tarjeta.getByRole('button', { name: 'Anular' }).click();
    await tarjeta.getByRole('button', { name: 'Sí, anular' }).click();
    await expect.poll(() => cap.anulaciones).toEqual(['m-1']);
    await expect(page.getByRole('status')).toContainText('Movimiento anulado');
  });

  test('corregir abre la hoja con los datos del movimiento y manda un PUT', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja/movimientos');

    await page.getByTestId('movimiento-caja').first().getByRole('button', { name: 'Corregir' }).click();
    const h = hoja(page, 'Corregir gasto');
    await expect(h.getByLabel('Monto')).toHaveValue('1500');
    await expect(h.getByRole('radio', { name: 'Insumos' })).toHaveAttribute('aria-checked', 'true');
    await expect(h.getByRole('radio', { name: 'Banco Tami' })).toHaveAttribute('aria-checked', 'true');

    await h.getByLabel('Monto').fill('1.800');
    await h.getByRole('button', { name: 'Guardar corrección' }).click();

    await expect.poll(() => cap.correcciones.length).toBe(1);
    expect(cap.correcciones[0].id).toBe('m-1');
    expect(cap.correcciones[0].body).toMatchObject({ tipo: 'gasto', monto: 1800, categoria: 'insumos', cuenta_id: 'c-banco-tami' });
    expect(cap.correcciones[0].body.clave_cliente).toMatch(UUID_V4);
  });

  test('el filtro Entradas pide solo entradas, y "Ver más" sigue por cursor', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { paginaSiguiente: [mov({ id: 'm-2', nota: 'Segunda página' })] });
    await page.goto('/admin/caja/movimientos');

    await expect(page.getByTestId('movimiento-caja')).toHaveCount(1);
    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(page.getByTestId('movimiento-caja')).toHaveCount(2);
    expect(cap.listados.some((u) => u.includes('cursor=cursor-2'))).toBe(true);

    await page.getByRole('button', { name: 'Entradas' }).click();
    await expect.poll(() => cap.listados.some((u) => u.includes('tipo=entrada'))).toBe(true);
  });

  test('sin movimientos explica qué hacer en vez de dejar la lista vacía', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { movimientos: [] });
    await page.goto('/admin/caja/movimientos');
    await expect(page.getByText('Todavía no hay movimientos. Cuando cargues un gasto o un ingreso, aparece acá.')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 8: el modal de "Gestionar" una orden mostraba estado,
// tracking y notas, pero no qué productos se compraron — justo el dato más
// operativo para atender un pedido. El backend ya incluía items_orden en
// GET /ordenes (ver ordenes.service.ts findAll), solo faltaba mostrarlo.

const ORDEN_CON_ITEMS = {
  id: 'orden-items-1', estado: 'pagado', total: 17500, metodo_pago: 'mercadopago',
  creado_en: new Date().toISOString(), usuarios: { nombre: 'Ana', apellido: 'Gómez' },
  items_orden: [
    {
      id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2,
      precio_unitario: 8000, subtotal: 16000, color: 'negro', texto_grabado: 'Para Juan',
    },
    {
      id: 'item-2', nombre_producto: 'Bombilla de acero', cantidad: 1,
      precio_unitario: 1500, subtotal: 1500, color: null, texto_grabado: null,
    },
  ],
};

test.describe('Admin — Órdenes — ítems del pedido en el modal de gestión', () => {
  test('muestra los productos comprados (nombre, cantidad, precio, color y grabado)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_CON_ITEMS] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByText('Bombilla de acero')).toBeVisible();
    await expect(page.getByText('2 × $8.000', { exact: false })).toBeVisible();
    await expect(page.getByText('negro', { exact: false })).toBeVisible();
    await expect(page.getByText('"Para Juan"')).toBeVisible();
  });

  test('sin ítems, muestra un mensaje en vez de dejar la sección vacía sin explicación', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) =>
      route.fulfill({ json: { data: [{ ...ORDEN_CON_ITEMS, items_orden: [] }] } }),
    );

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByText('Sin ítems.')).toBeVisible();
  });
});

// "Imprimir etiqueta": ticket interno para BENI Express/retiro, los 2 únicos
// métodos sin API de courier real conectada (ver EtiquetaOrden.tsx). No debe
// aparecer para métodos con API real (Correo/Andreani, aunque hoy tampoco
// estén conectados) ni para órdenes sin método de envío.
test.describe('Admin — Órdenes — botón "Imprimir etiqueta"', () => {
  const ordenCon = (proveedor: string | null) => ({
    ...ORDEN_CON_ITEMS,
    id: 'orden-etiqueta-1',
    metodo_envio_nombre: proveedor ? 'Envío' : undefined,
    metodos_envio: proveedor ? { nombre: 'Envío', proveedor } : undefined,
  });

  test('aparece para BENI Express (oca)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('oca')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toHaveAttribute('href', '/admin/ordenes/orden-etiqueta-1/etiqueta');
  });

  test('aparece para retiro', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('retiro')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toBeVisible();
  });

  test('no aparece para un método con API de courier real (correo/andreani)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('correo')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).not.toBeVisible();
  });

  test('no aparece sin método de envío', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon(null)] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).not.toBeVisible();
  });
});

// Cancelar a mano (modal Gestionar → estado "cancelado"): el backend devuelve el
// stock, pero en una orden que YA estaba paga exige `reintegrar_stock` explícito
// (400 si falta). El modal tiene que pedirlo y mandarlo.
test.describe('Admin — Órdenes — cancelar una orden paga pide qué hacer con el stock', () => {
  const orden = (estado: string, extra: Record<string, unknown> = {}) => ({
    ...ORDEN_CON_ITEMS, id: 'orden-cancelar-1', estado, ...extra,
  });

  async function cancelar(page: import('@playwright/test').Page, o: object, antes?: () => Promise<void>) {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [o] } }));
    await page.route('**/api/v1/ordenes/orden-cancelar-1', (route) => route.fulfill({ json: { ok: true } }));
    page.on('dialog', (d) => d.accept());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.locator('select').filter({ hasText: 'cancelado' }).last().selectOption('cancelado');
    if (antes) await antes();
    const put = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/ordenes/orden-cancelar-1'));
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    return (await put).postDataJSON() as Record<string, unknown>;
  }

  test('orden pagada: el checkbox viene tildado y manda reintegrar_stock: true', async ({ page }) => {
    const body = await cancelar(page, orden('pagado'), async () => {
      await expect(page.getByLabel('Devolver el producto al stock')).toBeChecked();
    });
    expect(body).toMatchObject({ estado: 'cancelado', reintegrar_stock: true });
  });

  test('destildarlo manda reintegrar_stock: false', async ({ page }) => {
    const body = await cancelar(page, orden('en_preparacion'), async () => {
      await page.getByLabel('Devolver el producto al stock').uncheck();
    });
    expect(body).toMatchObject({ estado: 'cancelado', reintegrar_stock: false });
  });

  test('una orden ya enviada arranca destildada (el producto probablemente no vuelve)', async ({ page }) => {
    const body = await cancelar(page, orden('enviado'), async () => {
      await expect(page.getByLabel('Devolver el producto al stock')).not.toBeChecked();
    });
    expect(body).toMatchObject({ estado: 'cancelado', reintegrar_stock: false });
  });

  test('si el stock ya volvió no ofrece el checkbox y manda false', async ({ page }) => {
    const body = await cancelar(page, orden('pagado', { stock_liberado_en: new Date().toISOString() }), async () => {
      await expect(page.getByText('El stock de esta orden ya estaba devuelto')).toBeVisible();
      await expect(page.getByLabel('Devolver el producto al stock')).toHaveCount(0);
    });
    expect(body).toMatchObject({ estado: 'cancelado', reintegrar_stock: false });
  });

  test('una orden pre-pago (el backend resuelve solo) no muestra el bloque ni manda el campo', async ({ page }) => {
    const body = await cancelar(page, orden('reservado'), async () => {
      await expect(page.getByLabel('Devolver el producto al stock')).toHaveCount(0);
    });
    expect(body).toMatchObject({ estado: 'cancelado' });
    expect(body).not.toHaveProperty('reintegrar_stock');
  });
});

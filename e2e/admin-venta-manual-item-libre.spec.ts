import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Ítem libre: en una venta manual se puede agregar algo que no está en
// "Productos" (se vende solo por otro canal). Va sin producto_id ni variante:
// el backend no le controla stock. Backend simulado.

const ORDEN_CON_LIBRE = {
  id: 'orden-libre-1',
  canal: 'admin_manual',
  estado: 'pago_parcial',
  total: 10500,
  subtotal: 10500,
  costo_envio: 0,
  metodo_pago: 'efectivo',
  metodo_envio_id: null,
  metodos_envio: null,
  envios_orden: [] as unknown[],
  es_prueba: false,
  creado_en: new Date().toISOString(),
  direccion_envio: { nombre: 'Juan Pérez' },
  pagos: [{ estado: 'aprobado', monto: 4000 }],
  items_orden: [
    { id: 'i1', producto_id: 'prod-catalogo', nombre_producto: 'Bombilla de acero', cantidad: 1, precio_unitario: 7000, subtotal: 7000 },
    { id: 'i2', producto_id: null, variante_id: null, nombre_producto: 'Llavero LED personalizado', cantidad: 1, precio_unitario: 3500, subtotal: 3500 },
  ],
};

async function abrirVentaManual(page: Page, ordenes: unknown[] = []) {
  await loginComoAdmin(page);
  await mockBackendAdminProductos(page);
  await mockCaja(page);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: ordenes } }));
  await page.goto('/admin/ordenes');
  await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
}

test.describe('Venta manual — producto que no está en el catálogo', () => {
  test('agrega un ítem libre (nombre, cantidad y precio) y lo manda sin producto_id ni variante', async ({ page }) => {
    await abrirVentaManual(page);
    let body: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'pagado' } });
    });

    await page.getByTestId('item-libre-venta-abrir').click();
    await page.getByTestId('item-libre-venta-nombre').fill('  Llavero LED personalizado ');
    await page.getByTestId('item-libre-venta-cantidad').fill('2');
    await page.getByTestId('item-libre-venta-precio').fill('3500');
    await page.getByTestId('item-libre-venta-agregar').click();

    // Queda en la lista y suma al total; el formulario se cierra.
    await expect(page.getByText('Llavero LED personalizado — 2 × $3.500')).toBeVisible();
    await expect(page.getByText('Total: $7.000')).toBeVisible();
    await expect(page.getByTestId('item-libre-venta')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();
    await expect.poll(() => body).not.toBeNull();
    expect(body.items).toEqual([{ nombre_producto: 'Llavero LED personalizado', precio_unitario: 3500, cantidad: 2 }]);
  });

  test('no deja agregar sin nombre o sin precio', async ({ page }) => {
    await abrirVentaManual(page);
    await page.getByTestId('item-libre-venta-abrir').click();
    const agregar = page.getByTestId('item-libre-venta-agregar');
    await expect(agregar).toBeDisabled();
    await page.getByTestId('item-libre-venta-nombre').fill('Llavero');
    await expect(agregar).toBeDisabled();
    await page.getByTestId('item-libre-venta-precio').fill('3500');
    await expect(agregar).toBeEnabled();
    await page.getByTestId('item-libre-venta-nombre').fill('   ');
    await expect(agregar).toBeDisabled();
  });

  test('se puede mezclar con un producto del catálogo en la misma venta', async ({ page }) => {
    await abrirVentaManual(page);
    let body: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'pagado' } });
    });

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByTestId('item-libre-venta-abrir').click();
    await page.getByTestId('item-libre-venta-nombre').fill('Llavero LED');
    await page.getByTestId('item-libre-venta-precio').fill('3500');
    await page.getByTestId('item-libre-venta-agregar').click();

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();
    await expect.poll(() => body).not.toBeNull();
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ producto_id: PRODUCTO_ADMIN_MOCK.id });
    expect(body.items[1]).toEqual({ nombre_producto: 'Llavero LED', precio_unitario: 3500, cantidad: 1 });
  });

  test('sugiere los nombres de ítems libres que ya se vendieron', async ({ page }) => {
    await abrirVentaManual(page, [ORDEN_CON_LIBRE]);
    await page.getByTestId('item-libre-venta-abrir').click();
    const sugerencias = await page.locator('#item-libre-venta-sugerencias option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(sugerencias).toEqual(['Llavero LED personalizado']);
  });
});

test.describe('Editar una venta manual con un ítem libre', () => {
  test('un ítem libre existente no manda producto_id vacío (el backend lo rechazaría) y se puede agregar otro', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_CON_LIBRE] } }));
    let body: any = null;
    await page.route('**/api/v1/ordenes/orden-libre-1/items', (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ json: { ...ORDEN_CON_LIBRE } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: '+ Agregar producto' }).click();
    await page.getByTestId('item-libre-edicion-abrir').click();
    await page.getByTestId('item-libre-edicion-nombre').fill('Cartel LED 30cm');
    await page.getByTestId('item-libre-edicion-precio').fill('15000');
    await page.getByTestId('item-libre-edicion-agregar').click();

    await expect(page.getByText('Nuevo subtotal: $25.500')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar productos' }).click();

    await expect.poll(() => body).not.toBeNull();
    expect(body.items).toEqual([
      expect.objectContaining({ producto_id: 'prod-catalogo', nombre_producto: 'Bombilla de acero' }),
      { nombre_producto: 'Llavero LED personalizado', precio_unitario: 3500, cantidad: 1 },
      { nombre_producto: 'Cartel LED 30cm', precio_unitario: 15000, cantidad: 1 },
    ]);
    for (const item of body.items.slice(1)) expect(Object.keys(item)).not.toContain('producto_id');
  });
});

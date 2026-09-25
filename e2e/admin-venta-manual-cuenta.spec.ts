import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Venta manual y "registrar pago": en qué cuenta de la caja entró la plata.
// El selector solo ofrece las cuentas donde ese medio puede entrar; para
// "otro" (sin cuenta por defecto) hay que elegirla. El backend valida lo mismo
// (common/caja-cobro.ts); acá se prueba lo que ve y manda la pantalla.

const POR_DEFECTO = 'La de siempre para este medio';

async function abrirVentaManual(page: Page) {
  await loginComoAdmin(page);
  await mockBackendAdminProductos(page);
  await mockCaja(page);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
  await page.goto('/admin/ordenes');
  await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
  await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
  await page.getByRole('button', { name: 'Agregar' }).click();
}

const medioDePago = (page: Page) => page.getByText('Medio de pago', { exact: true }).locator('..').locator('select');
const cobrado = (page: Page) => page.getByText('Monto cobrado ahora', { exact: true }).locator('..').locator('input');
const selectorCuenta = (page: Page) => page.getByLabel('¿En qué cuenta entró?');

function capturarVenta(page: Page) {
  const cap: { body: Record<string, unknown> | null } = { body: null };
  return page
    .route('**/api/v1/ordenes/venta-manual', (route) => {
      cap.body = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'pagado' } });
    })
    .then(() => cap);
}

test.describe('Venta manual — cuenta de cobro', () => {
  test('cobrando en efectivo ofrece solo la cuenta de efectivo y manda cuenta_caja_id', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);

    await cobrado(page).fill('5000');
    await expect(selectorCuenta(page).locator('option')).toHaveText([POR_DEFECTO, 'Efectivo']);
    await selectorCuenta(page).selectOption({ label: 'Efectivo' });
    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(venta.body).toMatchObject({ metodo_pago: 'efectivo', monto_pagado: 5000, cuenta_caja_id: 'c-efectivo' });
  });

  test('sin elegir cuenta no manda cuenta_caja_id (la resuelve el sincronizador con la cuenta por defecto)', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);

    await cobrado(page).fill('5000');
    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(Object.keys(venta.body!)).not.toContain('cuenta_caja_id');
  });

  test('transferencia ofrece bancos y Mercado Pago, nunca efectivo ni bolsillos', async ({ page }) => {
    await abrirVentaManual(page);
    await medioDePago(page).selectOption('transferencia');
    await cobrado(page).fill('5000');
    await expect(selectorCuenta(page).locator('option')).toHaveText([POR_DEFECTO, 'Banco Tami', 'Mercado Pago (Facu)', 'Banco Facu']);
  });

  test('"otro" no tiene cuenta por defecto: hay que elegirla para poder cargar la venta', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);

    await medioDePago(page).selectOption('otro');
    await cobrado(page).fill('5000');
    await expect(selectorCuenta(page).locator('option').first()).toHaveText('Elegí una cuenta');
    await expect(page.getByRole('button', { name: 'Cargar venta', exact: true })).toBeDisabled();

    await selectorCuenta(page).selectOption({ label: 'Banco Facu' });
    await expect(page.getByRole('button', { name: 'Cargar venta', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(venta.body).toMatchObject({ metodo_pago: 'otro', cuenta_caja_id: 'c-banco-facu' });
  });

  test('sin cobro (seña $0) no hay nada que ubicar: no muestra el selector ni obliga a elegir', async ({ page }) => {
    await abrirVentaManual(page);
    await medioDePago(page).selectOption('otro');
    await expect(selectorCuenta(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cargar venta', exact: true })).toBeEnabled();
  });

  test('si cambia el medio de pago, la cuenta elegida que ya no sirve se limpia', async ({ page }) => {
    await abrirVentaManual(page);
    await cobrado(page).fill('5000');
    await selectorCuenta(page).selectOption({ label: 'Efectivo' });
    await medioDePago(page).selectOption('transferencia');
    await expect(selectorCuenta(page)).toHaveValue('');
  });
});

test.describe('Registrar pago de una seña — cuenta de cobro', () => {
  const ORDEN_PARCIAL = {
    id: 'orden-parcial-2',
    canal: 'admin_manual',
    estado: 'pago_parcial',
    total: 16000,
    metodo_pago: 'efectivo',
    creado_en: new Date().toISOString(),
    direccion_envio: { tipo: 'venta_manual', nombre: 'Juan Pérez' },
    pagos: [{ estado: 'aprobado', monto: 5000 }],
    items_orden: [{ id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2, precio_unitario: 8000, subtotal: 16000 }],
  };

  test('manda la cuenta elegida junto con el pago', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_PARCIAL] } }));
    let body: Record<string, unknown> | null = null;
    await page.route(`**/api/v1/ordenes/${ORDEN_PARCIAL.id}/registrar-pago`, (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ json: { ...ORDEN_PARCIAL, estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByText('Monto', { exact: true }).locator('..').locator('input').fill('11000');
    await selectorCuenta(page).selectOption({ label: 'Efectivo' });
    await page.getByRole('button', { name: 'Registrar' }).click();

    await expect.poll(() => body).not.toBeNull();
    expect(body).toEqual({ monto: 11000, metodo_pago: 'efectivo', cuenta_caja_id: 'c-efectivo' });
  });
});

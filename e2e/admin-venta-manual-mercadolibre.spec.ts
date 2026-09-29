import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Venta manual cobrada por MercadoLibre: la cobra MeLI (no hay seña ni monto a
// tipear), se carga el neto que libera y, si se ve en el panel, cuándo. La plata
// cae en una cuenta de Mercado Pago. Backend simulado.

async function abrirVentaManual(page: Page) {
  await loginComoAdmin(page);
  await mockBackendAdminProductos(page);
  await mockCaja(page);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
  await page.goto('/admin/ordenes');
  await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
  await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
}

const medioDePago = (page: Page) => page.getByText('Medio de pago', { exact: true }).locator('..').locator('select');
const selectorCuenta = (page: Page) => page.getByLabel('¿En qué cuenta te cae la plata?');
const cargar = (page: Page) => page.getByRole('button', { name: 'Cargar venta', exact: true });

function capturarVenta(page: Page) {
  const cap: { body: Record<string, any> | null } = { body: null };
  return page
    .route('**/api/v1/ordenes/venta-manual', (route) => {
      cap.body = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'pagado' } });
    })
    .then(() => cap);
}

test.describe('Venta manual — MercadoLibre', () => {
  test('MercadoLibre es un medio de pago; cambia el formulario: neto y fecha en vez del monto cobrado', async ({ page }) => {
    await abrirVentaManual(page);
    await expect(medioDePago(page).locator('option')).toHaveText(['efectivo', 'transferencia', 'otro', 'MercadoLibre']);

    await expect(page.getByText('Monto cobrado ahora', { exact: true })).toBeVisible();
    await medioDePago(page).selectOption('mercadolibre');

    await expect(page.getByText('Monto cobrado ahora', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('neto-meli')).toBeVisible();
    await expect(page.getByTestId('liberacion-meli')).toBeVisible();
    await expect(page.getByTestId('ayuda-meli')).toContainText('MercadoLibre cobra el total');
  });

  test('solo ofrece cuentas de Mercado Pago, y hay que elegir una (no hay cuenta por defecto)', async ({ page }) => {
    await abrirVentaManual(page);
    await medioDePago(page).selectOption('mercadolibre');
    await page.getByTestId('neto-meli').fill('5000');

    await expect(selectorCuenta(page).locator('option')).toHaveText(['Elegí una cuenta', 'Mercado Pago (Facu)']);
    await expect(cargar(page)).toBeDisabled();
    await selectorCuenta(page).selectOption({ label: 'Mercado Pago (Facu)' });
    await expect(cargar(page)).toBeEnabled();
  });

  test('sin neto, o con un neto mayor al total, no deja cargar', async ({ page }) => {
    await abrirVentaManual(page);
    await medioDePago(page).selectOption('mercadolibre');
    await selectorCuenta(page).selectOption({ label: 'Mercado Pago (Facu)' });

    await expect(cargar(page)).toBeDisabled(); // sin neto
    await page.getByTestId('neto-meli').fill('0');
    await expect(cargar(page)).toBeDisabled();
    await page.getByTestId('neto-meli').fill('99999999');
    await expect(cargar(page)).toBeDisabled(); // mayor al total
    await page.getByTestId('neto-meli').fill('100');
    await expect(cargar(page)).toBeEnabled();
  });

  test('manda el total como monto pagado, el neto, la fecha y la cuenta', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);

    await medioDePago(page).selectOption('mercadolibre');
    const total = await page.getByText(/^Total: \$/).textContent();
    const totalNumero = Number((total ?? '').replace(/[^\d]/g, ''));
    await page.getByTestId('neto-meli').fill('7500.5');
    await page.getByTestId('liberacion-meli').fill('2026-10-10');
    await selectorCuenta(page).selectOption({ label: 'Mercado Pago (Facu)' });
    await cargar(page).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(venta.body).toMatchObject({
      metodo_pago: 'mercadolibre',
      monto_pagado: totalNumero,
      cuenta_caja_id: 'c-mp',
      mercadolibre: { neto: 7500.5, liberacion_estimada: '2026-10-10' },
    });
  });

  test('la fecha de liberación es opcional: sin fecha no manda liberacion_estimada', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);
    await medioDePago(page).selectOption('mercadolibre');
    await page.getByTestId('neto-meli').fill('100');
    await selectorCuenta(page).selectOption({ label: 'Mercado Pago (Facu)' });
    await cargar(page).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(venta.body!.mercadolibre).toEqual({ neto: 100 });
  });

  test('otros medios no mandan el bloque mercadolibre', async ({ page }) => {
    await abrirVentaManual(page);
    const venta = await capturarVenta(page);
    await page.getByText('Monto cobrado ahora', { exact: true }).locator('..').locator('input').fill('5000');
    await cargar(page).click();

    await expect.poll(() => venta.body).not.toBeNull();
    expect(Object.keys(venta.body!)).not.toContain('mercadolibre');
  });

  test('MercadoLibre también está entre los canales de venta', async ({ page }) => {
    await abrirVentaManual(page);
    const canal = page.getByText('Canal de venta (opcional)', { exact: true }).locator('..').locator('select');
    await expect(canal.locator('option', { hasText: 'MercadoLibre' })).toHaveCount(1);
  });

  test('registrar un pago posterior no ofrece MercadoLibre (necesita neto y fecha)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.route('**/api/v1/ordenes?**', (route) =>
      route.fulfill({
        json: {
          data: [{
            id: 'orden-parcial-1', canal: 'admin_manual', estado: 'pago_parcial', total: 16000, metodo_pago: 'efectivo',
            creado_en: new Date().toISOString(), direccion_envio: { tipo: 'venta_manual', nombre: 'Juan' },
            pagos: [{ id: 'p1', estado: 'aprobado', monto: 5000, proveedor: 'efectivo' }], items_orden: [],
          }],
        },
      }),
    );
    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    const medio = page.getByText('Medio de pago', { exact: true }).locator('..').locator('select');
    await expect(medio.locator('option')).toHaveText(['efectivo', 'transferencia', 'otro']);
  });
});

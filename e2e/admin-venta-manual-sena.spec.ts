import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Una venta manual solo se registra cuando ya entró plata: el total o, al menos, una seña. El formulario no
// deja cargar una venta con $0 (el backend también lo rechaza). MercadoLibre cobra el total y no usa este campo.

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

const cobrado = (page: Page) => page.getByText('Monto cobrado ahora', { exact: true }).locator('..').locator('input');
const cargar = (page: Page) => page.getByRole('button', { name: 'Cargar venta', exact: true });

test.describe('Venta manual — seña mínima', () => {
  test('sin monto cobrado no se puede cargar: el botón queda deshabilitado', async ({ page }) => {
    await abrirVentaManual(page);
    await expect(cargar(page)).toBeDisabled();
  });

  test('con $0 tampoco; con cualquier monto mayor a cero ya se puede', async ({ page }) => {
    await abrirVentaManual(page);
    await cobrado(page).fill('0');
    await expect(cargar(page)).toBeDisabled();
    await cobrado(page).fill('1500');
    await expect(cargar(page)).toBeEnabled();
    await cobrado(page).fill('');
    await expect(cargar(page)).toBeDisabled();
  });

  test('la ayuda explica la regla y ya no ofrece dejar el cobro en cero', async ({ page }) => {
    await abrirVentaManual(page);
    await expect(page.getByText('Una venta se registra cuando ya entró plata', { exact: false })).toBeVisible();
    await expect(page.getByText('Dejalo vacío o en $0', { exact: false })).toHaveCount(0);
  });

  test('una seña menor al total se manda tal cual (queda como pago parcial)', async ({ page }) => {
    await abrirVentaManual(page);
    let body: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'sin_preparar' } });
    });

    await cobrado(page).fill('2500');
    await cargar(page).click();

    await expect.poll(() => body).not.toBeNull();
    expect(body.monto_pagado).toBe(2500);
  });

  test('si el backend igual la rechaza por falta de seña (400), muestra el mensaje en el formulario', async ({ page }) => {
    await abrirVentaManual(page);
    await page.route('**/api/v1/ordenes/venta-manual', (route) =>
      route.fulfill({ status: 400, json: { statusCode: 400, message: 'Cargá al menos una seña: una venta manual se registra cuando ya entró plata (la seña o el total).' } }),
    );
    await cobrado(page).fill('100');
    await cargar(page).click();
    await expect(page.getByText('Cargá al menos una seña', { exact: false })).toBeVisible();
  });

  test('MercadoLibre no usa este campo: cobra el total, así que no pide seña', async ({ page }) => {
    await abrirVentaManual(page);
    await page.getByText('Medio de pago', { exact: true }).locator('..').locator('select').selectOption('mercadolibre');
    await expect(page.getByText('Monto cobrado ahora', { exact: true })).toHaveCount(0);
    await page.getByTestId('neto-meli').fill('100');
    await page.getByLabel('¿En qué cuenta te cae la plata?').selectOption({ label: 'Mercado Pago (Facu)' });
    await expect(cargar(page)).toBeEnabled();
  });
});

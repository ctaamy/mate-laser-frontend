import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from '../fixtures';

test.describe('Visual — checkout paso a paso', () => {
  test('paso 1: datos personales', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await page.goto('/carrito');
    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page).toHaveScreenshot('paso-1-datos.png');
  });

  test('paso 2: envío', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await page.goto('/carrito');
    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await page.getByPlaceholder('María').fill('Juana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
    await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
    // El listado de envíos (incluido "Retiro en local") solo se pide cuando
    // hay Provincia+Ciudad elegidas — ver mismo patrón en checkout.spec.ts.
    // Sin esto, la sección se queda en "Elegí tu provincia y ciudad para ver
    // las opciones disponibles" y el método de envío nunca aparece.
    await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
    await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
    await page.getByPlaceholder('1043').fill('1000');
    await expect(page.getByText('Retiro en local')).toBeVisible();
    await expect(page).toHaveScreenshot('paso-2-envio.png');
  });

  test('paso 3: pago', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await page.goto('/carrito');
    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await page.getByPlaceholder('María').fill('Juana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
    await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
    // Ídem paso 2: sin Provincia+Ciudad no hay métodos de envío para elegir.
    await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
    await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
    await page.getByPlaceholder('1043').fill('1000');
    await page.getByText('Retiro en local').click();
    await page.getByRole('button', { name: /Continuar al pago/i }).click();
    await expect(page.getByRole('button', { name: /Confirmar y pagar/i })).toBeVisible();
    await expect(page).toHaveScreenshot('paso-3-pago.png');
  });
});

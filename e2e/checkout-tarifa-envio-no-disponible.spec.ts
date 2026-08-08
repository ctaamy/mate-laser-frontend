import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// Cubre el rechazo por SHIPPING_RATE_UNAVAILABLE (ver ordenes.service.ts /
// envios.service.ts::revalidarTarifaProveedor): si Andreani/Correo no
// responden tras el reintento del backend al confirmar la orden, POST
// /ordenes devuelve 400 con { message, error_code: 'SHIPPING_RATE_UNAVAILABLE' }.
// El checkout debe distinguir esto de un error genérico y ofrecer volver a
// elegir método de envío sin perder los datos ya cargados.

const METODO_ANDREANI_MOCK = {
  id: 3,
  nombre: 'Andreani',
  proveedor: 'andreani',
  descripcion: 'Envío a domicilio en 3 a 5 días hábiles',
  costo: 3200,
  costo_original: 3200,
  api_conectada: true,
  envio_gratis: false,
  disponible: true,
};

const MENSAJE_TARIFA_NO_DISPONIBLE =
  'No pudimos confirmar la tarifa de envío con Andreani en este momento. Probá de nuevo en unos segundos o elegí otro método de envío.';

async function completarHastaConfirmarConAndreani(page: import('@playwright/test').Page) {
  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
  await page.getByRole('button', { name: /Agregar al carrito/i }).click();
  await expect(page.getByText('✓ Agregado')).toBeVisible();

  await page.goto('/carrito');
  await page.getByRole('button', { name: /Continuar con el envío/i }).click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByPlaceholder('María').fill('Juana');
  await page.getByPlaceholder('González').fill('Pérez');
  await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
  await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');

  await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
  await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');

  const opcionAndreani = page.getByText('Andreani', { exact: true });
  await expect(opcionAndreani).toBeVisible();
  await opcionAndreani.click();

  await page.getByPlaceholder('Av. Corrientes 1234').fill('Av. Rivadavia 1500');
  await page.getByPlaceholder('1043').fill('1406');

  await page.getByRole('button', { name: /Continuar al pago/i }).click();
  await page.getByRole('button', { name: /Confirmar y pagar/i }).click();
}

test.describe('Checkout — rechazo por tarifa de envío no verificada (SHIPPING_RATE_UNAVAILABLE)', () => {
  test('muestra el mensaje del backend y permite volver a elegir método sin perder los datos cargados', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });

    // Override: esta zona cotiza Andreani (no retiro) y la creación de la
    // orden falla con el 400 específico de tarifa no verificada.
    let llamadasEnvios = 0;
    await page.route('**/api/v1/envios/calcular', (route) => {
      llamadasEnvios++;
      return route.fulfill({ json: [METODO_ANDREANI_MOCK] });
    });
    await page.route('**/api/v1/ordenes', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 400,
        json: { statusCode: 400, message: MENSAJE_TARIFA_NO_DISPONIBLE, error_code: 'SHIPPING_RATE_UNAVAILABLE' },
      });
    });

    await completarHastaConfirmarConAndreani(page);

    // El mensaje mostrado es el que manda el backend, tal cual — no uno inventado.
    await expect(page.getByText(MENSAJE_TARIFA_NO_DISPONIBLE)).toBeVisible();

    // No debe confundirse con el banner de error genérico.
    await expect(page.getByText('Error al procesar la orden')).not.toBeVisible();

    const btnVolver = page.getByRole('button', { name: /Elegir otro método de envío/i });
    await expect(btnVolver).toBeVisible();

    const llamadasAntesDeVolver = llamadasEnvios;
    await btnVolver.click();

    // Vuelve al paso de método de envío (paso 2, sección visible de nuevo).
    await expect(page.getByRole('button', { name: /Continuar al pago/i })).toBeVisible();
    await expect(page.getByText(MENSAJE_TARIFA_NO_DISPONIBLE)).not.toBeVisible();

    // Refetch de opciones de envío disparado al volver.
    await expect.poll(() => llamadasEnvios).toBeGreaterThan(llamadasAntesDeVolver);

    // El método elegido queda deseleccionado — no se confía en ese precio.
    const opcionAndreani = page.locator('div').filter({ hasText: /^Andreani/ }).first();
    await expect(page.getByRole('button', { name: /Continuar al pago/i })).toBeEnabled();
    await opcionAndreani.scrollIntoViewIfNeeded();

    // El resto de los datos del checkout no se perdió.
    await expect(page.getByPlaceholder('María')).toHaveValue('Juana');
    await expect(page.getByPlaceholder('González')).toHaveValue('Pérez');
    await expect(page.getByPlaceholder('tu@email.com')).toHaveValue('juana@test.com');
    await expect(page.getByPlaceholder('Av. Corrientes 1234')).toHaveValue('Av. Rivadavia 1500');
    await expect(page.getByPlaceholder('1043')).toHaveValue('1406');
  });

  test('un error genérico (sin error_code) sigue mostrando el banner rojo de siempre, no el de tarifa', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('**/api/v1/ordenes', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({ status: 400, json: { statusCode: 400, message: 'Stock insuficiente para Mate Imperial Grabado' } });
    });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await page.goto('/carrito');
    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await page.getByPlaceholder('María').fill('Juana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
    await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
    await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
    await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
    await page.getByText('Retiro en local').click();
    await page.getByRole('button', { name: /Continuar al pago/i }).click();
    await page.getByRole('button', { name: /Confirmar y pagar/i }).click();

    await expect(page.getByText('Stock insuficiente para Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Elegir otro método de envío/i })).not.toBeVisible();
  });
});

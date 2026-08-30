import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// PR #2 de "cupones por selección": el cupón aplicado en el carrito ahora vive
// en el store (no en estado local de Carrito.tsx), sobrevive a la navegación al
// checkout y llega a POST /ordenes con `descuento` + `cupon_id` reales. Antes
// el checkout mandaba `descuento: 0` fijo y el cupón se perdía en el camino.

const CUPON = {
  valido: true,
  cupon_id: 'cup-e2e-1',
  codigo: 'MATE20',
  tipo: 'porcentaje',
  valor: 20,
  aplica_a_todo: true,
  subtotal_elegible: PRODUCTO_MOCK.precio_base,
  descuento: Math.round(PRODUCTO_MOCK.precio_base * 0.2), // 1600
  items_elegibles: [PRODUCTO_MOCK.id],
};

// Mock de POST /cupones/validar: MATE20 devuelve el descuento, cualquier otro
// código 404 con el mensaje del backend.
async function mockValidarCupon(page: Page) {
  await page.route('**/api/v1/cupones/validar', (route) => {
    const body = route.request().postDataJSON() as { codigo?: string };
    if ((body?.codigo || '').toUpperCase() === 'MATE20') {
      return route.fulfill({ json: CUPON });
    }
    return route.fulfill({ status: 404, json: { message: 'Cupón no válido' } });
  });
}

// Registra un mock de POST /ordenes que captura el body enviado, para poder
// afirmar qué `descuento`/`cupon_id` mandó el checkout.
async function capturarOrden(page: Page) {
  const capturado: { body?: any } = {};
  await page.route('**/api/v1/ordenes', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    capturado.body = route.request().postDataJSON();
    return route.fulfill({
      json: { id: 'orden-e2e-1', estado: 'pendiente', metodo_pago: 'mercadopago' },
    });
  });
  return capturado;
}

async function agregarProductoAlCarrito(page: Page) {
  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
  await page.getByRole('button', { name: /Agregar al carrito/i }).click();
  await expect(page.getByText('✓ Agregado')).toBeVisible();
}

test.describe('Cupón — carrito → checkout → orden', () => {
  test('aplica el descuento, lo mantiene en el checkout y lo manda en la orden', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);
    const orden = await capturarOrden(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');

    // Sin cupón: total = subtotal.
    await expect(page.getByText('$8.000').first()).toBeVisible();

    // Aplicar MATE20.
    await page.getByPlaceholder('Código de descuento').fill('MATE20');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    // Cupón aplicado + línea de descuento + total recalculado.
    await expect(page.getByText('aplicado')).toBeVisible();
    await expect(page.getByText('Descuento (MATE20)')).toBeVisible();
    await expect(page.getByText('$1.600')).toBeVisible();
    await expect(page.getByText('$6.400')).toBeVisible();

    // Quitar el cupón: vuelve todo atrás.
    await page.getByRole('button', { name: /Quitar/ }).click();
    await expect(page.getByText('Descuento (MATE20)')).toHaveCount(0);
    await expect(page.getByText('$1.600')).toHaveCount(0);
    await expect(page.getByPlaceholder('Código de descuento')).toBeVisible();

    // Re-aplicar y avanzar al checkout.
    await page.getByPlaceholder('Código de descuento').fill('MATE20');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();
    await expect(page.getByText('$6.400')).toBeVisible();

    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // El descuento sobrevive a la navegación: aparece en el resumen del checkout.
    await expect(page.getByText('Descuento (MATE20)')).toBeVisible();
    await expect(page.getByText('$1.600')).toBeVisible();

    // Completar el checkout hasta confirmar.
    await page.getByPlaceholder('María').fill('Juana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
    await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
    await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
    await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
    await page.getByText('Retiro en local').click();
    await page.getByRole('button', { name: /Continuar al pago/i }).click();
    await page.getByRole('button', { name: /Confirmar y pagar/i }).click();
    await expect(page).toHaveURL(/\/pago\//);

    // La orden se creó con el descuento y el cupón, no con descuento 0.
    expect(orden.body).toMatchObject({
      descuento: CUPON.descuento,
      cupon_id: CUPON.cupon_id,
      subtotal: PRODUCTO_MOCK.precio_base,
      total: PRODUCTO_MOCK.precio_base - CUPON.descuento,
    });
  });

  test('código inválido muestra el error del backend y no aplica descuento', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');

    await page.getByPlaceholder('Código de descuento').fill('NOEXISTE');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('Cupón no válido')).toBeVisible();
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
    // El total sigue siendo el subtotal.
    await expect(page.getByText('$8.000').first()).toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, dispararSubmitDelBrick, PRODUCTO_MOCK } from './fixtures';

// Flujo común a ambos escenarios: producto → personalización → carrito →
// checkout → llega a /pago/:id. A partir de ahí cada test dispara el Brick
// con un resultado distinto (aprobado / rechazado).
async function completarHastaPago(page: Page) {
  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
  await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();

  // Personalización: activar grabado y cargar texto
  await page.getByText('Grabado personalizado').click();
  await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('Para Juan');

  await page.getByRole('button', { name: /Agregar al carrito/i }).click();
  await expect(page.getByText('✓ Agregado')).toBeVisible();

  await page.goto('/carrito');
  await page.getByRole('button', { name: /Continuar con el envío/i }).click();

  await expect(page).toHaveURL(/\/checkout/);

  // Datos personales
  await page.getByPlaceholder('María').fill('Juana');
  await page.getByPlaceholder('González').fill('Pérez');
  await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
  await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');

  // El listado de envíos solo se pide cuando hay un CP cargado (aunque el
  // método elegido termine siendo retiro), así que lo completamos igual.
  await page.getByPlaceholder('1043').fill('1000');
  await expect(page.getByText('Retiro en local')).toBeVisible();
  await page.getByText('Retiro en local').click();

  await page.getByRole('button', { name: /Continuar al pago/i }).click();

  // Paso 3: Mercado Pago ya viene seleccionado por defecto
  await page.getByRole('button', { name: /Confirmar y pagar/i }).click();

  await expect(page).toHaveURL(/\/pago\//);
}

test.describe('Checkout → Pago con Mercado Pago', () => {
  test('pago aprobado: redirige a confirmación y muestra el pedido confirmado', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });

    await completarHastaPago(page);
    await dispararSubmitDelBrick(page);

    // Esto es lo que hoy podría fallar si Pago.tsx dejara de navegar tras un
    // pago aprobado: el test se queda esperando la URL y falla explícito.
    await expect(page).toHaveURL(/\/confirmacion\/.+\?mp=success/);
    await expect(page.getByText('¡Tu pedido está confirmado!')).toBeVisible();

    // El carrito debe vaciarse tras un pago aprobado
    const carritoStorage = await page.evaluate(() => localStorage.getItem('carrito-storage'));
    const items = JSON.parse(carritoStorage ?? '{}')?.state?.items ?? [];
    expect(items).toHaveLength(0);
  });

  test('pago rechazado: redirige a confirmación en estado rechazado (detecta el bug de redirect)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'rejected' });

    await completarHastaPago(page);
    await dispararSubmitDelBrick(page);

    // Este es el assert que expone el bug: si el redirect post-rechazo se
    // rompe (ej. el usuario queda trabado en /pago/:id con solo un mensaje
    // de error, sin poder ver el estado de su orden ni reintentar desde
    // Confirmación), este test falla acá en vez de colarse a producción.
    await expect(page).toHaveURL(/\/confirmacion\/.+\?mp=failure/);
    await expect(page.getByText('El pago no pudo procesarse')).toBeVisible();
    await expect(page.getByRole('link', { name: /Reintentar pago/i })).toBeVisible();

    // En un pago rechazado la orden sigue reservada: el carrito NO debería
    // vaciarse, porque el usuario puede querer reintentar sin recargar todo.
    const carritoStorage = await page.evaluate(() => localStorage.getItem('carrito-storage'));
    const items = JSON.parse(carritoStorage ?? '{}')?.state?.items ?? [];
    expect(items.length).toBeGreaterThan(0);
  });
});

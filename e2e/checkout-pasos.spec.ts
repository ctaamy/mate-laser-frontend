import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// Complementa checkout.spec.ts (que valida el resultado final de pago).
// Acá el foco es que cada paso del checkout se vea y se pueda clickear sin
// errores de consola, paso por paso.

test.describe('Checkout — pasos visibles y clickeables', () => {
  test('recorre los 3 pasos del checkout sin errores de consola', async ({ page }) => {
    const erroresConsola: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()); });
    page.on('pageerror', (err) => erroresConsola.push(err.message));

    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await expect(page.getByText('✓ Agregado')).toBeVisible();

    await page.goto('/carrito');
    await expect(page.getByText(PRODUCTO_MOCK.nombre)).toBeVisible();
    const btnContinuar = page.getByRole('button', { name: /Continuar con el envío/i });
    await expect(btnContinuar).toBeVisible();
    await expect(btnContinuar).toBeEnabled();
    await btnContinuar.click();
    await expect(page).toHaveURL(/\/checkout/);

    // Paso 1: datos personales
    const nombre = page.getByPlaceholder('María');
    const apellido = page.getByPlaceholder('González');
    const email = page.getByPlaceholder('tu@email.com');
    const telefono = page.getByPlaceholder('+54 11 XXXX-XXXX');
    for (const campo of [nombre, apellido, email, telefono]) {
      await expect(campo).toBeVisible();
      await expect(campo).toBeEditable();
    }
    await nombre.fill('Juana');
    await apellido.fill('Pérez');
    await email.fill('juana@test.com');
    await telefono.fill('1122334455');

    // Paso 2: envío
    await page.getByPlaceholder('1043').fill('1000');
    const opcionRetiro = page.getByText('Retiro en local');
    await expect(opcionRetiro).toBeVisible();
    await opcionRetiro.click();

    const btnContinuarPago = page.getByRole('button', { name: /Continuar al pago/i });
    await expect(btnContinuarPago).toBeVisible();
    await expect(btnContinuarPago).toBeEnabled();
    await btnContinuarPago.click();

    // Paso 3: pago
    const btnConfirmar = page.getByRole('button', { name: /Confirmar y pagar/i });
    await expect(btnConfirmar).toBeVisible();
    await expect(btnConfirmar).toBeEnabled();
    await btnConfirmar.click();

    await expect(page).toHaveURL(/\/pago\//);

    // Ignoramos ruido de red de recursos no mockeados del SDK real de MP
    // (analytics/fraude); no es parte de la lógica de la app bajo test.
    const erroresRelevantes = erroresConsola.filter((e) => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(erroresRelevantes).toEqual([]);
  });
});

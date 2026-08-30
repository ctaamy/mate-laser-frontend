import { test, expect } from '@playwright/test';

// La página /verificar-email consume el link que llega por email:
// GET /api/v1/auth/verificar-email?token=... y muestra ok / error.

test.describe('Verificar email — página del link del correo', () => {
  test('token válido: muestra confirmación y CTA a mi cuenta', async ({ page }) => {
    await page.route('**/api/v1/auth/verificar-email**', (r) =>
      r.fulfill({ json: { ok: true, mensaje: 'Email verificado correctamente' } }),
    );

    await page.goto('/verificar-email?token=tok-valido');

    await expect(page.getByText(/email verificado correctamente/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /ir a mi cuenta/i })).toBeVisible();
  });

  test('token inválido o vencido: muestra error y opción de reenviar', async ({ page }) => {
    await page.route('**/api/v1/auth/verificar-email**', (r) =>
      r.fulfill({ status: 401, json: { message: 'Token de verificación inválido o ya utilizado' } }),
    );

    await page.goto('/verificar-email?token=tok-vencido');

    await expect(page.getByText(/inválido o ya utilizado/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /reenviar verificación/i })).toBeVisible();
  });

  test('sin token: no llama al backend y muestra error', async ({ page }) => {
    let llamado = false;
    await page.route('**/api/v1/auth/verificar-email**', (r) => {
      llamado = true;
      r.fulfill({ json: { ok: true } });
    });

    await page.goto('/verificar-email');

    await expect(page.getByText(/link de verificación no es válido/i)).toBeVisible();
    expect(llamado).toBe(false);
  });
});

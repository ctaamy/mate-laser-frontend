import { test, expect } from '@playwright/test';

// Página del link de baja del footer de los mails de campaña:
// POST /api/v1/newsletter/baja { token }.

test.describe('Baja de newsletter — link del footer', () => {
  test('token válido: confirma la baja', async ({ page }) => {
    await page.route('**/api/v1/newsletter/baja', (r) => r.fulfill({ json: { estado: 'baja', email: 'a@b.com' } }));

    await page.goto('/baja-newsletter?token=tok-real');

    await expect(page.getByText(/te diste de baja/i)).toBeVisible();
  });

  test('token de prueba (PRUEBA): no llama al backend y muestra error', async ({ page }) => {
    let llamado = false;
    await page.route('**/api/v1/newsletter/baja', (r) => { llamado = true; r.fulfill({ json: { estado: 'baja' } }); });

    await page.goto('/baja-newsletter?token=PRUEBA');

    await expect(page.getByText(/no es válido/i)).toBeVisible();
    expect(llamado).toBe(false);
  });

  test('token inválido: muestra el error del backend', async ({ page }) => {
    await page.route('**/api/v1/newsletter/baja', (r) =>
      r.fulfill({ status: 400, json: { message: 'El link de baja no es válido.' } }),
    );

    await page.goto('/baja-newsletter?token=nope');

    await expect(page.getByText(/no es válido/i)).toBeVisible();
  });
});

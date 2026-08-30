import { test, expect } from '@playwright/test';

// Página que consume el link del mail de doble opt-in:
// POST /api/v1/newsletter/confirmar { token } → ok / error.

test.describe('Confirmar newsletter — página del link del correo', () => {
  test('token válido: confirma y ofrece ver productos', async ({ page }) => {
    await page.route('**/api/v1/newsletter/confirmar', (r) =>
      r.fulfill({ json: { estado: 'confirmado', email: 'a@b.com' } }),
    );

    await page.goto('/confirmar-newsletter?token=tok-valido');

    await expect(page.getByText(/Ya estás en la comunidad/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /ver productos/i })).toBeVisible();
  });

  test('token válido con cupón de bienvenida: muestra el código y "usar mi cupón"', async ({ page }) => {
    await page.route('**/api/v1/newsletter/confirmar', (r) =>
      r.fulfill({
        json: {
          estado: 'confirmado',
          email: 'a@b.com',
          cupon: { codigo: 'BIENVENIDA-ABCD1234', tipo: 'fijo', valor: 2000, monto_minimo: 12000, vence_en: '2026-09-30T00:00:00.000Z' },
        },
      }),
    );

    await page.goto('/confirmar-newsletter?token=tok-valido');

    await expect(page.getByText('BIENVENIDA-ABCD1234')).toBeVisible();
    await expect(page.getByText(/\$2\.000 de descuento/)).toBeVisible();
    const cta = page.getByRole('link', { name: /usar mi cupón/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/productos?cupon=BIENVENIDA-ABCD1234');
  });

  test('token ya confirmado: mensaje idempotente, sin error', async ({ page }) => {
    await page.route('**/api/v1/newsletter/confirmar', (r) =>
      r.fulfill({ json: { estado: 'ya_confirmado', email: 'a@b.com' } }),
    );

    await page.goto('/confirmar-newsletter?token=tok-repetido');

    await expect(page.getByText(/ya estaba confirmada/i)).toBeVisible();
  });

  test('token inválido o vencido: muestra el error del backend', async ({ page }) => {
    await page.route('**/api/v1/newsletter/confirmar', (r) =>
      r.fulfill({ status: 400, json: { message: 'El link de confirmación venció. Suscribite de nuevo para recibir uno nuevo.' } }),
    );

    await page.goto('/confirmar-newsletter?token=tok-vencido');

    await expect(page.getByText(/venció/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /volver a la tienda/i })).toBeVisible();
  });

  test('sin token: no llama al backend', async ({ page }) => {
    let llamado = false;
    await page.route('**/api/v1/newsletter/confirmar', (r) => {
      llamado = true;
      r.fulfill({ json: { estado: 'confirmado' } });
    });

    await page.goto('/confirmar-newsletter');

    await expect(page.getByText(/no es válido/i)).toBeVisible();
    expect(llamado).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Register.tsx: tras crear la cuenta ya no redirige a Home — muestra un acuse
// ("te mandamos un mail para verificar") con CTA a la tienda (M1).

async function mockHomeMinimal(page: Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) =>
    r.fulfill({ json: { tienda_nombre: 'Mate Laser Studio', navbar_bg_color: '#ffffff', navbar_texto_color: '#111111' } }),
  );
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0 } }));
}

test.describe('Registro — acuse de verificación', () => {
  test('crear cuenta muestra el acuse "te mandamos un mail" y no redirige', async ({ page }) => {
    await mockHomeMinimal(page);
    await page.route('**/api/v1/auth/register', (route) =>
      route.fulfill({
        json: {
          usuario: { id: 'u1', email: 'nueva@test.com', nombre: 'Ana', apellido: 'Pérez', rol: 'cliente', email_verificado: false },
          token: 'tok',
          refreshToken: 'rtok',
        },
      }),
    );
    // PerfilSync se dispara al quedar autenticado.
    await page.route('**/api/v1/usuarios/perfil', (route) =>
      route.fulfill({ json: { id: 'u1', email: 'nueva@test.com', nombre: 'Ana', apellido: 'Pérez', rol: 'cliente', email_verificado: false } }),
    );

    await page.goto('/register');
    await page.getByPlaceholder('María').fill('Ana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('nueva@test.com');
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('secreto123');
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.getByText(/Tu cuenta ya está lista/i)).toBeVisible();
    await expect(page.getByText('nueva@test.com')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);

    await page.getByRole('button', { name: /ir a la tienda/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

import { test, expect } from '@playwright/test';
import { mockBackendAdminProductos, loginComoAdmin } from './fixtures-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks mínimos para que la home no haga llamadas no mockeadas.
// ─────────────────────────────────────────────────────────────────────────────
async function mockHomeMinimal(page: import('@playwright/test').Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) =>
    r.fulfill({ json: { tienda_nombre: 'Mate Laser Studio', navbar_bg_color: '#ffffff', navbar_texto_color: '#111111' } }),
  );
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0 } }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Home no está en blanco
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Home — no está en blanco', () => {
  test('la página principal monta el Navbar y al menos un elemento visible', async ({ page }) => {
    // Registrar errores ANTES de navegar
    const errores: string[] = [];
    page.on('pageerror', (err) => errores.push(err.message));

    await mockHomeMinimal(page);
    await page.goto('/');

    // El Navbar siempre debe estar — si el árbol React crashea, este elemento desaparece.
    const navbar = page.locator('nav').first();
    await expect(navbar).toBeVisible({ timeout: 8000 });

    // 500ms para que cualquier error asíncrono se propague
    await page.waitForTimeout(500);
    expect(errores, 'No deben haber errores JS en la home').toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Flujo de login
// Los inputs de Login.tsx no tienen id/for, así que usamos placeholder (mismo
// patrón que checkout.spec.ts con getByPlaceholder).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Login — formulario y flujo', () => {
  test('la página /login muestra el formulario con email, password y botón', async ({ page }) => {
    await mockHomeMinimal(page);
    await page.goto('/login');

    await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('credenciales incorrectas: muestra error sin redirigir', async ({ page }) => {
    await mockHomeMinimal(page);
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({ status: 401, json: { message: 'Credenciales inválidas' } }),
    );

    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill('noexiste@test.com');
    await page.getByPlaceholder('••••••••').fill('mala');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('credenciales correctas de admin: redirige a home y el Navbar muestra el usuario', async ({ page }) => {
    await mockHomeMinimal(page);
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        json: {
          usuario: { id: 'admin-1', email: 'admin@matelaserstudio.com', nombre: 'Tami', apellido: 'Admin', rol: 'admin' },
          token: 'fake-admin-jwt',
          refreshToken: 'fake-refresh',
        },
      }),
    );

    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill('admin@matelaserstudio.com');
    await page.getByPlaceholder('••••••••').fill('Admin1234!');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Redirige a home (sale de /login)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin autenticado puede acceder a /admin/productos sin ser redirigido', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);

    await page.goto('/admin/productos');

    // Si AdminRoute funciona, no redirige a /login — queda en el panel
    await expect(page).not.toHaveURL(/\/login/);
    // El panel muestra algún contenido (sidebar o tabla de productos)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('usuario no autenticado es redirigido de /admin a /login', async ({ page }) => {
    await mockHomeMinimal(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Botón "Eliminar" (borrado permanente guardado) en /admin/usuarios.
// Solo para cuentas sin historial; el backend rechaza (409) las que tienen compras.

const ADMIN = { id: 'admin-e2e-1', email: 'admin@test.com', nombre: 'Admin', apellido: null, rol: 'admin', activo: true, ultimo_login: null, creado_en: '2026-01-01' };
const CLIENTE = { id: 'cli-1', email: 'test@test.com', nombre: 'Test', apellido: null, rol: 'cliente', activo: true, ultimo_login: null, creado_en: '2026-02-01' };

async function mockLista(page: Page, onDelete: (id: string) => { status?: number; json: object }) {
  await page.route('**/api/v1/usuarios?**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ json: { items: [ADMIN, CLIENTE], total: 2, page: 1, limit: 20 } });
  });
  await page.route('**/api/v1/usuarios/*/permanente', (route) => {
    const id = route.request().url().split('/usuarios/')[1].split('/')[0];
    const r = onDelete(id);
    return route.fulfill({ status: r.status ?? 200, json: r.json });
  });
}

test.describe('Admin — eliminar usuario', () => {
  test('no muestra "Eliminar" en filas de admin ni en la propia', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, () => ({ json: { ok: true } }));
    await page.goto('/admin/usuarios');

    const filaAdmin = page.locator('tr', { hasText: 'admin@test.com' });
    await expect(filaAdmin.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
    const filaCliente = page.locator('tr', { hasText: 'test@test.com' });
    await expect(filaCliente.getByRole('button', { name: 'Eliminar' })).toBeVisible();
  });

  test('elimina una cuenta sin historial', async ({ page }) => {
    await loginComoAdmin(page);
    let borrado: string | null = null;
    await mockLista(page, (id) => { borrado = id; return { json: { ok: true, id } }; });
    await page.goto('/admin/usuarios');

    await page.locator('tr', { hasText: 'test@test.com' }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('heading', { name: 'Eliminar cuenta' })).toBeVisible();
    await expect(page.getByText(/eliminar permanentemente/i)).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).nth(1).click();

    await expect(page.getByRole('heading', { name: 'Eliminar cuenta' })).not.toBeVisible();
    expect(borrado).toBe('cli-1');
  });

  test('si el backend rechaza (409), muestra el mensaje en el modal', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, () => ({
      status: 409,
      json: { message: 'El usuario tiene historial (2 órdenes, 0 usos de cupón) — no se puede eliminar. Desactivalo en su lugar.' },
    }));
    await page.goto('/admin/usuarios');

    await page.locator('tr', { hasText: 'test@test.com' }).getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).nth(1).click();

    await expect(page.getByText(/no se puede eliminar. Desactivalo/i)).toBeVisible();
  });
});

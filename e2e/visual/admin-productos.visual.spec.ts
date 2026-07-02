import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from '../fixtures-admin';

test.describe('Visual — admin modal de edición de producto', () => {
  test.beforeEach(async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.goto('/admin/productos');
  });

  test('listado de productos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
    await expect(page).toHaveScreenshot('listado.png');
  });

  test('modal de edición abierto, tab datos', async ({ page }) => {
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
    await expect(page).toHaveScreenshot('modal-editar.png');
  });
});

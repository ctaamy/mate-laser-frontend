import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// AdminProductos.tsx → handleSubmit (línea ~133) llama a api.put(...) sin
// try/catch. Si el backend responde con error (ej. validación, 500), la
// promesa rechaza sin manejo: cerrarModal() nunca se ejecuta y no se le
// muestra nada al usuario. El botón "Guardar producto" parece "no hacer
// nada" — ese es el bug reportado.

test.describe('Admin — editar producto', () => {
  test('abre el modal de edición con los datos del producto cargados', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);

    await page.goto('/admin/productos');
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();

    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
    await expect(page.getByPlaceholder('Mate acero grabado personalizado')).toHaveValue(PRODUCTO_ADMIN_MOCK.nombre);
    await expect(page.getByPlaceholder('MLS-ACE-001')).toHaveValue(PRODUCTO_ADMIN_MOCK.sku);

    const btnGuardar = page.getByRole('button', { name: 'Guardar producto' });
    await expect(btnGuardar).toBeVisible();
    await expect(btnGuardar).toBeEnabled();
  });

  test('guardar con éxito: persiste cambios y cierra el modal', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page, { putStatus: 200 });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();

    await page.getByPlaceholder('Mate acero grabado personalizado').fill('Mate Imperial Grabado PRO');
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.getByRole('heading', { name: 'Editar producto' })).not.toBeVisible();
  });

  test('BUG: si el backend rechaza el guardado, el modal queda trabado sin avisar al usuario', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page, { putStatus: 400 });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();

    await page.getByRole('button', { name: 'Guardar producto' }).click();
    await page.waitForTimeout(300); // da tiempo a que la promesa rechace

    // Este assert documenta el bug: hoy el modal sigue abierto y no hay
    // ningún mensaje de error visible para el usuario. Si el bug se arregla
    // (se agrega manejo de error con mensaje visible), este test debe
    // actualizarse para esperar ese mensaje en vez de este estado "trabado".
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
    await expect(page.getByText(/error|no se pudo/i)).not.toBeVisible();
  });

  test('toggle apto_grabado: muestra/oculta costo de grabado y colores', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();

    await expect(page.getByText('Costo del grabado')).toBeVisible();
    await expect(page.getByText('Colores de grabado')).toBeVisible();

    // El toggle de "Apto grabado láser" es el primer switch dentro del modal
    await page.locator('.w-9.h-5.rounded-full').first().click();

    await expect(page.getByText('Costo del grabado')).not.toBeVisible();
    await expect(page.getByText('Colores de grabado')).not.toBeVisible();
  });
});

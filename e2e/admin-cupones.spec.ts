import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 7: antes solo se podía crear o eliminar un cupón;
// para cambiar el monto mínimo o extender un vencimiento había que borrar
// y recrear, perdiendo el conteo de usos_realizados. Ahora hay edición
// (PUT /cupones/:id, ya existía en el backend — solo faltaba cablearlo en
// el admin) que preserva usos_realizados y el resto del historial.

const CUPON_MOCK = {
  id: 'cupon-edit-1', codigo: 'VERANO10', tipo: 'porcentaje', valor: 10,
  monto_minimo: 5000, max_usos: 100, usos_realizados: 37,
  vence_en: '2026-12-31T00:00:00.000Z', activo: true,
};

async function mockCupones(page: import('@playwright/test').Page, onPut: (body: any) => void) {
  await page.route('**/api/v1/cupones', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: [CUPON_MOCK] });
  });
  await page.route(`**/api/v1/cupones/${CUPON_MOCK.id}`, (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    onPut(route.request().postDataJSON());
    return route.fulfill({ json: { ...CUPON_MOCK, ...route.request().postDataJSON() } });
  });
}

test.describe('Admin — editar cupón existente', () => {
  test('abre el modal de edición con los datos del cupón precargados', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCupones(page, () => {});

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON_MOCK.codigo }).getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Editar cupón' })).toBeVisible();
    await expect(page.getByPlaceholder('MATE10')).toHaveValue('VERANO10');
    await expect(page.getByPlaceholder('5000')).toHaveValue('5000');
    await expect(page.getByPlaceholder('Sin límite')).toHaveValue('100');
  });

  test('guardar cambios persiste la edición sin pisar usos_realizados', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockCupones(page, (body) => { putBody = body; });

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON_MOCK.codigo }).getByRole('button').first().click();

    const montoMinimoInput = page.getByPlaceholder('5000');
    await montoMinimoInput.fill('8000');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('heading', { name: 'Editar cupón' })).not.toBeVisible();
    expect(putBody.monto_minimo).toBe(8000);
    expect(putBody).not.toHaveProperty('usos_realizados');
  });

  test('permite desactivar el cupón desde el modal de edición', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockCupones(page, (body) => { putBody = body; });

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON_MOCK.codigo }).getByRole('button').first().click();

    // Dos niveles arriba: "Cupón activo" está en un div de label, cuyo
    // padre (el flex container) es el que también tiene el botón toggle.
    await page.getByText('Cupón activo', { exact: true }).locator('..').locator('..').locator('button').click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    expect(putBody.activo).toBe(false);
  });

  test('crear un cupón nuevo sigue mostrando "Crear cupón" (no se mezcla con edición)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCupones(page, () => {});

    await page.goto('/admin/cupones');
    await page.getByRole('button', { name: 'Nuevo cupón' }).click();

    await expect(page.getByRole('heading', { name: 'Nuevo cupón' })).toBeVisible();
    await expect(page.getByPlaceholder('MATE10')).toHaveValue('');
    // El toggle "Cupón activo" solo aplica a edición.
    await expect(page.getByText('Cupón activo', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear cupón' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// F2 — botón "Agregar método de envío" + edición de la ubicación de un punto
// de retiro en /admin/envios. Los campos del admin no tienen <label for>, así
// que se targetean por placeholder / rol.

const RETIRO_SIN_UBICACION = {
  id: 7, nombre: 'Retiro por sucursal', proveedor: 'retiro', descripcion: '',
  costo_fijo: 0, activo: true, api_conectada: false, orden: 1, ubicacion: null,
};

async function mockEnvios(
  page: import('@playwright/test').Page,
  hooks: { onPost?: (body: any) => void; onPut?: (id: string, body: any) => void } = {},
) {
  await page.route('**/api/v1/envios/admin/todos', (route) =>
    route.fulfill({ json: [RETIRO_SIN_UBICACION] }),
  );
  await page.route('**/api/v1/envios/precios-zona', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/configuracion', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/v1/envios', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    hooks.onPost?.(body);
    return route.fulfill({ json: { id: 99, ...body } });
  });
  await page.route(/\/api\/v1\/envios\/\d+$/, (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const body = route.request().postDataJSON();
    hooks.onPut?.(route.request().url().split('/').pop()!, body);
    return route.fulfill({ json: { ...RETIRO_SIN_UBICACION, ...body } });
  });
}

test.describe('Admin — agregar método de envío', () => {
  test('crea un punto de retiro con su ubicación (POST /envios con el body correcto)', async ({ page }) => {
    await loginComoAdmin(page);
    let postBody: any = null;
    await mockEnvios(page, { onPost: (b) => { postBody = b; } });

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Agregar método de envío' }).click();

    await page.getByPlaceholder('Ej: Retiro en Villa Crespo').fill('Retiro en Villa Crespo');
    // proveedor "retiro" es el default → aparecen los campos de ubicación
    await page.getByPlaceholder('Ej: Larrea 324').fill('Av. Corrientes 5400');
    await page.getByPlaceholder('Ej: Once').fill('Villa Crespo');
    await page.getByPlaceholder('Ej: CABA').fill('CABA');
    await page.getByPlaceholder('Ej: Lun a Vie de 9 a 18 h').fill('Lun a Vie de 10 a 18 h');

    await page.getByRole('button', { name: 'Crear método' }).click();

    await expect.poll(() => postBody).not.toBeNull();
    expect(postBody).toMatchObject({
      nombre: 'Retiro en Villa Crespo',
      proveedor: 'retiro',
      ubicacion: {
        direccion: 'Av. Corrientes 5400',
        localidad: 'Villa Crespo',
        partido: 'CABA',
        horarios: 'Lun a Vie de 10 a 18 h',
      },
    });
  });

  test('no deja crear un retiro activo sin ubicación completa', async ({ page }) => {
    await loginComoAdmin(page);
    await mockEnvios(page);

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Agregar método de envío' }).click();
    await page.getByPlaceholder('Ej: Retiro en Villa Crespo').fill('Retiro incompleto');

    // Activo (default off en el form) + sin dirección → botón deshabilitado
    await page.locator('label:has-text("Activo")').getByRole('button').click();
    await expect(page.getByRole('button', { name: 'Crear método' })).toBeDisabled();

    // Completando la ubicación se habilita
    await page.getByPlaceholder('Ej: Larrea 324').fill('Larrea 324');
    await page.getByPlaceholder('Ej: Once').fill('Once');
    await page.getByPlaceholder('Ej: CABA').fill('CABA');
    await expect(page.getByRole('button', { name: 'Crear método' })).toBeEnabled();
  });

  test('un tipo con API (Correo) esconde los campos de retiro y habilita costo fijo', async ({ page }) => {
    await loginComoAdmin(page);
    await mockEnvios(page);

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Agregar método de envío' }).click();
    await page.getByRole('combobox').selectOption('correo');

    await expect(page.getByPlaceholder('Ej: Larrea 324')).toHaveCount(0);
    await expect(page.getByPlaceholder('0')).toBeEnabled();
  });

  test('edita la ubicación de un punto de retiro existente (PUT /envios/:id con { ubicacion })', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockEnvios(page, { onPut: (_id, b) => { putBody = b; } });

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Agregar ubicación' }).click();
    await page.getByPlaceholder('Ej: Larrea 324').fill('Larrea 324');
    await page.getByPlaceholder('Ej: Once').fill('Once');
    await page.getByPlaceholder('Ej: CABA').fill('CABA');
    await page.getByRole('button', { name: 'Guardar ubicación' }).click();

    await expect.poll(() => putBody).not.toBeNull();
    expect(putBody).toEqual({
      ubicacion: { direccion: 'Larrea 324', localidad: 'Once', partido: 'CABA' },
    });
  });
});

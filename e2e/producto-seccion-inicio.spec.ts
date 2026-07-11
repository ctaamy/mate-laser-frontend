import { test, expect } from '@playwright/test';
import { loginComoAdmin, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// BUG: "al tildar la opción de aparecer en un bloque dentro del producto, no
// aparece en el inicio". Causa raíz: el checklist "Aparece en secciones del
// inicio" (Productos.tsx) leía y basaba su guardado en /configuracion/homepage
// (PUBLICADO), pero el PUT de ese endpoint siempre escribe en BORRADOR — el
// producto quedaba guardado en un borrador invisible para el sitio público
// hasta publicar, sin ningún aviso. Fix: leer/basar el guardado en
// /configuracion/homepage/borrador (mismo estado que usa el resto del
// homepage builder) y mostrar un aviso explícito de que falta publicar.

const CATEGORIAS = [{ id: 1, nombre: 'Mates' }];

const SECCION_DESTACADOS = {
  id: 'sec-destacados-1', tipo: 'productos_destacados', activo: true, orden: 0,
  datos: { titulo: 'Lo más vendido', productos_ids: [] as string[] },
};

async function mockBase(page: import('@playwright/test').Page, seccionesBorrador: any[]) {
  await page.route('**/api/v1/productos/admin/todos**', (route) =>
    route.fulfill({ json: { data: [PRODUCTO_ADMIN_MOCK], total: 1 } }),
  );
  await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
  await page.route(`**/api/v1/imagenes/producto/${PRODUCTO_ADMIN_MOCK.id}`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/v1/productos/${PRODUCTO_ADMIN_MOCK.id}`, (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    return route.fulfill({ json: { ...PRODUCTO_ADMIN_MOCK, ...route.request().postDataJSON() } });
  });
  // Publicado deliberadamente distinto del borrador, para poder detectar si
  // el checklist/guardado usa por error el endpoint publicado.
  await page.route(/\/api\/v1\/configuracion\/homepage$/, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    return route.continue();
  });
  await page.route(/\/api\/v1\/configuracion\/homepage\/borrador$/, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: seccionesBorrador });
    return route.continue();
  });
}

test.describe('Bugfix — checklist "Aparece en secciones del inicio" usa el borrador, no lo publicado', () => {
  test('el checklist se completa con lo que ya está en el BORRADOR, no con lo publicado', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBase(page, [{ ...SECCION_DESTACADOS, datos: { ...SECCION_DESTACADOS.datos, productos_ids: [PRODUCTO_ADMIN_MOCK.id] } }]);

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();

    const checkbox = page.getByText('Lo más vendido').locator('xpath=ancestor::label[1]').getByRole('checkbox');
    await expect(checkbox).toBeChecked();
  });

  test('tildar el checkbox y guardar hace PUT contra el homepage (que el backend escribe a borrador) y muestra el aviso de publicar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBase(page, [SECCION_DESTACADOS]);

    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();

    const checkbox = page.getByText('Lo más vendido').locator('xpath=ancestor::label[1]').getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await page.getByRole('button', { name: 'Guardar producto' }).click();

    await expect(page.getByRole('heading', { name: 'Editar producto' })).not.toBeVisible();
    expect(putBody).not.toBeNull();
    const seccionActualizada = putBody.secciones.find((s: any) => s.id === SECCION_DESTACADOS.id);
    expect(seccionActualizada.datos.productos_ids).toContain(PRODUCTO_ADMIN_MOCK.id);

    await expect(page.getByText(/publicá los cambios/i)).toBeVisible();
  });

  test('destildar el checkbox lo quita de productos_ids', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBase(page, [{ ...SECCION_DESTACADOS, datos: { ...SECCION_DESTACADOS.datos, productos_ids: [PRODUCTO_ADMIN_MOCK.id] } }]);

    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();

    const checkbox = page.getByText('Lo más vendido').locator('xpath=ancestor::label[1]').getByRole('checkbox');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await page.getByRole('button', { name: 'Guardar producto' }).click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).not.toBeVisible();

    const seccionActualizada = putBody.secciones.find((s: any) => s.id === SECCION_DESTACADOS.id);
    expect(seccionActualizada.datos.productos_ids).not.toContain(PRODUCTO_ADMIN_MOCK.id);
  });

  test('sin cambios en el checklist, guardar el producto no toca el homepage ni muestra el aviso', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBase(page, [SECCION_DESTACADOS]);

    let putLlamado = false;
    await page.route(/\/api\/v1\/configuracion\/homepage$/, (route) => {
      if (route.request().method() === 'PUT') { putLlamado = true; return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Guardar producto' }).click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).not.toBeVisible();

    expect(putLlamado).toBe(false);
    await expect(page.getByText(/publicá los cambios/i)).not.toBeVisible();
  });
});

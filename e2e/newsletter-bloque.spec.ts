import { test, expect } from '@playwright/test';

// Bloque newsletter (nuevo, addable/reordenable como cualquier otro bloque
// del home builder): título/subtítulo editables, input de email + botón,
// POST a /newsletter/suscribir con manejo de estados éxito/ya-suscripto/error.

async function mockHome(page: import('@playwright/test').Page, secciones: any[]) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const BASE = { id: 'nl-1', tipo: 'newsletter', activo: true, orden: 0 };

test.describe('Bloque newsletter', () => {
  test('renderiza título, subtítulo, input y botón (con defaults si no hay datos)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.goto('/');
    await expect(page.getByText('Sumate a la comunidad')).toBeVisible();
    await expect(page.getByPlaceholder('Tu email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suscribirme' })).toBeVisible();
  });

  test('título, subtítulo, placeholder y texto de botón configurables', async ({ page }) => {
    await mockHome(page, [{
      ...BASE,
      datos: { titulo: 'Título custom', subtitulo: 'Subtítulo custom', placeholder: 'tu@correo.com', btn_texto: 'Anotarme' },
    }]);
    await page.goto('/');
    await expect(page.getByText('Título custom', { exact: true })).toBeVisible();
    await expect(page.getByText('Subtítulo custom', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anotarme' })).toBeVisible();
  });

  test('suscripción exitosa: llama al endpoint y muestra mensaje de éxito', async ({ page }) => {
    let body: any = null;
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { estado: 'suscripto' } });
    });

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('nuevo@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();

    await expect(page.getByText('¡Listo! Ya estás suscripto.')).toBeVisible();
    expect(body.email).toBe('nuevo@test.com');
  });

  test('email ya suscripto: muestra el mensaje correspondiente', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => route.fulfill({ json: { estado: 'ya_suscripto' } }));

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('repetido@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();

    await expect(page.getByText('Ese email ya estaba suscripto.')).toBeVisible();
  });

  test('error del servidor: muestra mensaje de error', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => route.fulfill({ status: 500, json: { message: 'error' } }));

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('falla@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();

    await expect(page.getByText('No pudimos suscribirte, intentá de nuevo.')).toBeVisible();
  });
});

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

  test('suscripción nueva (doble opt-in): muestra el bloque "revisá tu mail" con el email tipeado', async ({ page }) => {
    let body: any = null;
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { estado: 'pendiente' } });
    });

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('nuevo@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();

    await expect(page.getByText(/Casi listo/)).toBeVisible();
    await expect(page.getByText('nuevo@test.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reenviármelo' })).toBeVisible();
    expect(body.email).toBe('nuevo@test.com');
  });

  test('"me equivoqué de mail" vuelve a mostrar el formulario', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => route.fulfill({ json: { estado: 'pendiente' } }));

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('typo@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();
    await expect(page.getByText(/Casi listo/)).toBeVisible();

    await page.getByRole('button', { name: /Me equivoqué/ }).click();
    await expect(page.getByPlaceholder('Tu email')).toBeVisible();
  });

  test('"reenviármelo" llama a /newsletter/reenviar y entra en cooldown', async ({ page }) => {
    let reenvioBody: any = null;
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => route.fulfill({ json: { estado: 'pendiente' } }));
    await page.route(/\/api\/v1\/newsletter\/reenviar$/, (route) => {
      reenvioBody = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('reenvio@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();
    await page.getByRole('button', { name: 'Reenviármelo' }).click();

    await expect(page.getByRole('button', { name: /Reenviar en 0:/ })).toBeVisible();
    expect(reenvioBody.email).toBe('reenvio@test.com');
  });

  test('email ya suscripto: muestra el mensaje correspondiente', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.route(/\/api\/v1\/newsletter\/suscribir$/, (route) => route.fulfill({ json: { estado: 'ya_suscripto' } }));

    await page.goto('/');
    await page.getByPlaceholder('Tu email').fill('repetido@test.com');
    await page.getByRole('button', { name: 'Suscribirme' }).click();

    await expect(page.getByText(/Ese mail ya está en la lista/)).toBeVisible();
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

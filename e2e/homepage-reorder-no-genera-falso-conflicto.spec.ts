import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Regresión: el drag&drop de secciones (PATCH /homepage/orden) actualiza
// `actualizado` en el borrador por su propio camino, sin pasar por
// guardarHomepageMutation. Si el baseline de conflicto multi-pestaña no se
// refresca ahí también, el siguiente autosave/guardado manual se compara
// contra un valor viejo y dispara el banner de "conflicto" por error —
// aunque haya sido la misma pestaña la que reordenó. Ver Configuracion.tsx,
// onSuccess de reordenarMutation.

const SEC_A = { id: 'sec-a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A' } };
const SEC_B = { id: 'sec-b', tipo: 'banner_texto', activo: true, orden: 1, datos: { texto: 'B' } };

test('reordenar secciones y guardar después no dispara el banner de conflicto multi-pestaña', async ({ page }) => {
  await loginComoAdmin(page);

  // El backend real cambia `actualizado` en cada escritura (PUT homepage y
  // PATCH orden por igual). Acá lo simulamos con un contador: cada
  // request de escritura "avanza" el timestamp que después devuelve /meta.
  let actualizado = '2026-01-01T00:00:00.000Z';
  let putBody: any = null;

  await page.route(/\/api\/v1\/configuracion\/homepage\/borrador\/meta$/, (route) =>
    route.fulfill({ json: { actualizado } }),
  );
  await page.route(/\/api\/v1\/configuracion\/homepage\/orden$/, (route) => {
    actualizado = '2026-01-01T00:05:00.000Z'; // el PATCH "escribió" — el reloj avanza
    return route.fulfill({ json: [SEC_B, SEC_A] });
  });
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      putBody = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true, actualizado } });
    }
    return route.fulfill({ json: [SEC_A, SEC_B] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });

  await page.goto('/admin/configuracion');

  // Reordena con teclado (dnd-kit): foco en el primer handle, Space levanta,
  // flecha abajo mueve, Space suelta — dispara el PATCH /homepage/orden.
  const handle = page.getByRole('button', { name: 'Arrastrar para reordenar' }).first();
  await handle.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');

  await expect(page.getByText('Orden actualizado')).toBeVisible();

  // Ahora un guardado (manual, para no depender del debounce) no debería
  // ver un "conflicto" — el reorder anterior fue de esta misma pestaña.
  await page.getByRole('button', { name: 'Guardar inicio' }).click();

  await expect(page.getByTestId('conflicto-multipestana-banner')).toHaveCount(0);
  await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
  expect(putBody).toBeTruthy();
});

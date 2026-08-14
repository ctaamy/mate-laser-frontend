import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 4 del Page Builder de Inicio: detección de conflicto multi-pestaña.
// Al cargar el tab "Inicio" se guarda el `actualizado` de
// GET /configuracion/homepage/borrador/meta como baseline. Antes de cada
// guardado (autosave o manual) se vuelve a pedir y, si cambió, se corta el
// guardado y se muestra un banner bloqueante — sin merge automático.

const HERO = {
  id: 'hero-conflicto-1', tipo: 'hero', activo: true, orden: 0,
  datos: { slides: [{ titulo: 'Hola' }] },
};

test.describe('Conflicto multi-pestaña en el borrador de Inicio', () => {
  test('si el "actualizado" remoto cambió respecto al baseline, no guarda y muestra el banner bloqueante', async ({ page }) => {
    await loginComoAdmin(page);

    let metaLlamadas = 0;
    let putLlamado = false;
    await page.route(/\/api\/v1\/configuracion\/homepage\/borrador\/meta$/, (route) => {
      metaLlamadas++;
      // 1er llamado (baseline al cargar): t1. Cualquier llamado posterior
      // (antes de guardar): t2 — simula que otra pestaña guardó primero.
      const actualizado = metaLlamadas === 1 ? '2026-01-01T00:00:00.000Z' : '2026-01-01T00:05:00.000Z';
      return route.fulfill({ json: { actualizado } });
    });
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putLlamado = true;
        return route.fulfill({ json: { ok: true, actualizado: '2026-01-01T00:05:00.000Z' } });
      }
      return route.fulfill({ json: [HERO] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    await expect(page.getByRole('button', { name: 'Guardar inicio' })).toBeEnabled();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();

    await expect(page.getByTestId('conflicto-multipestana-banner')).toBeVisible();
    await expect(page.getByText('Este borrador se editó en otra pestaña.')).toBeVisible();
    expect(putLlamado).toBe(false);

    // El botón "Guardar inicio" queda deshabilitado tras el conflicto — no
    // tiene sentido seguir intentando guardar sin recargar primero.
    await expect(page.getByRole('button', { name: 'Guardar inicio' })).toBeDisabled();
  });

  test('si el "actualizado" remoto no cambió, guarda con normalidad (sin banner)', async ({ page }) => {
    await loginComoAdmin(page);

    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage\/borrador\/meta$/, (route) =>
      route.fulfill({ json: { actualizado: '2026-01-01T00:00:00.000Z' } }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true, actualizado: '2026-01-01T00:00:01.000Z' } });
      }
      return route.fulfill({ json: [HERO] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Guardar inicio' }).click();

    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    await expect(page.getByTestId('conflicto-multipestana-banner')).toHaveCount(0);
    expect(putBody).toBeTruthy();
  });
});

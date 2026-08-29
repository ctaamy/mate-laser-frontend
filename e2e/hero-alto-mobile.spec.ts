import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Pedido de la dueña: en mobile el Hero ocupaba casi toda la pantalla (90vh
// por defecto) y no dejaba ver nada de la sección de abajo como para dar
// ganas de seguir scrolleando. Se agrega datos.min_height_mobile (opcional):
// sin configurar, mobile sigue usando el mismo alto que desktop
// (comportamiento histórico, no rompe heroes ya publicados); con un valor
// propio, solo cambia en pantallas chicas — desktop sigue usando el "Alto
// mínimo del bloque" de siempre.
// Implementación: min-h-[var(--hero-min-h-mobile)] / md:min-h-[var(--...)]
// en vez de un solo `style.minHeight` — un inline style siempre gana contra
// una clase, así que el único modo de que "md:" pueda pisar el valor de
// mobile es que los dos lados sean clases. Ver SeccionHero en HomeSecciones.tsx.

async function mockHome(page: import('@playwright/test').Page, seccion: any, onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: [seccion] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

function heroLocator(page: import('@playwright/test').Page) {
  return page.getByRole('heading', { level: 1 })
    .locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"overflow-hidden")][last()]');
}

test.describe('Hero — alto propio en mobile', () => {
  test('sin min_height_mobile: mobile usa el mismo alto que desktop (sin cambios)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }], min_height: '700' },
    });
    await page.goto('/');

    const box = await heroLocator(page).boundingBox();
    expect(box?.height ?? 0).toBeCloseTo(700, 0);
  });

  test('con min_height_mobile: en mobile usa ese valor, no el de desktop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }], min_height: '700', min_height_mobile: '480' },
    });
    await page.goto('/');

    const box = await heroLocator(page).boundingBox();
    expect(box?.height ?? 0).toBeCloseTo(480, 0);
  });

  test('con min_height_mobile: en desktop se ignora, sigue usando el "Alto mínimo" de siempre', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }], min_height: '700', min_height_mobile: '480' },
    });
    await page.goto('/');

    const box = await heroLocator(page).boundingBox();
    expect(box?.height ?? 0).toBeCloseTo(700, 0);
  });

  test('admin: el campo "Alto mínimo en mobile" existe para hero y persiste al guardar', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }] },
    }, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const inputMobile = page.getByText('Alto mínimo en mobile', { exact: false }).locator('..').locator('input');
    await expect(inputMobile).toHaveValue('');
    await inputMobile.fill('500');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody.secciones[0].datos.min_height_mobile).toBe('500');
  });
});

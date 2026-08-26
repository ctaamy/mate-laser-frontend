import { test, expect } from '@playwright/test';

// BUG: la imagen del Hero (image_position "bleed" o "contained") colapsaba a
// 0px de alto en mobile. Causa: el contenedor solo tenía max-h-[38vh] — la
// <img> es "absolute", así que no aporta altura propia, y sin una altura
// base el contenedor (flex-col en mobile) quedaba en 0. Fix: h-[42%] (del
// hero, no del viewport — así funciona también con un "Alto mínimo" propio
// en px) en vez de max-h, cancelado por md:h-auto en desktop. Ver el div de
// la imagen dentro de HeroSlideContent en HomeSecciones.tsx.

const IMAGEN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
);

async function mockHome(page: import('@playwright/test').Page, seccion: any) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

test.describe('BUG fix — la imagen del Hero no colapsa en mobile', () => {
  test('image_position "bleed": la imagen tiene alto visible en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: IMAGEN }], image_position: 'bleed' },
    });
    await page.goto('/');

    const img = page.locator(`img[src="${IMAGEN}"]`);
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(100);
  });

  test('image_position "contained": la imagen tiene alto visible en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: IMAGEN }], image_position: 'contained' },
    });
    await page.goto('/');

    const img = page.locator(`img[src="${IMAGEN}"]`);
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(100);
  });

  test('image_position "background" en mobile sigue cubriendo todo el bloque (no regresión)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: IMAGEN }], image_position: 'background', min_height: '500' },
    });
    await page.goto('/');

    const img = page.locator(`img[src="${IMAGEN}"]`);
    const box = await img.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(500);
  });
});

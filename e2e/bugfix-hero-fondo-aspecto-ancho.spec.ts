import { test, expect } from '@playwright/test';

// BUG: el Hero con image_position "background" (imagen de fondo completa)
// usa una <img> "absolute inset-0 w-full h-full object-cover" contra un
// bloque de alto FIJO (min_height en px, o el 90vh default). En pantallas
// muy anchas eso vuelve al bloque cada vez más "panorámico" — object-cover
// recorta cada vez más arriba/abajo de la imagen para llenar ese ancho, muy
// por encima de lo que se ve en el preview del admin (que renderiza en un
// panel angosto). Reportado con un hero real: min_height:"600" se veía bien
// en el preview pero muy recortado/"zoomeado" en una pantalla de escritorio
// ancha.
//
// Fix: un tope de relación de aspecto (aspect-[12/5]) en el contenedor del
// Hero, solo para image_position "background" con imagen. El alto real
// usado pasa a ser el máximo entre min_height y ancho/2.4 — en pantallas
// angostas no cambia nada (gana min_height), en pantallas anchas el bloque
// crece en alto en vez de recortar más la imagen.
// Ver SeccionHero en HomeSecciones.tsx.

const IMAGEN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
);

async function mockHome(page: import('@playwright/test').Page, seccion: any) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const HERO_FONDO_MINHEIGHT_FIJO = {
  id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
  datos: {
    slides: [{ titulo: 'Hola', imagen_url: IMAGEN }],
    image_position: 'background', min_height: '600',
  },
};

test.describe('BUG fix — Hero "Fondo" no recorta tanto en pantallas anchas', () => {
  test('pantalla angosta (1280px): respeta min_height tal cual, sin cambios', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockHome(page, HERO_FONDO_MINHEIGHT_FIJO);
    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"overflow-hidden")][last()]');
    const box = await hero.boundingBox();
    expect(box?.height ?? 0).toBeCloseTo(600, 0);
  });

  test('pantalla ancha (1920px): el bloque crece en alto en vez de quedar en 600px fijo', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await mockHome(page, HERO_FONDO_MINHEIGHT_FIJO);
    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"overflow-hidden")][last()]');
    const box = await hero.boundingBox();
    // 1920 / 2.4 = 800 — bien por encima del min_height fijo de 600.
    expect(box?.height ?? 0).toBeGreaterThan(700);
  });

  test('image_position "bleed" (no "background"): el ancho de pantalla no le agranda el alto', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await mockHome(page, {
      ...HERO_FONDO_MINHEIGHT_FIJO,
      datos: { ...HERO_FONDO_MINHEIGHT_FIJO.datos, image_position: 'bleed' },
    });
    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"overflow-hidden")][last()]');
    const box = await hero.boundingBox();
    expect(box?.height ?? 0).toBeCloseTo(600, 0);
  });
});

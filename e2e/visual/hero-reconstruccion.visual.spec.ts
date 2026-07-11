import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Reconstrucción del bloque Hero: eyebrow, título y subtítulo totalmente
// configurables (color/peso/fuente/tamaño), overlay_direction +
// overlay_intensity (reemplaza el blend lateral hardcodeado y el viejo
// overlay_color/overlay_opacidad), image_position (contained/bleed/background).
// Cubre las dos combinaciones principales pedidas: bleed + left, background + full.

const IMAGEN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
);

async function mockHome(page: import('@playwright/test').Page, seccion: any, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('Visual — Hero reconstruido', () => {
  test('image_position: bleed + overlay_direction: left', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: {
        slides: [{
          eyebrow: 'Grabado láser de precisión',
          titulo: 'Mates únicos,\nhechos a tu medida',
          subtitulo: 'Personalizamos cada pieza con tu diseño.',
          imagen_url: IMAGEN,
          btn_texto: 'Ver colección', btn_link: '/productos',
        }],
        image_position: 'bleed',
        overlay_direction: 'left',
        overlay_intensity: 60,
      },
    });
    await page.goto('/');
    await expect(page).toHaveScreenshot('hero-bleed-left.png');
  });

  test('image_position: background + overlay_direction: full', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: {
        slides: [{
          eyebrow: 'Grabado láser de precisión',
          titulo: 'Mates únicos,\nhechos a tu medida',
          subtitulo: 'Personalizamos cada pieza con tu diseño.',
          imagen_url: IMAGEN,
          btn_texto: 'Ver colección', btn_link: '/productos',
        }],
        image_position: 'background',
        overlay_direction: 'full',
        overlay_intensity: 50,
      },
    });
    await page.goto('/');
    // La imagen de fondo cubre el 100% del viewport — la animación de escala
    // (motion, JS-driven) tarda ~1s; se espera a que termine antes de comparar,
    // porque a esta escala hasta 1px de desfase mueve muchos más píxeles que
    // en el layout partial-width de "bleed".
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('hero-background-full.png');
  });
});

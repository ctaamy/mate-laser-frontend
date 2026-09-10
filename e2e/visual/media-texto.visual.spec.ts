import { test, expect } from '@playwright/test';

// Screenshots de baseline del bloque media_texto (carrusel + columna de
// texto Markdown). Se generan con `npm run test:visual:update` y luego
// detectan cambios visuales no intencionales. Cubre: imagen a la izquierda
// y a la derecha en desktop, y el apilado texto-primero en mobile.
//
// Se emula prefers-reduced-motion: el bloque respeta ese modo y renderiza
// en estado final sin animación de entrada — así el screenshot es
// determinista sin depender de un waitForTimeout frágil.

const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/><circle cx="400" cy="300" r="120" fill="#c98a5c"/></svg>',
);

async function mockHome(page: import('@playwright/test').Page, datos: Record<string, any>) {
  const seccion = { id: 'mt-1', tipo: 'media_texto', activo: true, orden: 0, datos };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const DATOS_BASE = {
  slides: [{ imagen_url: IMG, alt: 'Taller' }],
  eyebrow: 'El taller',
  titulo: 'Grabamos cada mate\na mano, uno por uno',
  subtitulo: 'Láser sobre acero, madera y acrílico. En Buenos Aires.',
  cuerpo_md: 'Te mostramos **cómo queda el grabado** antes de hacerlo.\n\n- Envíos a todo el país\n- Retiro por el taller',
  botones: [{ texto: 'Conocé el taller', link: '/nosotros' }],
  bg_color: '#faf7f3', texto_color: '#1a1a1a',
};

test.describe('Visual — bloque media_texto', () => {
  test('imagen a la izquierda (desktop)', async ({ page }) => {
    await mockHome(page, { ...DATOS_BASE, media_side: 'left' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('media-texto-imagen-izquierda.png');
  });

  test('imagen a la derecha (desktop)', async ({ page }) => {
    await mockHome(page, { ...DATOS_BASE, media_side: 'right' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('media-texto-imagen-derecha.png');
  });

  test('mobile — texto primero, imagen debajo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockHome(page, { ...DATOS_BASE, media_side: 'left' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page).toHaveScreenshot('media-texto-mobile.png');
  });
});

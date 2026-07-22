import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Transición configurable entre bloques (transicion_inferior): degradado,
// curva, diagonal, ondulada — reemplaza el corte plano entre un bloque
// oscuro y uno claro (o viceversa) usando solo el color propio del bloque
// (TransicionInferior.tsx), sin depender de conocer el color del vecino.

async function mockHome(page: import('@playwright/test').Page, secciones: any[]) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const OSCURO_A_CLARO = (transicion: string) => [
  { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Bloque oscuro', bg_color: '#0a2218', texto_color: '#ffffff', padding: 'lg', transicion_inferior: transicion } },
  { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>Bloque claro</p>', bg_color: '#ffffff', padding: 'lg' } },
];

test.describe('Visual — transición entre bloques', () => {
  test('degradado: oscuro → claro', async ({ page }) => {
    await mockHome(page, OSCURO_A_CLARO('degradado'));
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-degradado.png');
  });

  test('curva: oscuro → claro', async ({ page }) => {
    await mockHome(page, OSCURO_A_CLARO('curva'));
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-curva.png');
  });

  test('diagonal: oscuro → claro', async ({ page }) => {
    await mockHome(page, OSCURO_A_CLARO('diagonal'));
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-diagonal.png');
  });

  test('ondulada: claro → oscuro (dirección inversa de contraste)', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Bloque claro', bg_color: '#ffffff', texto_color: '#111111', padding: 'lg', transicion_inferior: 'ondulada' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>Bloque oscuro</p>', bg_color: '#0a2218', padding: 'lg' } },
    ]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-ondulada-inversa.png');
  });

  test('ninguna (default): sin cambios, corte plano de siempre', async ({ page }) => {
    await mockHome(page, OSCURO_A_CLARO('ninguna'));
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-ninguna.png');
  });

  test('bugfix: bloque con imagen de fondo (Hero) — la forma arranca de un borde sólido, no queda cortada sobre la foto', async ({ page }) => {
    const imagen = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
    );
    await mockHome(page, [
      {
        id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
        datos: {
          slides: [{ titulo: 'Hola', imagen_url: imagen }],
          image_position: 'background', bg_color: '#0a2218', texto_color: '#ffffff',
          transicion_inferior: 'curva',
        },
      },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>Bloque claro</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('transicion-hero-con-imagen.png');
  });
});

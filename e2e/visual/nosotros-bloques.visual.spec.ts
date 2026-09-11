import { test, expect } from '@playwright/test';

// Baselines de la página /nosotros por bloques (párrafo + foto interpolados).
// Se generan con `npm run test:visual:update`. Emula prefers-reduced-motion
// para que el screenshot sea determinista (el renderer respeta ese modo y
// pinta en estado final sin animación de entrada).

const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#8a5a3c"/><circle cx="600" cy="400" r="150" fill="#c98a5c"/></svg>',
);

async function mockConfig(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/configuracion', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      json: {
        pagina_nosotros_titulo: 'El Taller',
        pagina_nosotros_contenido: [
          { id: 'p1', tipo: 'parrafo', md: 'Somos un **taller de grabado láser** en Buenos Aires. Hacemos cada mate de a uno: elegís el diseño, te mostramos cómo queda y recién ahí prendemos el láser.' },
          { id: 'i1', tipo: 'imagen', url: IMG, alt: 'El láser grabando', layout: 'destacada', epigrafe: 'El láser en pleno grabado. Cada pieza pasa de a una.' },
          { id: 'p2', tipo: 'parrafo', md: '## Cómo lo hacemos\n\nNos mandás tu logo o un texto. Te devolvemos una previsualización y, cuando la aprobás, grabamos.\n\n- Envíos a todo el país\n- Retiro por el taller' },
          { id: 'i2', tipo: 'imagen', url: IMG, alt: 'Macro del grabado', layout: 'ancho_lectura' },
        ],
      },
    });
  });
}

test.describe('Visual — /nosotros por bloques', () => {
  test('desktop — párrafo + foto destacada + párrafo + foto ancho de lectura', async ({ page }) => {
    await mockConfig(page);
    await page.goto('/nosotros');
    await expect(page.getByRole('heading', { name: 'El Taller', level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot('nosotros-bloques-desktop.png', { fullPage: true });
  });

  test('mobile — una columna, fotos al gutter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockConfig(page);
    await page.goto('/nosotros');
    await expect(page.getByRole('heading', { name: 'El Taller', level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot('nosotros-bloques-mobile.png', { fullPage: true });
  });
});

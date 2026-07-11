import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Cubre el bugfix de los campos de Estilo que se guardaban pero nunca se
// aplicaban (titulo_size, overlay, btn_color, padding, etc. — ver
// campos-estilo-bugfix.spec.ts para el detalle completo del bug).

test.describe('Visual — campos de Estilo ahora aplicados', () => {
  test('hero con overlay de color, botón custom y título grande', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: {
            slides: [{
              titulo: 'Mates únicos',
              subtitulo: 'Grabado láser de precisión',
              imagen_url: 'data:image/svg+xml;utf8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#888888"/></svg>',
              ),
              btn_texto: 'Comprar ahora',
              btn_link: '/productos',
              bg_color: '#111111',
              texto_color: '#ffffff',
            }],
            titulo_size: '2xl',
            subtitulo_color: '#ffcc00',
            btn_color: '#ff4400',
            btn_texto_color: '#ffffff',
            overlay_color: '#000066',
            overlay_opacidad: 50,
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('hero-estilo-custom.png');
  });

  test('categorias_grid con 2 columnas y título grande (antes hardcodeado a 4 columnas)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', columnas: 2, titulo_size: '3xl', categorias_items: [] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('categorias-grid-2-columnas.png');
  });
});

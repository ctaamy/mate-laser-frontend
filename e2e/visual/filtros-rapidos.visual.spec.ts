import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Bloque "filtros_rapidos": fila de chips horizontal con scroll en mobile.

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
  { id: 3, nombre: 'Termos', padre_id: null },
];

test.describe('Visual — Barra de filtros rápidos', () => {
  test('chips de categoría + apto para grabar, estilo por defecto', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
          datos: {
            items: [
              { id: 'a', tipo: 'categoria', label: 'Mates', config: { categoria_id: 1 } },
              { id: 'b', tipo: 'categoria', label: 'Bombillas', config: { categoria_id: 2 } },
              { id: 'c', tipo: 'categoria', label: 'Termos', config: { categoria_id: 3 } },
              { id: 'd', tipo: 'apto_grabado', label: 'Apto para grabar', config: {} },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('filtros-rapidos-default.png');
  });

  test('con bg_color/texto_color propios (herencia de estilo del bloque)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
          datos: {
            items: [
              { id: 'a', tipo: 'categoria', label: 'Mates', config: { categoria_id: 1 } },
              { id: 'b', tipo: 'apto_grabado', label: 'Apto para grabar', config: {} },
            ],
            bg_color: '#0a2218', texto_color: '#ffffff',
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('filtros-rapidos-estilo-custom.png');
  });
});

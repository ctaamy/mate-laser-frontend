import { test, expect } from '@playwright/test';

// Punto 1 de la consolidación del sistema de tema/herencia: texto_color se
// resolvía (bloque -> tema) en stats_barra, categorias_grid y
// productos_destacados, pero nunca se aplicaba al DOM (usaban clases
// Tailwind hardcodeadas text-black/text-white). Ver estiloHeredado en
// Home.tsx y su uso en SeccionStatsBarra/SeccionCategoriasGrid/
// SeccionProductosDestacados.

test.describe('texto_color ahora se aplica en stats_barra, categorias_grid, productos_destacados', () => {
  test('stats_barra: un texto_color propio se aplica al valor y al label', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'stats-1', tipo: 'stats_barra', activo: true, orden: 0, datos: { texto_color: '#ff8800' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const valor = page.getByText('1200+');
    await expect(valor).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('stats_barra: sin texto_color propio, hereda el del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'stats-1', tipo: 'stats_barra', activo: true, orden: 0, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_texto_color: '#334455' } }));

    await page.goto('/');
    const valor = page.getByText('1200+');
    await expect(valor).toHaveCSS('color', 'rgb(51, 68, 85)');
  });

  test('categorias_grid: un texto_color propio se aplica al título de sección', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { titulo: 'Categorías', texto_color: '#ff8800' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Categorías' })).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('productos_destacados: un texto_color propio se aplica al título de sección', async ({ page }) => {
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { titulo: 'Lo más vendido', texto_color: '#ff8800' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Lo más vendido' })).toHaveCSS('color', 'rgb(255, 136, 0)');
  });
});

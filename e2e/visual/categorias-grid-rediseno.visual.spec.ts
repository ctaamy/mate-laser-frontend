import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Rediseño de categorias_grid: overlay de texto sobre la imagen (degradé +
// texto blanco/crema), aspect ratio fijo 4:5 por card, zoom leve al hover,
// grid sin huecos grises cuando hay menos categorías que columnas, y el
// link "Ver productos" con el color de acento del tema (heredaDeBloque:
// categorias_grid.datos.accent_color → tema.accent_color).
//
// Ajustes: item_titulo_size controla el tamaño del nombre de categoría
// dentro de cada card (antes fijo, sin ningún control conectado); y el link
// "Ver productos" dibuja un subrayado de izquierda a derecha al hover
// (Opción A confirmada — CSS puro, reusa el acento del bloque).

// Imágenes como data: URI — sin depender de red externa, tamaño intrínseco
// determinístico.
function cuadrado(color: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/></svg>`,
  );
}

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
  { id: 3, nombre: 'Termos', padre_id: null },
];

test.describe('Visual — categorias_grid rediseñado', () => {
  test('overlay de texto, degradé y accent color sobre la imagen', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: {
            titulo: 'Categorías', columnas: 4,
            categorias_items: [
              { id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') },
              { id: 2, icono: '🪈', imagen_url: cuadrado('#0a2218') },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_accent_color: '#ff8800' } }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('categorias-grid-overlay.png');
  });

  test('hover: zoom leve de la imagen', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [CATEGORIAS[0]] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', columnas: 4, categorias_items: [{ id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') }] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const card = page.getByText('Mates', { exact: true }).locator('xpath=ancestor::a[1]');
    await card.hover();
    await page.waitForTimeout(600); // deja terminar la transición de 500ms
    await expect(card).toHaveScreenshot('categorias-grid-hover-zoom.png');
  });

  test('menos categorías que columnas: sin huecos grises en la fila incompleta', async ({ page }) => {
    // 3 categorías con imagen en un grid de 4 columnas — la última celda de
    // la fila queda sin dibujar (no una celda gris vacía).
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: {
            titulo: 'Categorías', columnas: 4,
            categorias_items: [
              { id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') },
              { id: 2, icono: '🪈', imagen_url: cuadrado('#0a2218') },
              { id: 3, icono: '🫖', imagen_url: cuadrado('#8a5a3c') },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const grid = page.getByText('Mates', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]');
    await expect(grid).toHaveScreenshot('categorias-grid-fila-incompleta.png');
  });

  test('item_titulo_size "2xl" agranda el nombre de categoría dentro de la card', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [CATEGORIAS[0]] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: {
            titulo: 'Categorías', columnas: 4, item_titulo_size: '2xl',
            categorias_items: [{ id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') }],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const card = page.getByText('Mates', { exact: true }).locator('xpath=ancestor::a[1]');
    await expect(card).toHaveScreenshot('categorias-grid-item-titulo-2xl.png');
  });

  test('bugfix: nombre largo en grilla de 4 columnas no se corta, hace wrap con clamp de 2 líneas', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({
      json: [
        { id: 1, nombre: 'Bombillas/Bombillones', padre_id: null },
        { id: 2, nombre: 'Mates', padre_id: null },
        { id: 3, nombre: 'Termos', padre_id: null },
        { id: 4, nombre: 'Kits de regalo personalizados', padre_id: null },
      ],
    }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: {
            titulo: 'Categorías', columnas: 4, item_titulo_size: '2xl',
            categorias_items: [
              { id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') },
              { id: 2, icono: '🪈', imagen_url: cuadrado('#0a2218') },
              { id: 3, icono: '🫖', imagen_url: cuadrado('#8a5a3c') },
              { id: 4, icono: '🎁', imagen_url: cuadrado('#3c2f8a') },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('categorias-grid-nombre-largo-4-columnas.png');
  });

  test('hover: subrayado del link "Ver productos" se dibuja de izquierda a derecha', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [CATEGORIAS[0]] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', columnas: 4, categorias_items: [{ id: 1, icono: '🧉', imagen_url: cuadrado('#593E2E') }] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_accent_color: '#ff8800' } }));

    await page.goto('/');
    const link = page.getByText('Ver productos');
    await link.hover();
    await page.waitForTimeout(400); // deja terminar la transición de 300ms
    await expect(link).toHaveScreenshot('categorias-grid-hover-subrayado.png');
  });
});

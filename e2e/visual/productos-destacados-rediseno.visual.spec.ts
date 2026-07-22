import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Rediseño de productos_destacados: mismo lenguaje visual que categorias_grid
// (overlay de texto sobre la imagen, degradé, zoom leve al hover, aspect
// ratio fijo, acento naranja en el CTA "Ver producto"), reusando los
// componentes compartidos ImagenConOverlay/LinkAcentoConSubrayado
// (components/ui/CardOverlay.tsx). El catálogo público (Productos.tsx) usa
// la variante "catalogo" de ProductCard, sin cambios visuales — no cubierto
// acá porque no se tocó.

function cuadrado(color: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/></svg>`,
  );
}

const PRODUCTOS = [
  {
    id: 'p1', nombre: 'Mate Imperial Grabado', slug: 'mate-imperial-grabado',
    precio_base: 15000, precio_tachado: null, stock: 5, stock_alerta: 2,
    apto_grabado: true, colores_disponibles: [], personalizado_habilitado: false,
    personalizado_max_chars: 0, activo: true, destacado: true, orden: 0, creado_en: new Date().toISOString(),
    imagenes_producto: [{ id: 'i1', url: cuadrado('#593E2E'), alt_texto: 'Mate Imperial', orden: 0 }],
  },
  {
    id: 'p2', nombre: 'Bombilla Premium', slug: 'bombilla-premium',
    precio_base: 8000, precio_tachado: 10000, stock: 8, stock_alerta: 2,
    apto_grabado: false, colores_disponibles: [], personalizado_habilitado: false,
    personalizado_max_chars: 0, activo: true, destacado: true, orden: 1, creado_en: new Date().toISOString(),
    imagenes_producto: [{ id: 'i2', url: cuadrado('#0a2218'), alt_texto: 'Bombilla Premium', orden: 0 }],
  },
];

test.describe('Visual — productos_destacados rediseñado', () => {
  test('overlay de texto, precio y accent color sobre la imagen', async ({ page }) => {
    await page.route('**/api/v1/productos?ids=**', (route) => route.fulfill({ json: { data: PRODUCTOS } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
          datos: { titulo: 'Lo más vendido', columnas: 2, productos_ids: ['p1', 'p2'] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_accent_color: '#ff8800' } }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('productos-destacados-overlay.png');
  });

  test('hover: zoom leve de la imagen', async ({ page }) => {
    await page.route('**/api/v1/productos?ids=**', (route) => route.fulfill({ json: { data: [PRODUCTOS[0]] } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
          datos: { titulo: 'Lo más vendido', columnas: 3, productos_ids: ['p1'] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const card = page.getByText('Mate Imperial Grabado', { exact: true }).locator('xpath=ancestor::a[1]');
    await card.hover();
    await page.waitForTimeout(600); // deja terminar la transición de 500ms
    await expect(card).toHaveScreenshot('productos-destacados-hover-zoom.png');
  });

  test('item_titulo_size "2xl" agranda el nombre del producto dentro de la card', async ({ page }) => {
    await page.route('**/api/v1/productos?ids=**', (route) => route.fulfill({ json: { data: [PRODUCTOS[0]] } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
          datos: { titulo: 'Lo más vendido', columnas: 4, item_titulo_size: '2xl', productos_ids: ['p1'] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const card = page.getByText('Mate Imperial Grabado', { exact: true }).locator('xpath=ancestor::a[1]');
    await expect(card).toHaveScreenshot('productos-destacados-item-titulo-2xl.png');
  });
});

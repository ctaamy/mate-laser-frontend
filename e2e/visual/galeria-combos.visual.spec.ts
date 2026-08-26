import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// galeria_combos: mismo lenguaje visual que categorias_grid/productos_destacados
// (overlay, hover con zoom, acento naranja) — reusa ImagenConOverlay/
// LinkAcentoConSubrayado de CardOverlay.tsx.

function cuadrado(color: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/></svg>`,
  );
}

const COMBOS = [
  { id: 'c1', es_ejemplo_admin: false, producto_id: 'p1', variante_id: 'v1', producto_nombre: 'Mate Imperial', mate_imagen: cuadrado('#593E2E'), bombilla_producto_id: null, bombilla_imagen: null, grabado_texto: null, anclaje: null },
  { id: 'c2', es_ejemplo_admin: true, producto_id: 'p2', variante_id: 'v2', producto_nombre: 'Mate de Calabaza', mate_imagen: cuadrado('#0a2218'), bombilla_producto_id: null, bombilla_imagen: null, grabado_texto: 'Para Ana', anclaje: null },
  { id: 'c3', es_ejemplo_admin: true, producto_id: 'p3', variante_id: 'v3', producto_nombre: 'Mate de Algarrobo', mate_imagen: cuadrado('#8a5a3c'), bombilla_producto_id: null, bombilla_imagen: null, grabado_texto: null, anclaje: null },
];

test.describe('Visual — galeria_combos', () => {
  test('3 combos, overlay + acento por defecto', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'gc-1', tipo: 'galeria_combos', activo: true, orden: 0, datos: { titulo: 'Inspirate con estos combos' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_accent_color: '#ff8800' } }));
    await page.route('**/api/v1/configurador/galeria-combos**', (route) => route.fulfill({ json: COMBOS }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('galeria-combos-3-items.png');
  });

  test('hover: zoom leve de la imagen', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'gc-1', tipo: 'galeria_combos', activo: true, orden: 0, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.route('**/api/v1/configurador/galeria-combos**', (route) => route.fulfill({ json: [COMBOS[0]] }));

    await page.goto('/');
    const card = page.getByText('Mate Imperial', { exact: true }).locator('xpath=ancestor::a[1]');
    // `force: true`: ver comentario equivalente en
    // categorias-grid-rediseno.visual.spec.ts — evita que Playwright
    // reintente su propio scroll-into-view durante la transición CSS del
    // hover, que en páginas cortas puede terminar empujando la card contra
    // el navbar sticky (flake intermitente).
    await card.hover({ force: true });
    await page.waitForTimeout(600);
    await expect(card).toHaveScreenshot('galeria-combos-hover-zoom.png');
  });
});

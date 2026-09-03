import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from '../fixtures';

// Baseline visual de la tira "También te puede interesar" al pie de la PDP.
// Corre con `npx playwright test --project visual --update-snapshots` la
// primera vez. No corre en CI (workflow_dispatch manual, ver CLAUDE.md).

const REC = Array.from({ length: 4 }, (_, i) => ({
  id: `rec-${i}`,
  nombre: `Mate recomendado ${i + 1}`,
  slug: `recomendado-${i}`,
  precio_base: 12000 + i * 1000,
  apto_grabado: i % 2 === 0,
  colores_disponibles: [],
  personalizado_habilitado: false,
  personalizado_max_chars: 0,
  material: 'Acero inoxidable',
  disponible: true,
  pocas_unidades: false,
  cantidad_maxima: 10,
  activo: true,
  destacado: false,
  orden: i,
  creado_en: new Date('2026-01-01').toISOString(),
  imagenes_producto: [{ id: `ri-${i}`, url: 'https://example.com/r.jpg', alt_texto: '', orden: 0 }],
}));

test.describe('Visual — tira de recomendados en la PDP', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) =>
      route.fulfill({
        json: { ...PRODUCTO_MOCK, categorias: { id: 1, nombre: 'Mates', slug: 'mates' } },
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
    await page.route('**/api/v1/productos/promociones-bancarias', (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (route) =>
      route.fulfill({ json: { data: REC, algoritmo: 'heuristica' } }),
    );
  });

  test('tira con 4 recomendados', async ({ page }) => {
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const seccion = page.getByRole('region', { name: 'Productos recomendados' });
    await seccion.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // deja terminar el fade/stagger de ProductGrid
    // Las imágenes apuntan a example.com (no cargan): se enmascaran para no
    // depender del render del placeholder ni de la red.
    await expect(seccion).toHaveScreenshot('tira.png', { mask: [seccion.locator('img')] });
  });
});

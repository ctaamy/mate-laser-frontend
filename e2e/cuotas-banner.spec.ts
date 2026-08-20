import { test, expect } from '@playwright/test';

// CuotasBanner (components/ui/CuotasBanner.tsx) — cartel de cuotas
// bancarias, reusado en PDP (fetch individual) y en la grilla
// (ProductGrid/Productos.tsx, Home productos_destacados) vía
// CuotasBannerBatchProvider, que resuelve todas las cards visibles en un
// solo POST /productos/promociones-bancarias en vez de un GET por card.

const PRODUCTO_MOCK = {
  id: 'p1', nombre: 'Mate Imperial', slug: 'mate-imperial',
  descripcion: 'Mate de acero', precio_base: 15000, disponible: true, pocas_unidades: false, cantidad_maxima: 10,
  apto_grabado: false, colores_disponibles: [],
  personalizado_habilitado: false, personalizado_max_chars: 30,
  activo: true, destacado: true, orden: 1, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i1', url: 'https://example.com/mate.jpg', alt_texto: 'Mate', orden: 0 }],
};

const OTRO_PRODUCTO_MOCK = { ...PRODUCTO_MOCK, id: 'p2', nombre: 'Mate Torpedo', slug: 'mate-torpedo' };

async function mockPDP(page: import('@playwright/test').Page) {
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) => route.fulfill({ json: PRODUCTO_MOCK }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

test.describe('CuotasBanner — PDP (fetch individual)', () => {
  test('con promo real: cuotas en verde salvia con el banco', async ({ page }) => {
    await mockPDP(page);
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.id}/promociones-bancarias`, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: true, cuotas: 6, banco: 'Galicia', descripcion: '6 cuotas', sin_interes: true } }),
    );
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const banner = page.getByText('6 cuotas sin interés con Galicia', { exact: true });
    await expect(banner).toBeVisible();
    await expect(banner).toHaveCSS('color', 'rgb(111, 169, 124)'); // #6FA97C
  });

  test('sin promo real: tope genérico en gris apagado', async ({ page }) => {
    await mockPDP(page);
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.id}/promociones-bancarias`, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const banner = page.getByText('Hasta 12 cuotas', { exact: true });
    await expect(banner).toBeVisible();
    await expect(banner).toHaveCSS('color', 'rgb(138, 134, 122)'); // #8A867A
  });

  test('error del endpoint: no muestra nada y no rompe la página', async ({ page }) => {
    await mockPDP(page);
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.id}/promociones-bancarias`, (route) =>
      route.fulfill({ status: 500, json: { message: 'error' } }),
    );
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    // El resto de la PDP sigue andando (precio visible, sin crash).
    await expect(page.getByText('$15.000', { exact: true })).toBeVisible();
    await expect(page.getByText(/cuotas/i)).not.toBeVisible();
  });
});

test.describe('CuotasBanner — grilla (batch, sin N+1)', () => {
  test('la grilla resuelve todas las cards con un solo POST batch, no un GET por card', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/productos**', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({ json: { data: [PRODUCTO_MOCK, OTRO_PRODUCTO_MOCK], total: 2, page: 1, totalPages: 1 } });
    });

    let batchCalls = 0;
    let individualCalls = 0;
    await page.route('**/api/v1/productos/promociones-bancarias', (route) => {
      batchCalls++;
      return route.fulfill({
        json: {
          [PRODUCTO_MOCK.id]: { tiene_promo_sin_interes: true, cuotas: 6, banco: 'Galicia', sin_interes: true },
          [OTRO_PRODUCTO_MOCK.id]: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false },
        },
      });
    });
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) => {
      individualCalls++;
      return route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } });
    });

    await page.goto('/productos');
    await expect(page.getByText('6 cuotas sin interés con Galicia', { exact: true })).toBeVisible();
    await expect(page.getByText('Hasta 12 cuotas', { exact: true })).toBeVisible();

    expect(batchCalls).toBe(1);
    expect(individualCalls).toBe(0);
  });
});

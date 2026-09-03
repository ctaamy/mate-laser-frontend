import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Fase 1 de "productos recomendados": tira "También te puede interesar" al pie
// de la PDP (ProductoDetalle.tsx), alimentada por
// GET /productos/:slug/recomendados (heurística por categoría en el backend).
// Acá se mockea la respuesta y se validan las reglas de UX firmadas con los
// 3 roles:
//   - título fijo neutro "También te puede interesar"
//   - cards que SOLO linkean al producto (sin "Agregar al carrito")
//   - la tira nunca incluye el producto que se está viendo
//   - con menos de 2 recomendados (o error), la sección no se renderiza

const rec = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `rec-${i}`,
    nombre: `Recomendado ${i}`,
    slug: `recomendado-${i}`,
    precio_base: 9000 + i,
    apto_grabado: false,
    colores_disponibles: [],
    personalizado_habilitado: false,
    personalizado_max_chars: 0,
    disponible: true,
    pocas_unidades: false,
    cantidad_maxima: 10,
    activo: true,
    destacado: false,
    orden: i,
    creado_en: new Date().toISOString(),
    imagenes_producto: [{ id: `ri-${i}`, url: 'https://example.com/r.jpg', alt_texto: '', orden: 0 }],
  }));

async function mockPDP(
  page: import('@playwright/test').Page,
  recomendados: unknown[] | { status: number },
) {
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
    Array.isArray(recomendados)
      ? route.fulfill({ json: { data: recomendados, algoritmo: 'heuristica' } })
      : route.fulfill({ status: recomendados.status, json: { message: 'error' } }),
  );
}

test.describe('PDP — productos recomendados (Fase 1)', () => {
  test('muestra la tira "También te puede interesar" con cards que solo linkean', async ({ page }) => {
    await mockPDP(page, rec(4));
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: 'También te puede interesar' })).toBeVisible();

    const seccion = page.getByRole('region', { name: 'Productos recomendados' });
    await expect(seccion).toBeVisible();

    // Las 4 recomendaciones llevan a su propia PDP.
    await expect(seccion.locator('a[href="/productos/recomendado-0"]').first()).toBeVisible();
    await expect(seccion.locator('a[href="/productos/recomendado-3"]').first()).toBeVisible();

    // Nunca linkea al producto que se está viendo.
    await expect(seccion.locator(`a[href="/productos/${PRODUCTO_MOCK.slug}"]`)).toHaveCount(0);

    // Card solo-link: no hay "Agregar al carrito" dentro de la tira.
    await expect(seccion.getByRole('button', { name: /Agregar al carrito/i })).toHaveCount(0);
  });

  test('con un solo recomendado, la sección no se renderiza', async ({ page }) => {
    await mockPDP(page, rec(1));
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'También te puede interesar' })).toHaveCount(0);
  });

  test('si el endpoint falla, la PDP sigue andando y no aparece la tira', async ({ page }) => {
    await mockPDP(page, { status: 500 });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'También te puede interesar' })).toHaveCount(0);
  });
});

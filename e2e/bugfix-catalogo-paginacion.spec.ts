import { test, expect } from '@playwright/test';

// Bugfix: el catálogo público (/productos) traía sólo la primera página del
// endpoint (limit 20) y descartaba `total`/`totalPages` — con el catálogo
// > 20, todo lo que caía fuera de esos 20 no aparecía nunca en "Todos" y
// sólo se veía al filtrar por una subcategoría chica (p. ej. una bombilla
// de alpaca sólo visible dentro de "Bombillas de Alpaca"). Ahora la página
// usa useInfiniteQuery + botón "Ver más" y acumula las páginas.

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
  { id: 9, nombre: 'Bombillas de Alpaca', padre_id: 2 },
];

function producto(n: number) {
  return {
    id: `p${n}`,
    nombre: `Producto ${n}`,
    slug: `producto-${n}`,
    precio_base: 10000 + n,
    apto_grabado: false,
    imagenes_producto: [],
  };
}

// 25 productos repartidos en 2 páginas de 20 + 5.
const TODOS = Array.from({ length: 25 }, (_, i) => producto(i + 1));

test.describe('Catálogo — paginación incremental', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));

    await page.route('**/api/v1/productos**', (route) => {
      const url = new URL(route.request().url());
      // Sólo el listado del catálogo (/productos con querystring); el resto
      // (batch de promos, detalle por slug) lo resuelven las rutas de abajo.
      if (url.pathname !== '/api/v1/productos') return route.continue();
      const pageParam = Number(url.searchParams.get('page') ?? '1');
      const limit = 20;
      const start = (pageParam - 1) * limit;
      const slice = TODOS.slice(start, start + limit);
      return route.fulfill({
        json: {
          data: slice,
          total: TODOS.length,
          page: pageParam,
          totalPages: Math.ceil(TODOS.length / limit),
        },
      });
    });

    await page.route('**/api/v1/productos/promociones-bancarias', (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
  });

  test('"Ver más" trae la página siguiente y no pierde productos fuera de los primeros 20', async ({ page }) => {
    await page.goto('/productos');

    // Primera página: el nº 1 está, el nº 21 (2ª página) todavía no.
    await expect(page.locator('a[href="/productos/producto-1"]').first()).toBeVisible();
    await expect(page.locator('a[href="/productos/producto-21"]')).toHaveCount(0);

    // El contador muestra el total real (25), no lo ya cargado (20).
    // exact: evita matchear el botón "Ver 25 productos" del drawer mobile.
    await expect(page.getByText('25 productos', { exact: true })).toBeVisible();

    // Traer la segunda página.
    await page.getByRole('button', { name: 'Ver más' }).click();

    // El producto que estaba fuera de los primeros 20 ahora aparece,
    // sin perder los de la primera página.
    await expect(page.locator('a[href="/productos/producto-21"]').first()).toBeVisible();
    await expect(page.locator('a[href="/productos/producto-1"]').first()).toBeVisible();

    // Ya no quedan más páginas: el botón desaparece.
    await expect(page.getByRole('button', { name: 'Ver más' })).toHaveCount(0);
  });
});

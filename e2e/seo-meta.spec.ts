import { test, expect, type Page } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';
import { DESCRIPCION_HOME, TITULO_HOME } from '../src/lib/seo';

// SEO Fase 1 — el <head> que deja cada ruta (usePageMeta + lib/seo). Corre en
// el dev server, que usa StrictMode: el setup → cleanup → setup del effect se
// ejercita en cada test (si el hook no fuera idempotente, se duplicarían tags).
//
// Lo más importante que se protege acá:
//   - nunca hay dos <link rel="canonical"> / <meta name="description"> (Google
//     ignora ambos canonicals si se contradicen),
//   - al navegar a otra ruta se restaura el <head> base (no quedan el canonical
//     ni el JSON-LD de la página anterior),
//   - solo un 404 real marca noindex; un error transitorio de la API no.

const APEX = 'https://matelaserstudio.com.ar';

async function mockBase(page: Page, config: Record<string, unknown> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) =>
    r.request().method() === 'GET' ? r.fulfill({ json: config }) : r.continue(),
  );
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (r) =>
    r.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  await page.route('**/api/v1/productos/promociones-bancarias', (r) => r.fulfill({ json: {} }));
  await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (r) =>
    r.fulfill({ json: { data: [], algoritmo: 'heuristica' } }),
  );
}

async function mockCatalogo(page: Page, productos: unknown[], categorias: unknown[] = []) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: categorias }));
  await page.route(/\/api\/v1\/productos(\?.*)?$/, (r) =>
    r.fulfill({ json: { data: productos, total: productos.length, page: 1, totalPages: 1 } }),
  );
}

const CATEGORIAS = [
  { id: 6, nombre: 'Mates de Algarrobo', slug: 'mates-algarrobo', orden: 1, activo: true },
  { id: 14, nombre: 'CANASTAS MATERAS', slug: 'canastas-materas', orden: 2, activo: true },
];

const item = (extra: Record<string, unknown>) => ({
  id: 'p1',
  nombre: 'Mate de prueba',
  slug: 'mate-de-prueba',
  precio_base: 12000,
  apto_grabado: false,
  colores_disponibles: [],
  personalizado_habilitado: false,
  personalizado_max_chars: 0,
  disponible: true,
  pocas_unidades: false,
  cantidad_maxima: 10,
  activo: true,
  destacado: false,
  orden: 0,
  creado_en: new Date().toISOString(),
  imagenes_producto: [],
  ...extra,
});

// Foto del <head> tal como quedó en el DOM (lo que ve el crawler tras renderizar).
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const attrs = (sel: string, attr: string) =>
      [...document.head.querySelectorAll(sel)].map((el) => el.getAttribute(attr));
    return {
      title: document.title,
      titles: document.head.querySelectorAll('title').length,
      descriptions: attrs('meta[name="description"]', 'content'),
      canonicals: attrs('link[rel="canonical"]', 'href'),
      robots: attrs('meta[name="robots"]', 'content'),
      ogTitle: attrs('meta[property="og:title"]', 'content'),
      ogUrl: attrs('meta[property="og:url"]', 'content'),
      ogImage: attrs('meta[property="og:image"]', 'content'),
      ogType: attrs('meta[property="og:type"]', 'content'),
      twitterCard: attrs('meta[name="twitter:card"]', 'content'),
      jsonLdPagina: [...document.head.querySelectorAll('script[type="application/ld+json"][data-seo="pagina"]')].map(
        (el) => JSON.parse(el.textContent ?? 'null'),
      ),
      jsonLdTotal: document.head.querySelectorAll('script[type="application/ld+json"]').length,
    };
  });

test.describe('SEO — <head> por ruta', () => {
  test('home: title/description/canonical de la home, sin tags duplicados', async ({ page }) => {
    await mockBase(page);
    await page.goto('/');
    await expect(page).toHaveTitle(TITULO_HOME);

    const s = await snapshot(page);
    expect(s.titles).toBe(1);
    expect(s.descriptions).toEqual([DESCRIPCION_HOME]);
    expect(s.canonicals).toEqual([`${APEX}/`]);
    expect(s.ogUrl).toEqual([`${APEX}/`]);
    expect(s.robots).toEqual([]);
    expect(s.jsonLdPagina).toEqual([]);
    expect(s.jsonLdTotal).toBe(1); // solo el Organization de index.html
  });

  test('PDP: title, description, canonical, og:image y JSON-LD Product; una sola copia de cada tag', async ({ page }) => {
    await mockBase(page);
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (r) =>
      r.fulfill({
        json: {
          ...PRODUCTO_MOCK,
          categorias: { id: 6, nombre: 'Mates de Algarrobo' },
          imagenes_producto: [{ id: 'i1', url: 'https://example.com/foto.jpg', alt_texto: '', orden: 0 }],
        },
      }),
    );
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page).toHaveTitle('Mate Imperial Grabado | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.titles).toBe(1);
    expect(s.descriptions).toEqual([PRODUCTO_MOCK.descripcion]);
    expect(s.canonicals).toEqual([`${APEX}/productos/${PRODUCTO_MOCK.slug}`]);
    expect(s.ogUrl).toEqual([`${APEX}/productos/${PRODUCTO_MOCK.slug}`]);
    expect(s.ogType).toEqual(['product']);
    expect(s.ogImage).toEqual(['https://example.com/foto.jpg']);
    expect(s.twitterCard).toEqual(['summary_large_image']);
    expect(s.robots).toEqual([]);

    expect(s.jsonLdPagina).toHaveLength(1);
    expect(s.jsonLdPagina[0]).toMatchObject({
      '@type': 'Product',
      name: PRODUCTO_MOCK.nombre,
      image: ['https://example.com/foto.jpg'],
      offers: { '@type': 'Offer', price: 8000, priceCurrency: 'ARS', availability: 'https://schema.org/InStock' },
    });
    expect(s.jsonLdTotal).toBe(2); // Organization (estático) + Product
  });

  test('al navegar de la PDP a la home se restaura el <head> base (nada de la PDP queda colgado)', async ({ page }) => {
    await mockBase(page);
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (r) =>
      r.fulfill({
        json: {
          ...PRODUCTO_MOCK,
          imagenes_producto: [{ id: 'i1', url: 'https://example.com/foto.jpg', alt_texto: '', orden: 0 }],
        },
      }),
    );
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page).toHaveTitle('Mate Imperial Grabado | Mate Laser Studio');

    // Navegación client-side (sin recargar): el link del logo/navbar a "/".
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveTitle(TITULO_HOME);

    const s = await snapshot(page);
    expect(s.canonicals).toEqual([`${APEX}/`]);
    expect(s.ogImage).toEqual([]); // el og:image de la PDP se fue
    expect(s.ogType).toEqual(['website']);
    expect(s.twitterCard).toEqual(['summary']); // vuelve al valor estático de index.html
    expect(s.jsonLdPagina).toEqual([]); // el Product de la PDP se fue
    expect(s.jsonLdTotal).toBe(1);
    expect(s.descriptions).toEqual([DESCRIPCION_HOME]);
  });

  test('PDP inexistente (404 de la API): noindex, sin canonical', async ({ page }) => {
    await mockBase(page);
    await page.route('**/api/v1/productos/no-existe', (r) =>
      r.fulfill({ status: 404, json: { statusCode: 404, message: 'Producto no encontrado' } }),
    );
    await page.goto('/productos/no-existe');
    await expect(page.getByText('Producto no encontrado')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveTitle('Producto no encontrado | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.robots).toEqual(['noindex, follow']);
    expect(s.canonicals).toEqual([]);
    expect(s.jsonLdPagina).toEqual([]);
  });

  test('PDP con error 500 de la API: NO marca noindex (un error transitorio no debe sacarla del índice)', async ({ page }) => {
    await mockBase(page);
    await page.route('**/api/v1/productos/con-error', (r) => r.fulfill({ status: 500, json: { message: 'boom' } }));
    await page.goto('/productos/con-error');
    await expect(page.getByText('Producto no encontrado')).toBeVisible({ timeout: 15_000 });

    const s = await snapshot(page);
    expect(s.robots).toEqual([]);
    expect(s.title).toBe(TITULO_HOME);
    expect(s.canonicals).toEqual([]);
  });

  test('URL inexistente: pantalla "no encontrada" (ya no en blanco) con noindex', async ({ page }) => {
    await mockBase(page);
    await page.goto('/esta-ruta-no-existe');
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
    await expect(page).toHaveTitle('Página no encontrada | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.robots).toEqual(['noindex, follow']);
    expect(s.canonicals).toEqual([]);
    await expect(page.getByRole('link', { name: 'Ver productos' })).toHaveAttribute('href', '/productos');
  });

  test('catálogo /productos: title y canonical propios', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({})], CATEGORIAS);
    await page.goto('/productos');
    await expect(page).toHaveTitle('Mates y bombillas con grabado láser | Mate Laser Studio');
    expect((await snapshot(page)).canonicals).toEqual([`${APEX}/productos`]);
  });

  test('categoría con productos aptos: title con "grabado láser" y canonical ?categoria_id', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({ apto_grabado: true })], CATEGORIAS);
    await page.goto('/productos?categoria_id=6');
    await expect(page).toHaveTitle('Mates de Algarrobo con grabado láser | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.canonicals).toEqual([`${APEX}/productos?categoria_id=6`]);
    expect(s.descriptions[0]).toContain('grabado láser');
  });

  test('?orden y ?apto_grabado no cambian el canonical de la categoría', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({ apto_grabado: true })], CATEGORIAS);
    await page.goto('/productos?categoria_id=6&orden=precio_asc&apto_grabado=true');
    await expect(page).toHaveTitle('Mates de Algarrobo con grabado láser | Mate Laser Studio');
    expect((await snapshot(page)).canonicals).toEqual([`${APEX}/productos?categoria_id=6`]);
  });

  test('categoría sin productos aptos: no promete grabado láser', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({ apto_grabado: false })], CATEGORIAS);
    await page.goto('/productos?categoria_id=14');
    await expect(page).toHaveTitle('Canastas materas | Mate Laser Studio');
    const s = await snapshot(page);
    expect(s.descriptions[0]).not.toMatch(/grabado/i);
  });

  test('categoria_id inexistente: cae al meta del catálogo general', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({})], CATEGORIAS);
    await page.goto('/productos?categoria_id=999');
    await expect(page).toHaveTitle('Mates y bombillas con grabado láser | Mate Laser Studio');
    expect((await snapshot(page)).canonicals).toEqual([`${APEX}/productos`]);
  });

  test('búsqueda interna (?q=): noindex y sin canonical', async ({ page }) => {
    await mockBase(page);
    await mockCatalogo(page, [item({})], CATEGORIAS);
    await page.goto('/productos?q=mate');
    await expect(page).toHaveTitle('Búsqueda | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.robots).toEqual(['noindex, follow']);
    expect(s.canonicals).toEqual([]);
  });

  test('página estática: título del admin sin emoji ni mayúsculas, canonical y description', async ({ page }) => {
    await mockBase(page, { pagina_nosotros_titulo: 'EL TALLER Y NOSOTROS ❤️' });
    await page.goto('/nosotros');
    await expect(page).toHaveTitle('El taller y nosotros | Mate Laser Studio');

    const s = await snapshot(page);
    expect(s.canonicals).toEqual([`${APEX}/nosotros`]);
    expect(s.descriptions[0]).toContain('El taller de Mate Laser Studio');
    expect(s.robots).toEqual([]);
  });

  test('rutas privadas (carrito): no declaran canonical ni noindex propios', async ({ page }) => {
    await mockBase(page);
    await page.goto('/carrito');
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();

    const s = await snapshot(page);
    expect(s.canonicals).toEqual([]);
    expect(s.robots).toEqual([]);
    expect(s.title).toBe(TITULO_HOME);
  });
});

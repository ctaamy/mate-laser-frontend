import { test, expect, type Page } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';
import { armarMigas } from '../src/lib/migas';
import { jsonLdMigas, SITE_URL } from '../src/lib/seo';
import { construirArbol } from '../src/lib/categoriasArbol';

// Breadcrumb de la ficha de producto: Inicio › Productos › [padre] › categoría
// › producto en desktop; un único link de retorno de 44px en mobile. Mismo
// recorrido en JSON-LD (BreadcrumbList). Decisiones firmadas con ux-reviewer.

const cat = (id: number, nombre: string, padre_id: number | null) =>
  ({ id, nombre, slug: `c-${id}`, padre_id, orden: id, activo: true });

const CATEGORIAS = [cat(1, 'Mates', null), cat(6, 'Mates de Algarrobo', 1), cat(9, 'Termos', null)];

const PRODUCTO = { ...PRODUCTO_MOCK, categorias: { id: 6, nombre: 'Mates de Algarrobo', slug: 'c-6', padre_id: 1 } };

async function mocks(page: Page, producto: Record<string, unknown> = PRODUCTO, categorias: unknown[] = CATEGORIAS) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: categorias }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.fulfill({ json: {} }));
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (r) =>
    r.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  await page.route('**/api/v1/productos/promociones-bancarias', (r) => r.fulfill({ json: {} }));
  await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (r) => r.fulfill({ json: { data: [], algoritmo: 'heuristica' } }));
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (r) => r.fulfill({ json: producto }));
  await page.route(/\/api\/v1\/productos(\?.*)?$/, (r) => r.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
}

const migas = (page: Page) => page.getByRole('navigation', { name: 'Migas de pan' });

test.describe('armarMigas / jsonLdMigas (lógica pura)', () => {
  const { porId } = construirArbol(CATEGORIAS as any);

  test('con categoría hija: Inicio › Productos › padre › categoría › producto', () => {
    const r = armarMigas({ nombre: 'Mate X', categorias: PRODUCTO.categorias as any }, porId);
    expect(r).toEqual([
      { nombre: 'Inicio', path: '/' },
      { nombre: 'Productos', path: '/productos' },
      { nombre: 'Mates', path: '/productos?categoria_id=1' },
      { nombre: 'Mates de Algarrobo', path: '/productos?categoria_id=6' },
      { nombre: 'Mate X' },
    ]);
  });

  test('con categoría raíz no repite el padre; sin categoría se acorta', () => {
    expect(armarMigas({ nombre: 'T', categorias: { id: 9, nombre: 'Termos', padre_id: null } as any }, porId).map((m) => m.nombre))
      .toEqual(['Inicio', 'Productos', 'Termos', 'T']);
    expect(armarMigas({ nombre: 'T' }, porId).map((m) => m.nombre)).toEqual(['Inicio', 'Productos', 'T']);
  });

  test('si el padre no está en el árbol (inactivo/borrado) se omite en vez de mostrar un nivel roto', () => {
    const r = armarMigas({ nombre: 'T', categorias: { id: 6, nombre: 'Mates de Algarrobo', padre_id: 99 } as any }, porId);
    expect(r.map((m) => m.nombre)).toEqual(['Inicio', 'Productos', 'Mates de Algarrobo', 'T']);
  });

  test('jsonLdMigas: posiciones, URLs absolutas y la actual sin path usa la URL de la página', () => {
    const url = `${SITE_URL}/productos/mate-x`;
    const ld = jsonLdMigas(
      [{ nombre: 'Inicio', path: '/' }, { nombre: 'Productos', path: '/productos' }, { nombre: 'Mate X' }],
      url,
    ) as any;
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Productos', item: `${SITE_URL}/productos` },
      { '@type': 'ListItem', position: 3, name: 'Mate X', item: url },
    ]);
  });
});

test.describe('Ficha de producto — breadcrumb (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('trilla completa con padre y categoría; la actual no es link y lleva aria-current', async ({ page }) => {
    await mocks(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const nav = migas(page);
    await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    await expect(nav.getByRole('link', { name: 'Productos', exact: true })).toHaveAttribute('href', '/productos');
    await expect(nav.getByRole('link', { name: 'Mates', exact: true })).toHaveAttribute('href', '/productos?categoria_id=1');
    await expect(nav.getByRole('link', { name: 'Mates de Algarrobo' })).toHaveAttribute('href', '/productos?categoria_id=6');

    const actual = nav.locator('[aria-current="page"]');
    await expect(actual).toHaveText(PRODUCTO_MOCK.nombre);
    await expect(nav.getByRole('link', { name: PRODUCTO_MOCK.nombre })).toHaveCount(0);
    await expect(nav.getByRole('listitem')).toHaveCount(5);
  });

  test('clickear la categoría lleva al listado filtrado', async ({ page }) => {
    await mocks(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await migas(page).getByRole('link', { name: 'Mates de Algarrobo' }).click();
    await expect(page).toHaveURL(/\/productos\?categoria_id=6/);
  });

  test('sin categoría: Inicio › Productos › producto', async ({ page }) => {
    await mocks(page, { ...PRODUCTO_MOCK });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(migas(page).getByRole('listitem')).toHaveCount(3);
  });

  test('un nombre largo se corta con elipsis en una sola línea (el H1 lo muestra entero)', async ({ page }) => {
    const nombre = 'Mate Imperial de Acero Térmico con Virola y Grabado Láser Personalizado';
    await mocks(page, { ...PRODUCTO, nombre });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const actual = migas(page).locator('[aria-current="page"]');
    await expect(actual).toHaveText(nombre);
    const estilo = await actual.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflow: cs.overflow, textOverflow: cs.textOverflow, truncado: el.scrollWidth > el.clientWidth };
    });
    expect(estilo).toMatchObject({ overflow: 'hidden', textOverflow: 'ellipsis', truncado: true });
    await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  });

  test('los links del breadcrumb tienen foco visible con teclado', async ({ page }) => {
    await mocks(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const link = migas(page).getByRole('link', { name: 'Productos', exact: true });
    await link.focus();
    await page.keyboard.press('Tab'); // pasa por el foco de teclado (focus-visible)
    await link.focus();
    await expect(link).toHaveCSS('outline-style', /auto|solid/);
  });

  test('no se ve el link de retorno mobile', async ({ page }) => {
    await mocks(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(migas(page).locator('a.md\\:hidden')).toBeHidden();
  });
});

test.describe('Ficha de producto — breadcrumb (mobile)', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('solo un link de retorno a la categoría, de al menos 44px, sin la trilla ni el nombre', async ({ page }) => {
    await mocks(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const nav = migas(page);
    const volver = nav.getByRole('link', { name: 'Mates de Algarrobo' });
    await expect(volver).toBeVisible();
    await expect(volver).toHaveAttribute('href', '/productos?categoria_id=6');
    expect((await volver.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // La trilla completa no está en el árbol de accesibilidad (display:none).
    await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveCount(0);
    await expect(nav.locator('[aria-current="page"]')).toBeHidden();
  });

  test('sin categoría vuelve a "Productos"', async ({ page }) => {
    await mocks(page, { ...PRODUCTO_MOCK });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(migas(page).getByRole('link', { name: 'Productos' })).toHaveAttribute('href', '/productos');
  });
});

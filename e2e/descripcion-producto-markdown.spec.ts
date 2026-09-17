import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Bugfix: la descripción de producto se editaba como Markdown en el admin
// (hint agregado en Productos.tsx) pero ProductoDetalle.tsx la mostraba con
// un <p> de texto plano — el cliente veía los asteriscos/guiones literales
// en vez de negrita/listas. Fix: la PDP ahora renderiza con ReactMarkdown +
// prose (mismo patrón que SeccionMediaTexto.tsx y /nosotros).

async function mockPDP(page: import('@playwright/test').Page, descripcion: string) {
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) =>
    route.fulfill({
      json: { ...PRODUCTO_MOCK, descripcion, categorias: { id: 1, nombre: 'Mates', slug: 'mates' } },
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
  await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], algoritmo: 'heuristica' } }),
  );
}

test.describe('PDP — descripción de producto con formato Markdown', () => {
  test('negrita, cursiva y lista se renderizan como HTML real, no como sintaxis literal', async ({ page }) => {
    await mockPDP(page, 'Mate de **acero quirúrgico**, con *terminación mate*.\n\n- Grabado láser incluido\n- Apto para mate cocido');
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.locator('.prose strong', { hasText: 'acero quirúrgico' })).toBeVisible();
    await expect(page.locator('.prose em', { hasText: 'terminación mate' })).toBeVisible();
    await expect(page.locator('.prose ul li')).toHaveCount(2);

    // Nada de sintaxis Markdown cruda visible para el cliente.
    const texto = await page.locator('.prose').innerText();
    expect(texto).not.toContain('**');
    expect(texto).not.toMatch(/(^|\s)-\s/);
  });

  test('sin descripción, no se renderiza el bloque (ni un .prose vacío)', async ({ page }) => {
    await mockPDP(page, '');
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.locator('.prose')).toHaveCount(0);
  });
});

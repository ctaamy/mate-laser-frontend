import { test, expect } from '@playwright/test';

// Bugfix: al entrar a una categoría desde el Home, la página de catálogo
// arrancaba scrolleada (a veces "en el final"). Causa: <BrowserRouter> no
// resetea el scroll al navegar, así que el offset del Home se conservaba;
// si la categoría destino tenía pocos productos, la página nueva era más
// corta que ese offset y el navegador lo clampeaba al fondo.
// Fix: componente <ScrollToTop> en App.tsx — scrollTo(0,0) al cambiar el
// pathname, salvo en navegación POP (atrás/adelante), que preserva la
// posición previa.

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
];

// Home con un bloque "filtros_rapidos" que linkea a /productos?categoria_id=1
// (mismo <Link> client-side que usan las grillas de categorías del Home).
const HOME_CON_LINK_CATEGORIA = [
  {
    id: 'f-1',
    tipo: 'filtros_rapidos',
    activo: true,
    orden: 0,
    datos: { items: [{ id: 'a', tipo: 'categoria', label: 'Ver mates', config: { categoria_id: 1 } }] },
  },
];

test.describe('Bugfix — scroll al navegar entre rutas', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) =>
      route.fulfill({ json: { hayCambios: false } }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: HOME_CON_LINK_CATEGORIA }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    // La categoría 1 devuelve pocos productos: la página de catálogo queda
    // corta, que es justo el caso donde el bug se veía peor.
    await page.route('**/api/v1/productos**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== '/api/v1/productos') return route.continue();
      return route.fulfill({
        json: {
          data: [{ id: 'p1', nombre: 'Mate 1', slug: 'mate-1', precio_base: 10000, apto_grabado: false, imagenes_producto: [] }],
          total: 1,
          page: 1,
          totalPages: 1,
        },
      });
    });
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
  });

  // Alarga el documento con un spacer fuera de #root (React no lo toca) para
  // poder scrollear de verdad, y devuelve el scrollY resultante.
  async function scrollHasta(page: import('@playwright/test').Page, y: number) {
    return page.evaluate((destino) => {
      if (!document.getElementById('e2e-spacer')) {
        const d = document.createElement('div');
        d.id = 'e2e-spacer';
        d.style.height = '3000px';
        document.body.appendChild(d);
      }
      window.scrollTo(0, destino);
      return window.scrollY;
    }, y);
  }

  test('entrar a una categoría desde el Home resetea el scroll al tope', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Ver mates' })).toBeVisible();

    const yAntes = await scrollHasta(page, 2500);
    expect(yAntes).toBeGreaterThan(1000);

    // click programático sobre el <Link> para que Playwright no auto-scrollee
    // el elemento a la vista antes de clickear (eso falsearía el test).
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('a[href="/productos?categoria_id=1"]')!.click();
    });

    await expect(page).toHaveURL(/\/productos\?categoria_id=1/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('el botón "atrás" (POP) preserva la posición de scroll, no la fuerza al tope', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Ver mates' })).toBeVisible();
    await scrollHasta(page, 2500);

    await page.evaluate(() => {
      document.querySelector<HTMLElement>('a[href="/productos?categoria_id=1"]')!.click();
    });
    await expect(page).toHaveURL(/\/productos\?categoria_id=1/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // En /productos volvemos a scrollear y navegamos atrás: el guard de POP
    // deja que el navegador restaure la posición del Home (no la pisa con 0).
    await scrollHasta(page, 2000);
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});

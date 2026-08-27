import { test, expect } from '@playwright/test';

// Fase 2 responsive: en mobile/tablet-portrait la sidebar de filtros de
// /productos deja de ocupar espacio fijo al lado de la grilla y pasa a un
// drawer lateral que se abre con el botón "Filtros" de la toolbar.

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
  { id: 3, nombre: 'Mates de calabaza', padre_id: 1 },
];

const PRODUCTOS = [
  { id: 'a', nombre: 'Mate Torpedo', slug: 'mate-torpedo', precio_base: 12000, imagenes_producto: [], apto_grabado: true },
  { id: 'b', nombre: 'Bombilla Alpaca', slug: 'bombilla-alpaca', precio_base: 9000, imagenes_producto: [], apto_grabado: false },
];

test.describe('Catálogo — filtros en drawer (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: PRODUCTOS } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    // Estas se registran DESPUÉS de la ruta amplia de /productos para que
    // Playwright (last-registered-first) las priorice sobre ella.
    await page.route('**/api/v1/productos/promociones-bancarias', (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
  });

  test('la sidebar no ocupa espacio y el drawer abre desde el botón Filtros', async ({ page }) => {
    await page.goto('/productos');

    // La grilla de productos usa el ancho completo (sin sidebar robando espacio).
    await expect(page.getByText('Mate Torpedo')).toBeVisible();
    const aside = page.locator('aside');
    await expect(aside).toBeHidden();

    // En teléfono la grilla arranca en 1 columna: las dos cards quedan una
    // debajo de la otra (misma x, distinta y), no lado a lado.
    const card1 = page.locator('a[href="/productos/mate-torpedo"]').first();
    const card2 = page.locator('a[href="/productos/bombilla-alpaca"]').first();
    const [b1, b2] = [await card1.boundingBox(), await card2.boundingBox()];
    expect(b1 && b2).toBeTruthy();
    expect(Math.abs(b1!.x - b2!.x)).toBeLessThan(2);
    expect(b2!.y).toBeGreaterThan(b1!.y + b1!.height - 2);

    // Botón Filtros visible en la toolbar.
    const btnFiltros = page.getByRole('button', { name: 'Filtrar' });
    await expect(btnFiltros).toBeVisible();

    // Drawer cerrado: el botón "Ver N productos" no es interactuable todavía.
    const verResultados = page.getByRole('button', { name: /Ver \d+ productos/ });
    await expect(verResultados).toBeHidden();

    // Abrir el drawer.
    await btnFiltros.click();
    await expect(verResultados).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mates', exact: true })).toBeVisible();
  });

  test('elegir una categoría en el drawer aplica el filtro en la URL', async ({ page }) => {
    await page.goto('/productos');
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await page.getByRole('button', { name: 'Bombillas', exact: true }).click();
    await expect(page).toHaveURL(/categoria_id=2/);

    // El badge del botón Filtros refleja que hay 1 filtro activo.
    await page.getByRole('button', { name: /Ver \d+ productos/ }).click();
    await expect(page.getByRole('button', { name: 'Filtrar' })).toContainText('1');
  });

  test('"Limpiar filtros" resetea la query', async ({ page }) => {
    await page.goto('/productos?categoria_id=1');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page).toHaveURL(/\/productos$/);
  });
});

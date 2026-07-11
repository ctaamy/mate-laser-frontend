import { test, expect } from '@playwright/test';

// Bloque "filtros_rapidos": barra de chips configurable desde el admin, cada
// item linkea a /productos con el mismo query param que ya lee la sidebar
// de filtros de Productos.tsx (categoria_id, apto_grabado).

async function mockHome(page: import('@playwright/test').Page, seccion: any, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

const CATEGORIAS = [
  { id: 1, nombre: 'Mates', padre_id: null },
  { id: 2, nombre: 'Bombillas', padre_id: null },
];

test.describe('Bloque Barra de filtros rápidos', () => {
  test('filtro de categoría linkea a /productos?categoria_id=<id>', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await mockHome(page, {
      id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
      datos: { items: [{ id: 'a', tipo: 'categoria', label: 'Ver mates', config: { categoria_id: 1 } }] },
    });
    await page.goto('/');
    const chip = page.getByRole('link', { name: 'Ver mates' });
    await expect(chip).toHaveAttribute('href', '/productos?categoria_id=1');
  });

  test('filtro "apto para grabar" linkea a /productos?apto_grabado=true', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await mockHome(page, {
      id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
      datos: { items: [{ id: 'a', tipo: 'apto_grabado', label: 'Apto para grabar', config: {} }] },
    });
    await page.goto('/');
    const chip = page.getByRole('link', { name: 'Apto para grabar' });
    await expect(chip).toHaveAttribute('href', '/productos?apto_grabado=true');
  });

  test('combinación de varios filtros se renderiza en el orden configurado', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await mockHome(page, {
      id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
      datos: {
        items: [
          { id: 'a', tipo: 'apto_grabado', label: 'Apto para grabar', config: {} },
          { id: 'b', tipo: 'categoria', label: 'Bombillas', config: { categoria_id: 2 } },
          { id: 'c', tipo: 'categoria', label: 'Mates', config: { categoria_id: 1 } },
        ],
      },
    });
    await page.goto('/');
    const chips = page.locator('a').filter({ hasText: /^(Apto para grabar|Bombillas|Mates)$/ });
    await expect(chips).toHaveCount(3);
    await expect(chips.nth(0)).toHaveText('Apto para grabar');
    await expect(chips.nth(1)).toHaveText('Bombillas');
    await expect(chips.nth(2)).toHaveText('Mates');
    await expect(chips.nth(1)).toHaveAttribute('href', '/productos?categoria_id=2');
  });

  test('sin items, el bloque no se renderiza', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await mockHome(page, {
      id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
      datos: { items: [] },
    });
    await page.goto('/');
    await expect(page.locator('a[href^="/productos?categoria_id"], a[href^="/productos?apto_grabado"]')).toHaveCount(0);
  });

  test('los links generados navegan a /productos y aplican el filtro (integración con la página de catálogo)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: CATEGORIAS }));
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: [] }));
    await mockHome(page, {
      id: 'f-1', tipo: 'filtros_rapidos', activo: true, orden: 0,
      datos: { items: [{ id: 'a', tipo: 'categoria', label: 'Ver mates', config: { categoria_id: 1 } }] },
    });
    await page.goto('/');
    await page.getByRole('link', { name: 'Ver mates' }).click();
    await expect(page).toHaveURL(/\/productos\?categoria_id=1/);
  });
});

import { test, expect } from '@playwright/test';

// galeria_combos: bloque nuevo del home que muestra combos armados a
// través del configurador (combo_id, Fase 5), reusando ImagenConOverlay/
// LinkAcentoConSubrayado (mismo lenguaje visual que categorias_grid/
// productos_destacados). Cada combo lleva a /disena-tu-mate-v2?combo=<id>.

const BASE = { id: 'gc-1', tipo: 'galeria_combos', activo: true, orden: 0 };

const COMBO_REAL = {
  id: 'combo-real-1', es_ejemplo_admin: false, producto_id: 'mate-1', variante_id: 'var-1',
  producto_nombre: 'Mate Imperial', mate_imagen: 'https://example.com/mate.jpg',
  bombilla_producto_id: null, bombilla_imagen: null, grabado_texto: null, anclaje: null,
};
const COMBO_EJEMPLO = {
  id: 'combo-ejemplo-1', es_ejemplo_admin: true, producto_id: 'mate-2', variante_id: 'var-2',
  producto_nombre: 'Mate de Calabaza', mate_imagen: 'https://example.com/calabaza.jpg',
  bombilla_producto_id: null, bombilla_imagen: null, grabado_texto: 'Para Ana', anclaje: null,
};

async function mockHome(page: import('@playwright/test').Page, combos: any[], datos: Record<string, any> = {}, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [{ ...BASE, datos }] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
  await page.route('**/api/v1/configurador/galeria-combos**', (route) => route.fulfill({ json: combos }));
}

test.describe('galeria_combos', () => {
  test('renderiza cada combo con su nombre y un link al configurador precargado', async ({ page }) => {
    await mockHome(page, [COMBO_REAL]);
    await page.goto('/');
    await expect(page.getByText('Mate Imperial', { exact: true })).toBeVisible();
    const link = page.getByText('Mate Imperial', { exact: true }).locator('xpath=ancestor::a[1]');
    await expect(link).toHaveAttribute('href', '/disena-tu-mate-v2?combo=combo-real-1');
  });

  test('muestra el texto de grabado cuando el combo lo tiene', async ({ page }) => {
    await mockHome(page, [COMBO_EJEMPLO]);
    await page.goto('/');
    await expect(page.getByText('"Para Ana"')).toBeVisible();
  });

  test('sin combos (ni reales ni de ejemplo), el bloque no se renderiza', async ({ page }) => {
    await mockHome(page, []);
    await page.goto('/');
    await expect(page.locator('a[href^="/disena-tu-mate-v2?combo="]')).toHaveCount(0);
  });

  test('accent_color propio se aplica al link "Armá el tuyo"', async ({ page }) => {
    await mockHome(page, [COMBO_REAL], { accent_color: '#ff8800' });
    await page.goto('/');
    await expect(page.getByText('Armá el tuyo')).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('cantidad configurada se pasa como límite a la API', async ({ page }) => {
    let limitRecibido: string | null = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [{ ...BASE, datos: { cantidad: 3 } }] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.route('**/api/v1/configurador/galeria-combos**', (route) => {
      limitRecibido = new URL(route.request().url()).searchParams.get('limit');
      return route.fulfill({ json: [COMBO_REAL] });
    });
    await page.goto('/');
    await expect(page.getByText('Mate Imperial', { exact: true })).toBeVisible();
    expect(limitRecibido).toBe('3');
  });
});

import { test, expect } from '@playwright/test';

// Precarga del configurador desde la galería de combos del home
// (?combo=<id>, real o de ejemplo): salta directo al Resumen (Paso 5) con
// mate/bombilla/grabado ya elegidos — "quiero uno así".

const PRODUCTO_MATE = {
  id: 'mate-1', nombre: 'Mate Imperial', slug: 'mate-imperial', precio_base: 8000, apto_grabado: true,
  costo_grabado: 500, imagenes_producto: [{ id: 'img-1', url: 'https://example.com/mate.jpg', es_principal: true }],
};
const VARIANTE_MATE = { id: 'var-mate-1', sku: 'MATE-1', precio_override: null, stock: 5, activo: true, variante_valores: [], imagenes_producto: { id: 'img-1', url: 'https://example.com/mate.jpg', es_principal: true } };
const PRODUCTO_BOMBILLA = { id: 'bomb-1', nombre: 'Bombilla Acero', slug: 'bombilla-acero', precio_base: 3000, apto_grabado: false, imagenes_producto: [] };
const VARIANTE_BOMBILLA = { id: 'var-bomb-1', sku: 'BOMB-1', precio_override: null, stock: 10, activo: true, variante_valores: [], imagenes_producto: null };

async function mockBase(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/configurador/stock-variantes**', (route) =>
    route.fulfill({ json: [{ variante_id: 'var-mate-1', stock: 5, activo: true }, { variante_id: 'var-bomb-1', stock: 10, activo: true }] }),
  );
}

test.describe('Configurador v2 — precarga desde combo (galería del home)', () => {
  test('con ?combo=<id>, salta directo al Resumen con mate + bombilla + grabado ya elegidos', async ({ page }) => {
    await mockBase(page);
    await page.route('**/api/v1/configurador/combo/combo-1', (route) => route.fulfill({
      json: {
        producto: PRODUCTO_MATE, variante: VARIANTE_MATE,
        bombilla: { producto: PRODUCTO_BOMBILLA, variante: VARIANTE_BOMBILLA },
        grabado_texto: 'Para Juan',
      },
    }));

    await page.goto('/disena-tu-mate-v2?combo=combo-1');

    await expect(page.getByText('Revisá tu mate antes de agregarlo al carrito')).toBeVisible();
    await expect(page.getByText('Mate Imperial', { exact: true })).toBeVisible();
    await expect(page.getByText(/Bombilla Acero/).first()).toBeVisible();
    // El texto libre de grabado no se muestra verbatim en el resumen (dispara
    // el flujo de contacto), pero confirma que quedó "elegido" en vez de "Sin grabado".
    await expect(page.getByText('Idea a definir').first()).toBeVisible();
  });

  test('combo sin bombilla ni grabado: salta al Resumen solo con el mate', async ({ page }) => {
    await mockBase(page);
    await page.route('**/api/v1/configurador/combo/combo-2', (route) => route.fulfill({
      json: { producto: PRODUCTO_MATE, variante: VARIANTE_MATE, bombilla: null, grabado_texto: null },
    }));

    await page.goto('/disena-tu-mate-v2?combo=combo-2');

    await expect(page.getByText('Revisá tu mate antes de agregarlo al carrito')).toBeVisible();
    await expect(page.getByText('Mate Imperial', { exact: true })).toBeVisible();
  });

  test('sin ?combo en la URL, el configurador arranca normal en el Paso 1 (sin llamar al endpoint de combo)', async ({ page }) => {
    await mockBase(page);
    let llamado = false;
    await page.route('**/api/v1/configurador/combo/**', (route) => { llamado = true; return route.fulfill({ json: null }); });

    await page.goto('/disena-tu-mate-v2');

    await expect(page.getByText('Todavía no hay tipos de mate configurados.')).toBeVisible();
    expect(llamado).toBe(false);
  });
});

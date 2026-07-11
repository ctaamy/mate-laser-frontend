import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// E2E del configurador "Diseñá tu mate" (/disena-tu-mate).
// Mockeamos GET /configurador/pasos y POST /configurador/pasos/:id/disponibilidad
// para que el test sea hermético (no depende de Postgres real). Cubre el
// camino feliz: completar los pasos con opción, saltear uno salteable,
// llegar al resumen (que debe reflejar el paso salteado) y agregar al carrito.
// ─────────────────────────────────────────────────────────────────────────

const PASOS_MOCK = [
  {
    id: 'paso-material', nombre: 'Material', slug: 'material', orden: 0,
    salteable: false, nota_texto: null, permite_upload: false, es_resumen: false,
    opciones: [
      { id: 'op-mat-1', variante_id: 'var-mat-1', nombre_visible: 'Acero inoxidable', descripcion_corta: null, imagen_url: null, precio: 8000, precio_base_producto: 8000, sinStock: false },
      { id: 'op-mat-2', variante_id: 'var-mat-2', nombre_visible: 'Calabaza', descripcion_corta: null, imagen_url: null, precio: 9500, precio_base_producto: 8000, sinStock: false },
    ],
  },
  {
    id: 'paso-tamano', nombre: 'Tamaño', slug: 'tamano', orden: 1,
    salteable: false, nota_texto: null, permite_upload: false, es_resumen: false,
    opciones: [
      { id: 'op-tam-1', variante_id: 'var-tam-1', nombre_visible: 'Grande', descripcion_corta: null, imagen_url: null, precio: 8000, precio_base_producto: 8000, sinStock: false },
    ],
  },
  {
    id: 'paso-bombilla', nombre: 'Bombilla', slug: 'bombilla', orden: 2,
    salteable: true, nota_texto: null, permite_upload: false, es_resumen: false,
    opciones: [
      { id: 'op-bom-1', variante_id: 'var-bom-1', nombre_visible: 'Bombilla de alpaca', descripcion_corta: null, imagen_url: null, precio: 2000, precio_base_producto: 0, sinStock: false },
    ],
  },
  {
    id: 'paso-resumen', nombre: 'Resumen', slug: 'resumen', orden: 3,
    salteable: false, nota_texto: null, permite_upload: false, es_resumen: true,
    opciones: [],
  },
];

async function mockConfigurador(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/configurador/pasos', (route) => route.fulfill({ json: PASOS_MOCK }));
  await page.route('**/api/v1/configurador/pasos/*/disponibilidad', (route) => {
    const body = route.request().postDataJSON();
    const pasoId = route.request().url().match(/pasos\/([^/]+)\/disponibilidad/)?.[1];
    const paso = PASOS_MOCK.find((p) => p.id === pasoId);
    route.fulfill({
      json: (paso?.opciones ?? []).map((op) => ({ id: op.id, variante_id: op.variante_id, sinStock: false, precio: op.precio })),
    });
  });
}

test.describe('Configurador — Diseñá tu mate', () => {
  test('completa el flujo salteando bombilla, el resumen lo refleja y agrega al carrito', async ({ page }) => {
    await mockConfigurador(page);
    await page.goto('/disena-tu-mate');

    await expect(page.getByRole('heading', { name: 'Diseñá tu mate' })).toBeVisible();

    // Paso 1: Material
    await expect(page.getByRole('heading', { name: 'Material', exact: true })).toBeVisible();
    await page.getByText('Acero inoxidable').click();
    await page.getByRole('button', { name: /Continuar/i }).click();

    // Paso 2: Tamaño
    await page.getByText('Grande').click();
    await page.getByRole('button', { name: /Continuar/i }).click();

    // Paso 3: Bombilla (salteable) — la salteamos
    await expect(page.getByRole('button', { name: /Saltear paso/i })).toBeVisible();
    await page.getByRole('button', { name: /Saltear paso/i }).click();

    // Resumen
    await expect(page.getByRole('heading', { name: /Resumen de tu mate/i })).toBeVisible();
    await expect(page.getByText('Sin bombilla')).toBeVisible();
    await expect(page.getByText('Acero inoxidable')).toBeVisible();
    await expect(page.getByText('Grande')).toBeVisible();

    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    await expect(page).toHaveURL(/\/carrito/);
    await expect(page.getByText(/Mate diseñado a medida/i)).toBeVisible();
  });
});

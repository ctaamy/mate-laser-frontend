import { test, expect } from '@playwright/test';

// Badge "Apto grabado" (antes "Grabado láser"): mismo campo apto_grabado
// que ya usa el filtro de Productos.tsx, mismo copy en todos los lugares
// donde aparece. Color resuelto desde el tema (tema.badge_color →
// var(--color-badge)), deliberadamente distinto del acento naranja de los
// CTAs. Consolidado en components/ui/BadgeAptoGrabado.tsx, usado por
// ProductCard.tsx (Home productos_destacados + catálogo público) y
// ProductoDetalle.tsx.
//
// Nota de alcance: el badge de Carrito.tsx (item.con_grabado) NO se tocó
// a propósito — es semánticamente distinto (confirma que SE APLICÓ grabado
// a ese ítem del carrito, no que el producto "es apto" para grabar), y el
// flujo de compra (.flujo-compra) usa deliberadamente una paleta fija sin
// heredar el tema del sitio — sumarle var(--color-badge) rompería ese
// aislamiento ya establecido.

const PRODUCTO_MOCK = {
  id: 'p1', nombre: 'Mate Imperial Grabado', slug: 'mate-imperial-grabado',
  descripcion: 'Mate de acero con grabado láser personalizado',
  precio_base: 15000, stock: 10, stock_alerta: 2,
  apto_grabado: true, colores_disponibles: ['negro', 'blanco'],
  personalizado_habilitado: true, personalizado_max_chars: 20,
  personalizado_placeholder: 'Ej: Para Juan', activo: true, destacado: true,
  orden: 1, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i1', url: 'https://example.com/mate.jpg', alt_texto: 'Mate', orden: 0 }],
};

async function mockProductoDetalle(page: import('@playwright/test').Page, overrides: Record<string, any> = {}, config: Record<string, any> = {}) {
  const producto = { ...PRODUCTO_MOCK, ...overrides };
  await page.route(`**/api/v1/productos/${producto.slug}`, (route) => route.fulfill({ json: producto }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: config });
  });
  return producto;
}

async function mockHomeDestacados(page: import('@playwright/test').Page, config: Record<string, any> = {}) {
  await page.route('**/api/v1/productos?ids=**', (route) => route.fulfill({ json: { data: [PRODUCTO_MOCK] } }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
    route.fulfill({ json: [{ id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'] } }] }),
  );
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('Badge "Apto grabado" — copy', () => {
  test('ProductoDetalle: muestra "Apto grabado", no "Grabado láser"', async ({ page }) => {
    await mockProductoDetalle(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page.getByText('Apto grabado', { exact: true })).toBeVisible();
    await expect(page.getByText('Grabado láser', { exact: true })).not.toBeVisible();
  });

  test('ProductoDetalle: sin apto_grabado, no se muestra el badge', async ({ page }) => {
    await mockProductoDetalle(page, { apto_grabado: false });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page.getByText('Apto grabado', { exact: true })).not.toBeVisible();
  });

  test('Catálogo público (Productos.tsx): muestra "Apto grabado" en la card', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: [PRODUCTO_MOCK], total: 1, page: 1, totalPages: 1 } }));
    await page.goto('/productos');
    await expect(page.getByText('Apto grabado', { exact: true })).toBeVisible();
  });

  test('Home productos_destacados: muestra "Apto grabado" en la card', async ({ page }) => {
    await mockHomeDestacados(page);
    await page.goto('/');
    await expect(page.getByText('Apto grabado', { exact: true })).toBeVisible();
  });
});

test.describe('Badge "Apto grabado" — color desde el tema', () => {
  test('sin tema_badge_color configurado, usa el default oscuro (#111111)', async ({ page }) => {
    await mockProductoDetalle(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page.getByText('Apto grabado', { exact: true }).locator('..')).toHaveCSS('background-color', 'rgb(17, 17, 17)');
  });

  test('con tema_badge_color configurado, se aplica al badge (y no al acento)', async ({ page }) => {
    await mockProductoDetalle(page, {}, { tema_badge_color: '#3355ff', tema_accent_color: '#ff8800' });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page.getByText('Apto grabado', { exact: true }).locator('..')).toHaveCSS('background-color', 'rgb(51, 85, 255)');
  });
});

test.describe('Badge — Carrito.tsx queda sin tocar (semántica distinta: con_grabado, no apto_grabado)', () => {
  test('el badge de un ítem del carrito con grabado aplicado sigue diciendo "Grabado láser"', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/carrito');
    await page.evaluate(() => {
      const state = {
        state: {
          items: [{
            producto_id: 'p1', nombre_producto: 'Mate con grabado', precio_unitario: 15000,
            cantidad: 1, stock: 10, con_grabado: true, texto_grabado: 'Para Juan',
          }],
        },
        version: 0,
      };
      localStorage.setItem('carrito-storage', JSON.stringify(state));
    });
    await page.reload();
    await expect(page.getByText('Grabado láser', { exact: true })).toBeVisible();
  });
});

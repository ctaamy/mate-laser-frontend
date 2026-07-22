import { test, expect } from '@playwright/test';

// Rediseño de productos_destacados: mismo lenguaje visual que categorias_grid
// (overlay de texto sobre la imagen, zoom leve al hover, acento en el CTA,
// tamaño de fuente configurable para nombre/precio-CTA). ProductCard.tsx
// gana una variante "overlay" (usada solo acá) sin tocar el render por
// defecto que sigue usando el catálogo público (Productos.tsx).

const PRODUCTO = {
  id: 'p1', nombre: 'Mate Imperial Grabado', slug: 'mate-imperial-grabado',
  precio_base: 15000, precio_tachado: 20000, stock: 5, stock_alerta: 2,
  apto_grabado: true, colores_disponibles: [], personalizado_habilitado: false,
  personalizado_max_chars: 0, activo: true, destacado: true, orden: 0, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i1', url: 'https://example.com/mate.jpg', alt_texto: 'Mate Imperial', orden: 0 }],
};

async function mockHome(page: import('@playwright/test').Page, seccion: any, config: Record<string, any> = {}) {
  await page.route('**/api/v1/productos?ids=**', (route) => route.fulfill({ json: { data: [PRODUCTO] } }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('productos_destacados rediseñado — overlay y acento', () => {
  test('el nombre y el precio se renderizan superpuestos sobre la imagen (no debajo)', async ({ page }) => {
    await mockHome(page, {
      id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
      datos: { productos_ids: ['p1'] },
    });
    await page.goto('/');
    const imagen = page.locator('img[src="https://example.com/mate.jpg"]');
    const contenedor = imagen.locator('..');
    await expect(contenedor.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(contenedor.getByText('$15.000')).toBeVisible();
  });

  test('el link de acción "Ver producto" va al producto específico', async ({ page }) => {
    await mockHome(page, {
      id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
      datos: { productos_ids: ['p1'] },
    });
    await page.goto('/');
    const link = page.getByText('Mate Imperial Grabado').locator('xpath=ancestor::a[1]');
    await expect(link).toHaveAttribute('href', '/productos/mate-imperial-grabado');
  });

  test('accent_color del bloque se aplica al CTA "Ver producto"', async ({ page }) => {
    await mockHome(page, {
      id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
      datos: { productos_ids: ['p1'], accent_color: '#ff8800' },
    });
    await page.goto('/');
    await expect(page.getByText('Ver producto')).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('sin accent_color propio, hereda el accent_color del tema', async ({ page }) => {
    await mockHome(page, {
      id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
      datos: { productos_ids: ['p1'] },
    }, { tema_accent_color: '#00aaff' });
    await page.goto('/');
    await expect(page.getByText('Ver producto')).toHaveCSS('color', 'rgb(0, 170, 255)');
  });

  test('item_titulo_size cambia el tamaño del nombre del producto dentro de la card', async ({ page }) => {
    await mockHome(page, { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'], item_titulo_size: 'xs' } });
    await page.goto('/');
    const fsChico = await page.getByText('Mate Imperial Grabado').evaluate(el => getComputedStyle(el).fontSize);

    await mockHome(page, { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'], item_titulo_size: '3xl' } });
    await page.goto('/');
    const fsGrande = await page.getByText('Mate Imperial Grabado').evaluate(el => getComputedStyle(el).fontSize);

    expect(parseFloat(fsGrande)).toBeGreaterThan(parseFloat(fsChico));
  });

  test('sin item_titulo_size, el nombre del producto usa el tamaño histórico (14px / text-sm)', async ({ page }) => {
    await mockHome(page, { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'] } });
    await page.goto('/');
    await expect(page.getByText('Mate Imperial Grabado')).toHaveCSS('font-size', '14px');
  });

  test('item_link_size cambia el tamaño del precio/CTA', async ({ page }) => {
    await mockHome(page, { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'], item_link_size: 'xs' } });
    await page.goto('/');
    const fsChico = await page.getByText('Ver producto').evaluate(el => getComputedStyle(el).fontSize);

    await mockHome(page, { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { productos_ids: ['p1'], item_link_size: 'xl' } });
    await page.goto('/');
    const fsGrande = await page.getByText('Ver producto').evaluate(el => getComputedStyle(el).fontSize);

    expect(parseFloat(fsGrande)).toBeGreaterThan(parseFloat(fsChico));
  });

  test('la card del catálogo público (Productos.tsx) no cambia: sigue con el botón "Agregar al carrito" y sin overlay de texto', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: [PRODUCTO], total: 1, page: 1, totalPages: 1 } }));
    await page.goto('/productos');
    await expect(page.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toHaveCount(1);
  });
});

import { test, expect } from '@playwright/test';

// Fase 1 del arreglo del flujo "sin stock": cortar el agregado silencioso.
// Antes, desde el listado del catálogo (/productos) el botón "Agregar al
// carrito" (reveal al hover, desktop) no miraba `producto.disponible` — te
// dejaba sumar un producto agotado con toast de éxito incluido, y recién te
// frenaba el carrito con una línea roja. Ahora la card sin stock:
//   - no ofrece el botón "Agregar al carrito"
//   - muestra un badge neutro "Sin stock" sobre la imagen
//   - muestra "Sin stock por ahora" en la columna de texto (señal para mobile,
//     donde no hay hover y el badge sería la única pista)
//   - sigue linkeando a la PDP (puede haber una variante que sí hay, o volver
//     cuando reponga)

const DISPONIBLE = {
  id: 'p-ok', nombre: 'Mate Con Stock', slug: 'mate-con-stock',
  precio_base: 12000, apto_grabado: false, colores_disponibles: [],
  personalizado_habilitado: false, personalizado_max_chars: 0,
  disponible: true, pocas_unidades: false, cantidad_maxima: 10,
  activo: true, destacado: false, orden: 0, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i-ok', url: 'https://example.com/ok.jpg', alt_texto: 'Con stock', orden: 0 }],
};

const AGOTADO = {
  id: 'p-no', nombre: 'Mate Agotado', slug: 'mate-agotado',
  precio_base: 15000, precio_tachado: 20000, apto_grabado: true, colores_disponibles: [],
  personalizado_habilitado: false, personalizado_max_chars: 0,
  disponible: false, pocas_unidades: false, cantidad_maxima: 0,
  activo: true, destacado: false, orden: 1, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i-no', url: 'https://example.com/no.jpg', alt_texto: 'Agotado', orden: 0 }],
};

async function mockCatalogo(page: import('@playwright/test').Page, productos: any[]) {
  await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
    route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  await page.route('**/api/v1/productos**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/productos') return route.continue();
    return route.fulfill({ json: { data: productos, total: productos.length, page: 1, totalPages: 1 } });
  });
}

test.describe('Catálogo — producto sin stock', () => {
  test('la card agotada no ofrece "Agregar al carrito" y marca el estado', async ({ page }) => {
    await mockCatalogo(page, [AGOTADO]);
    await page.goto('/productos');

    const card = page.locator('a[href="/productos/mate-agotado"]').first();
    await expect(card).toBeVisible();

    // Badge sobre la imagen + línea en la columna de texto.
    await expect(page.getByText('Sin stock', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin stock por ahora')).toBeVisible();

    // El botón de agregar no existe para esta card (ni oculto tras el hover).
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toHaveCount(0);

    // El descuento no se anuncia sobre algo no comprable.
    await expect(page.getByText('-25%')).toHaveCount(0);

    // Pero la card sigue llevando a la PDP.
    await expect(card).toHaveAttribute('href', '/productos/mate-agotado');
  });

  test('un producto con stock en el mismo listado conserva el botón "Agregar al carrito"', async ({ page }) => {
    await mockCatalogo(page, [DISPONIBLE, AGOTADO]);
    await page.goto('/productos');

    await expect(page.locator('a[href="/productos/mate-con-stock"]').first()).toBeVisible();

    // Hover sobre la card con stock: aparece su botón (uno solo, el de la
    // card disponible — la agotada no lo tiene).
    await page.locator('a[href="/productos/mate-con-stock"]').first().hover();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
  });

  test('agregar desde la card con stock funciona; la agotada nunca llega al carrito', async ({ page }) => {
    await mockCatalogo(page, [DISPONIBLE, AGOTADO]);
    await page.goto('/productos');

    await page.locator('a[href="/productos/mate-con-stock"]').first().hover();
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    // Solo el producto con stock llega al carrito; el agotado nunca se pudo sumar.
    await page.goto('/carrito');
    await expect(page.getByText('Mate Con Stock')).toBeVisible();
    await expect(page.getByText('Mate Agotado')).toHaveCount(0);
    await expect(page.getByText('Tu carrito · 1 producto')).toBeVisible();
  });
});

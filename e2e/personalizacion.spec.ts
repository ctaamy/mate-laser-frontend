import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Valida que los campos de personalización (texto, apto_grabado) aparezcan/
// desaparezcan según la config de cada producto, en la página de detalle
// (ProductoDetalle.tsx) — no hay un modal separado, la sección de
// personalización es inline dentro de la misma página.
//
// El grabado láser es de un solo color (el del material quemado), así que el
// cliente NO elige color: el selector "Color de grabado" se sacó de la PDP.
// `colores_disponibles` sigue existiendo en el producto pero no se ofrece acá.

async function mockProducto(page: import('@playwright/test').Page, overrides: Record<string, any>) {
  const producto = { ...PRODUCTO_MOCK, ...overrides };
  await page.route(`**/api/v1/productos/${producto.slug}`, (route) =>
    route.fulfill({ json: producto }),
  );
  // Tema global y navbar (montados globalmente vía Layout/App): sin esto el
  // test queda acoplado al backend real de desarrollo.
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
  // Cuotas bancarias (CuotasBanner, montado en la PDP) — sin mock, la
  // request se cuela a la red real y devuelve 500 (ver fixtures.ts).
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
    route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  return producto;
}

test.describe('Personalización de producto', () => {
  test('producto apto_grabado: muestra toggle y campo de texto (sin selector de color)', async ({ page }) => {
    await mockProducto(page, {});
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const toggle = page.getByText('Grabado personalizado');
    await expect(toggle).toBeVisible();

    // Antes de activar, no se ven los campos de personalización
    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).not.toBeVisible();

    await toggle.click();

    // El selector de color de grabado ya no existe, aunque el producto tenga
    // colores_disponibles cargados.
    await expect(page.getByText('Color de grabado')).not.toBeVisible();
    for (const color of PRODUCTO_MOCK.colores_disponibles) {
      await expect(page.getByRole('button', { name: color, exact: true })).not.toBeVisible();
    }

    const inputTexto = page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder);
    await expect(inputTexto).toBeVisible();
    await inputTexto.fill('Para Juan');
    await expect(page.getByText(`9/${PRODUCTO_MOCK.personalizado_max_chars}`)).toBeVisible();
  });

  test('producto sin apto_grabado: no muestra ninguna opción de personalización', async ({ page }) => {
    await mockProducto(page, { apto_grabado: false, personalizado_habilitado: false });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.getByText('Grabado personalizado')).not.toBeVisible();
    await expect(page.getByText('Apto grabado', { exact: true })).not.toBeVisible(); // badge de la imagen
  });

  test('agregar al carrito con personalización: sin errores de consola y sin color en el item', async ({ page }) => {
    const erroresConsola: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()); });
    page.on('pageerror', (err) => erroresConsola.push(err.message));

    await mockProducto(page, {});
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByText('Grabado personalizado').click();
    await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('Para Juan');
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    await expect(page.getByText('✓ Agregado')).toBeVisible();

    // El item no lleva `color`: la PDP ya no lo setea.
    const carrito = await page.evaluate(() => {
      const raw = localStorage.getItem('carrito-storage');
      return raw ? JSON.parse(raw) : null;
    });
    expect(carrito.state.items).toHaveLength(1);
    expect(carrito.state.items[0].texto_grabado).toBe('Para Juan');
    expect(carrito.state.items[0].color ?? null).toBeNull();

    // Ignoramos ruido de red de recursos no mockeados (ej. favicon); no es
    // parte de la lógica de la app bajo test.
    const erroresRelevantes = erroresConsola.filter((e) => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(erroresRelevantes).toEqual([]);
  });
});

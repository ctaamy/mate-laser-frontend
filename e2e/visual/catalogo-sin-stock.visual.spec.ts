import { test, expect } from '@playwright/test';

// Fase 1 del arreglo del flujo "sin stock": la card del catálogo (variante
// "catalogo" de ProductCard) cuando `disponible === false`:
//   - imagen atenuada (opacity-60), NO desaturada (el gris mata la veta de la
//     madera y dice "descontinuado")
//   - un solo badge neutro "Sin stock" arriba a la izquierda (gris, no rojo —
//     el rojo es del carrito, donde el usuario ya se comprometió), sin -X%
//   - "Sin stock por ahora" en la columna de texto (única señal en mobile,
//     donde no hay hover)
//   - sin botón "Agregar al carrito"
// Baseline generada localmente (Desktop Chrome). Si CI reporta diff, regenerar
// con `npm run test:visual:update` en el mismo entorno que el resto.

function cuadrado(color: string) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${color}"/></svg>`,
  );
}

const CON_STOCK = {
  id: 'p-ok', nombre: 'Mate Imperial Grabado', slug: 'mate-imperial',
  precio_base: 15000, apto_grabado: true, colores_disponibles: [],
  personalizado_habilitado: false, personalizado_max_chars: 0,
  disponible: true, pocas_unidades: false, cantidad_maxima: 10,
  activo: true, destacado: false, orden: 0, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i-ok', url: cuadrado('#593E2E'), alt_texto: 'Con stock', orden: 0 }],
};

const AGOTADO = {
  id: 'p-no', nombre: 'Bombilla Alpaca Cincelada', slug: 'bombilla-alpaca',
  precio_base: 12000, precio_tachado: 16000, apto_grabado: true, colores_disponibles: [],
  personalizado_habilitado: false, personalizado_max_chars: 0,
  disponible: false, pocas_unidades: false, cantidad_maxima: 0,
  activo: true, destacado: false, orden: 1, creado_en: new Date().toISOString(),
  imagenes_producto: [{ id: 'i-no', url: cuadrado('#0a2218'), alt_texto: 'Agotado', orden: 0 }],
};

test.describe('Visual — catálogo con producto sin stock', () => {
  test('card agotada: imagen atenuada, badge neutro, sin botón de agregar', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
      route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
    await page.route('**/api/v1/productos**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== '/api/v1/productos') return route.continue();
      return route.fulfill({ json: { data: [CON_STOCK, AGOTADO], total: 2, page: 1, totalPages: 1 } });
    });

    await page.goto('/productos');
    await expect(page.getByText('Sin stock', { exact: true })).toBeVisible();
    await page.waitForTimeout(600); // deja asentar la animación de entrada (whileInView, JS-driven)
    // La card entera (imagen + columna de texto), no solo el bloque de imagen.
    const card = page.locator('.group', { has: page.locator('a[href="/productos/bombilla-alpaca"]') });
    await expect(card).toHaveScreenshot('card-agotada.png');
  });
});

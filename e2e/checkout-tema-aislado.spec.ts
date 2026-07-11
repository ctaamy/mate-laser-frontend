import { test, expect } from '@playwright/test';

// El flujo de compra (Carrito, Checkout, Pago, Confirmación) es una
// decisión de producto: paleta FIJA y neutra, sin importar el tema que el
// admin configure para el resto del sitio (confianza/reconocimiento en el
// momento transaccional). Antes, el <div> raíz de estas 4 páginas heredaba
// background-color/color/font-family de ".tema-publico" (Layout.tsx) por
// no tener valores propios — ahora usan ".flujo-compra" (index.css), que
// declara sus propios valores fijos y nunca lee las CSS variables del tema.
//
// El Navbar y el Footer NO llevan esta clase — son elementos globales de
// todo el sitio (incluido el checkout) y siguen mostrando el tema del
// admin a propósito. Un test de este archivo lo confirma explícitamente.

const TEMA_EXTREMO = {
  tema_bg_color: '#00ffff',   // cian
  tema_texto_color: '#ff00ff', // magenta
  tema_font_family: 'Georgia, serif',
};

const MAGENTA = 'rgb(255, 0, 255)';
const FIJO_TEXTO = 'rgb(23, 23, 23)'; // #171717, valor fijo de .flujo-compra

const ITEM_CARRITO = {
  producto_id: 'prod-checkout-1',
  nombre_producto: 'Mate Imperial Grabado',
  precio_unitario: 8000,
  cantidad: 1,
};

async function mockTemaYHomepage(page: import('@playwright/test').Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
    // El footer solo hereda el tema si ya existe como sección migrada (ver
    // Footer.tsx) — sin esto, el test de Navbar/Footer de más abajo
    // fallaría por el fallback pre-migración, no por un bug real.
    route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }] }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: TEMA_EXTREMO }));
}

async function sembrarCarrito(page: import('@playwright/test').Page) {
  await page.addInitScript((item) => {
    window.localStorage.setItem(
      'carrito-storage',
      JSON.stringify({ state: { items: [item] }, version: 0 }),
    );
  }, ITEM_CARRITO);
}

const ORDEN_MOCK = {
  id: 'orden-tema-1', estado: 'pendiente', total: 8000, subtotal: 8000, costo_envio: 0,
  metodo_pago: 'mercadopago', direccion_envio: { calle: 'Falsa 123' },
  creado_en: new Date().toISOString(), items_orden: [], pagos: [{ estado: 'pendiente', proveedor: 'mercadopago' }],
};

test.describe('Flujo de compra — paleta fija, aislada del tema público', () => {
  test('Carrito: el contenido no hereda el tema (fondo/texto/tipografía fijos), aunque el Navbar sí lo muestra', async ({ page }) => {
    await mockTemaYHomepage(page);
    await sembrarCarrito(page);

    await page.goto('/carrito');

    const nav = page.locator('nav');
    await expect(nav).toHaveCSS('background-color', 'rgb(0, 255, 255)');

    const contenido = page.locator('.flujo-compra');
    await expect(contenido).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(contenido).toHaveCSS('color', FIJO_TEXTO);
    await expect(contenido).not.toHaveCSS('color', MAGENTA);
    await expect(contenido).not.toHaveCSS('font-family', /Georgia/);
  });

  test('Checkout: el contenido no hereda el tema', async ({ page }) => {
    await mockTemaYHomepage(page);
    await sembrarCarrito(page);
    await page.route('**/api/v1/envios/calcular', (route) => route.fulfill({ json: [] }));

    await page.goto('/checkout');

    const contenido = page.locator('.flujo-compra');
    await expect(contenido).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(contenido).not.toHaveCSS('color', MAGENTA);
    await expect(contenido).not.toHaveCSS('font-family', /Georgia/);
  });

  test('Pago: el contenido no hereda el tema', async ({ page }) => {
    // Stub del SDK de MP — sin esto, "new window.MercadoPago(...)" tira
    // (no es un constructor real) y React desmonta el árbol entero al no
    // haber error boundary, llevándose puesto el .flujo-compra con él.
    await page.addInitScript(() => {
      window.MercadoPago = function () {
        return { bricks: () => ({ create: () => Promise.resolve({ unmount: () => {} }) }) };
      } as any;
    });
    await mockTemaYHomepage(page);
    await page.route(`**/api/v1/ordenes/${ORDEN_MOCK.id}`, (route) => route.fulfill({ json: ORDEN_MOCK }));
    await page.route('https://sdk.mercadopago.com/js/v2', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: '/* noop: MercadoPago ya definido vía addInitScript */' }),
    );

    await page.goto(`/pago/${ORDEN_MOCK.id}`);

    const contenido = page.locator('.flujo-compra');
    await expect(contenido).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(contenido).not.toHaveCSS('color', MAGENTA);
    await expect(contenido).not.toHaveCSS('font-family', /Georgia/);
  });

  test('Confirmación: el contenido no hereda el tema', async ({ page }) => {
    await mockTemaYHomepage(page);
    await page.route(`**/api/v1/ordenes/${ORDEN_MOCK.id}`, (route) => route.fulfill({ json: ORDEN_MOCK }));

    await page.goto(`/confirmacion/${ORDEN_MOCK.id}`);

    const contenido = page.locator('.flujo-compra');
    await expect(contenido).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(contenido).not.toHaveCSS('color', MAGENTA);
    await expect(contenido).not.toHaveCSS('font-family', /Georgia/);
  });

  test('Navbar y Footer siguen mostrando el tema del admin dentro del flujo de compra (a propósito)', async ({ page }) => {
    await mockTemaYHomepage(page);
    await sembrarCarrito(page);

    await page.goto('/carrito');

    await expect(page.locator('nav')).toHaveCSS('background-color', 'rgb(0, 255, 255)');
    await expect(page.locator('footer')).toHaveCSS('background-color', 'rgb(0, 255, 255)');
  });
});

import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago } from './fixtures';

// Code splitting por ruta (src/lib/cargaDeRutas.ts). Estos tests corren contra el
// dev server de Vite, donde cada pantalla es un módulo `/src/pages/<Nombre>.tsx`
// que se pide recién al entrar a esa ruta — igual que en producción cada pantalla
// es su propio chunk. La verificación contra el build minificado está en
// e2e-build/ (npm run test:build).

const MODULO = (nombre: string) => new RegExp(`/src/pages/${nombre}\\.tsx`);

function registrarModulosPedidos(page: Page) {
  const pedidos: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/src\/(pages|components\/layout)\/([^?]+)\.tsx/);
    if (m) pedidos.push(`${m[1]}/${m[2]}`);
  });
  return pedidos;
}

test.describe('Carga diferida de pantallas', () => {
  test('la home no descarga el panel admin ni el checkout (solo lo que necesita)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const pedidos = registrarModulosPedidos(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(pedidos.filter((p) => p.startsWith('pages/admin/') || p === 'components/layout/AdminLayout')).toEqual([]);
    for (const pantalla of ['pages/Checkout', 'pages/Pago', 'pages/Confirmacion', 'pages/MiCuenta', 'pages/Login']) {
      expect(pedidos, pantalla).not.toContain(pantalla);
    }
  });

  test('mientras llega la pantalla muestra un indicador de carga y después el contenido', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route(MODULO('Carrito'), async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto('/carrito');

    await expect(page.getByRole('status').filter({ hasText: 'Cargando' })).toBeVisible();
    // El navbar sigue en su lugar mientras tanto (el layout no se cargó diferido).
    await expect(page.getByRole('link', { name: 'Productos' }).first()).toBeVisible();
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
  });

  test('desde la home precarga en un momento ocioso la pantalla a la que es probable ir', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const pedidos = registrarModulosPedidos(page);
    await page.goto('/');
    await expect.poll(() => pedidos, { timeout: 8000 }).toEqual(expect.arrayContaining(['pages/Productos', 'pages/ProductoDetalle']));
    // No trae lo que no corresponde todavía.
    expect(pedidos).not.toContain('pages/Checkout');
  });

  test('en el carrito precarga checkout y pago (el siguiente paso de la compra)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const pedidos = registrarModulosPedidos(page);
    await page.goto('/carrito');
    await expect.poll(() => pedidos, { timeout: 8000 }).toEqual(
      expect.arrayContaining(['pages/Carrito', 'pages/Checkout', 'pages/Pago', 'pages/Confirmacion']),
    );
  });
});

// Quien tiene la app abierta de antes de un deploy pide un chunk con hash que ya no
// existe. Se simula abortando el pedido del módulo.
test.describe('Chunk que no se puede traer (típico: después de un deploy)', () => {
  test('recarga la página UNA vez y entonces la pantalla carga', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    let pedidos = 0;
    await page.route(MODULO('Carrito'), (route) => {
      pedidos += 1;
      return pedidos === 1 ? route.abort() : route.continue();
    });

    await page.goto('/carrito');

    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    expect(pedidos).toBe(2); // el fallido + el de la página recargada
  });

  test('si falla otra vez no recarga en loop: muestra el aviso con "Recargar"', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    let pedidos = 0;
    await page.route(MODULO('Carrito'), (route) => {
      pedidos += 1;
      return route.abort();
    });

    await page.goto('/carrito');

    const aviso = page.getByRole('alert').filter({ hasText: 'No pudimos cargar esta pantalla' });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole('button', { name: 'Recargar' })).toBeVisible();
    // Un intento, una recarga, un segundo intento y se rinde: nunca más de 2.
    await page.waitForTimeout(1500);
    expect(pedidos).toBe(2);
  });

  test('el aviso de error desaparece al navegar a otra pantalla que sí carga', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route(MODULO('Carrito'), (route) => route.abort());
    await page.goto('/carrito');
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar esta pantalla' })).toBeVisible();

    await page.getByRole('link', { name: 'Productos' }).first().click();

    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar esta pantalla' })).toHaveCount(0);
  });
});

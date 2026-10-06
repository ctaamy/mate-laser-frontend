import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from '../e2e/fixtures';

// Contra el build real servido con `serve` (ver playwright.build.config.ts).

test.describe('Build de producción', () => {
  test('la home carga sin errores de JS y con el bundle inicial dividido', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    const scripts: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/assets/') && r.url().endsWith('.js')) scripts.push(r.url().split('/assets/')[1]);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errores).toEqual([]);
    // El panel admin y el checkout NO viajan en la carga de la home.
    expect(scripts.filter((s) => /^(AdminLayout|Dashboard|Ordenes|Configuracion|Checkout|Pago)-/.test(s))).toEqual([]);
    // Las librerías de terceros van en chunks propios.
    expect(scripts.some((s) => s.startsWith('vendor-react-'))).toBe(true);
  });

  test('el camino de compra anda de punta a punta con chunks: ficha → carrito → checkout', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    await expect(page.getByText('✓ Agregado')).toBeVisible();

    await page.goto('/carrito');
    await expect(page.getByText(PRODUCTO_MOCK.nombre).first()).toBeVisible();
    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();

    expect(errores).toEqual([]);
  });

  test('la pantalla de pago (chunk aparte) monta el Brick de Mercado Pago bajo la CSP real', async ({ page }) => {
    const { ordenId } = await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto(`/pago/${ordenId}`);

    // Esta línea solo aparece cuando el SDK cargó y el Brick llamó a onReady.
    await expect(page.getByText('Con tarjeta, elegí si es de crédito o de débito.')).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('/admin sin sesión manda al login (el layout del admin es un chunk aparte)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /Ingresar|Iniciar sesión/i }).first()).toBeVisible();
  });

  test('cabeceras de caché reales: assets inmutables, HTML y rutas de la SPA siempre revalidados', async ({ request }) => {
    const html = await request.get('/');
    expect(html.headers()['cache-control']).toBe('no-cache');
    const ruta = await request.get('/productos/lo-que-sea');
    expect(ruta.headers()['cache-control']).toBe('no-cache');

    const asset = (await html.text()).match(/\/assets\/[^"]+\.js/)![0];
    const js = await request.get(asset);
    expect(js.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(js.headers()['x-frame-options']).toBe('SAMEORIGIN'); // las cabeceras de seguridad se mantienen
  });

  test('un asset que ya no existe (deploy nuevo) vuelve como HTML sin caché, nunca inmutable', async ({ request }) => {
    const r = await request.get('/assets/Carrito-VIEJO123.js');
    expect(r.headers()['content-type']).toContain('text/html');
    expect(r.headers()['cache-control']).toBe('no-cache');
  });

  test('después de un deploy: el chunk viejo vuelve como HTML → recarga una vez y no entra en loop', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    let pedidos = 0;
    // Lo que hace `serve -s` con un chunk borrado: 200 text/html con el index.html.
    await page.route(/\/assets\/Carrito-[^/]+\.js$/, (route) => {
      pedidos += 1;
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' });
    });

    await page.goto('/carrito');

    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos cargar esta pantalla' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(pedidos).toBe(2);
  });
});

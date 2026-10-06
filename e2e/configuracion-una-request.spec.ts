import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// /configuracion se pedía DOS veces en cada página: algunos hooks usaban la query
// key ['configuracion'] y otros ['configuracion','publicado'], así que React Query
// no las unificaba. Son 46 kB crudos por request. Ahora todos pasan por useConfiguracion.

async function contarConfiguracion(page: Page, ruta: string) {
  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  let pedidos = 0;
  page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().endsWith('/api/v1/configuracion')) pedidos += 1;
  });
  await page.goto(ruta);
  // Llega al menos una; después se deja un margen para que aparezca una duplicada.
  await expect.poll(() => pedidos).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  return pedidos;
}

test.describe('GET /configuracion se pide una sola vez por carga de página', () => {
  test('home', async ({ page }) => {
    expect(await contarConfiguracion(page, '/')).toBe(1);
  });

  test('ficha de producto', async ({ page }) => {
    expect(await contarConfiguracion(page, `/productos/${PRODUCTO_MOCK.slug}`)).toBe(1);
  });

  test('carrito', async ({ page }) => {
    expect(await contarConfiguracion(page, '/carrito')).toBe(1);
  });

  test('página estática (/terminos)', async ({ page }) => {
    expect(await contarConfiguracion(page, '/terminos')).toBe(1);
  });
});

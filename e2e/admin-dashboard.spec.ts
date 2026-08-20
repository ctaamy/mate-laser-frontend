import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 11: "Ventas totales" sumaba a mano las órdenes de
// GET /ordenes?limit=100 (truncado si hay más de 100 históricas) y no
// existía ninguna métrica de "hoy" — el nombre de la card inducía a
// pensar que era del día. Ahora "Ventas hoy" y "Ventas históricas" salen
// de un endpoint agregado (GET /ordenes/estadisticas) sin ese límite.

test.describe('Admin — Dashboard — métricas de ventas', () => {
  test('muestra "Ventas hoy" y "Ventas históricas" como métricas separadas y sin ambigüedad', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: { ventas_totales: 950000, ventas_hoy: 12000, ordenes_totales: 137, ordenes_pendientes: 4 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();
    await expect(page.getByText('Ventas históricas', { exact: true })).toBeVisible();
    await expect(page.getByText('$12.000', { exact: false })).toBeVisible();
    await expect(page.getByText('$950.000', { exact: false })).toBeVisible();

    // "Órdenes totales" y "Pendientes de pago" vienen del agregado, no de
    // contar el array (que estaría cortado en 100).
    await expect(page.getByText('137', { exact: false })).toBeVisible();
    await expect(page.getByText('4', { exact: true })).toBeVisible();
  });

  test('sin ventas hoy, muestra $0 en vez de romperse o quedar en blanco', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    const cardVentasHoy = page.getByText('Ventas hoy', { exact: true }).locator('..').locator('..');
    await expect(cardVentasHoy.getByText('$0')).toBeVisible();
  });

  // Fase 3: desglose online/manual — opcional, no reemplaza "Ventas históricas".
  test('con ventas manuales cargadas, muestra el desglose online vs. manual', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: {
        ventas_totales: 100000, ventas_hoy: 0, ordenes_totales: 20, ordenes_pendientes: 0,
        ventas_totales_manual: 30000, ventas_totales_web: 70000, ordenes_totales_manual: 6,
      } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByText('$70.000', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('$30.000', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('(6 órdenes)', { exact: false })).toBeVisible();
  });

  test('sin ventas manuales, no muestra el desglose (no ensucia el dashboard)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: {
        ventas_totales: 950000, ventas_hoy: 12000, ordenes_totales: 137, ordenes_pendientes: 4,
        ventas_totales_manual: 0, ventas_totales_web: 950000, ordenes_totales_manual: 0,
      } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByText('cargadas a mano', { exact: false })).not.toBeVisible();
  });
});

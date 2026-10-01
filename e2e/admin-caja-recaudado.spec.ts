import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Resumen de Caja: lo recaudado (ventas cobradas) y lo que falta cobrar (señas,
// pagos parciales), separado de la plata disponible. Backend simulado.

test.describe('Caja — recaudado y por cobrar', () => {
  test('muestra recaudado del mes, recaudado total y lo que falta cobrar, sin tocar la plata disponible', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { cobros: { total: 480000, mes: 215500, porCobrar: 113500, ordenes: 3 } });

    await page.goto('/admin/caja');

    await expect(page.getByTestId('recaudado-mes')).toHaveText('$215.500');
    await expect(page.getByTestId('recaudado-total')).toHaveText('$480.000');
    await expect(page.getByTestId('por-cobrar')).toHaveText('$113.500');
    await expect(page.getByTestId('resumen-cobros')).toContainText('De 3 ventas con seña o pago pendiente');
    // "Falta cobrar" no es plata que haya: la disponible sigue siendo la de las cuentas.
    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
  });

  test('sin ventas pendientes lo dice, y en singular con una sola', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { cobros: { total: 1000, mes: 0, porCobrar: 0, ordenes: 0 } });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('por-cobrar')).toHaveText('$0');
    await expect(page.getByTestId('resumen-cobros')).toContainText('No hay ventas con saldo pendiente');
  });

  test('una sola venta pendiente va en singular', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { cobros: { total: 1000, mes: 1000, porCobrar: 42000, ordenes: 1 } });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('resumen-cobros')).toContainText('De 1 venta con seña');
  });

  test('con un backend viejo (sin los campos nuevos) no aparece el bloque ni se rompe la pantalla', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja');
    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    await expect(page.getByTestId('resumen-cobros')).toHaveCount(0);
  });

  test('en el celu no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await loginComoAdmin(page);
    await mockCaja(page, { cobros: { total: 12345678, mes: 2345678, porCobrar: 1113500, ordenes: 12 } });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('por-cobrar')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

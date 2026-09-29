import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Caja: las ventas de MercadoLibre cuya plata MeLI todavía no liberó se listan
// para marcarlas "Ya se liberó" (el neto ya está en la cuenta, como "a liberar").
// Backend simulado (ver fixtures-caja.ts).

const VENTAS = [
  { pago_id: 'pago-meli-1', pedido: 'a1b2c3d4', cuenta_id: 'c-mp', bruto: 20000, neto: 17300, liberacion_estimada: '2026-10-10' },
  { pago_id: 'pago-meli-2', pedido: 'ffee0011', cuenta_id: 'c-mp', bruto: 9000, neto: 9000, liberacion_estimada: null },
];

test.describe('Caja — MercadoLibre por liberar', () => {
  test('lista cada venta con su neto, lo que pagó el cliente y la fecha estimada', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { aLiberar: 26300, meli: VENTAS });
    await page.goto('/admin/caja');

    const filas = page.getByTestId('meli-fila');
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText('Pedido #A1B2C3D4');
    await expect(filas.nth(0)).toContainText('$17.300');
    await expect(filas.nth(0)).toContainText('Cobró el cliente $20.000');
    await expect(filas.nth(0)).toContainText('Se libera el 10/10/2026');
    // Sin comisión no repite el monto; sin fecha lo dice.
    await expect(filas.nth(1)).not.toContainText('Cobró el cliente');
    await expect(filas.nth(1)).toContainText('Sin fecha estimada');
  });

  test('el aviso de "a liberar" nombra a MercadoLibre además de Mercado Pago', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { aLiberar: 26300, meli: VENTAS });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('a-liberar')).toContainText('$26.300');
    await expect(page.getByTestId('a-liberar')).toContainText('todavía no se libera');
    await expect(page.getByTestId('a-liberar')).toContainText('MercadoLibre');
  });

  test('"Ya se liberó" llama al backend, avisa y saca la venta de la lista', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { aLiberar: 26300, meli: VENTAS });
    await page.goto('/admin/caja');

    await page.getByTestId('meli-fila').first().getByRole('button', { name: 'Ya se liberó' }).click();

    await expect.poll(() => cap.liberaciones).toEqual(['pago-meli-1']);
    await expect(page.getByTestId('meli-fila')).toHaveCount(1);
    await expect(page.getByText('esa plata ya figura como disponible')).toBeVisible();
  });

  test('si el backend falla, avisa y la venta sigue en la lista', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { aLiberar: 26300, meli: VENTAS, estadoLiberar: 500 });
    await page.goto('/admin/caja');

    await page.getByTestId('meli-fila').first().getByRole('button', { name: 'Ya se liberó' }).click();

    await expect.poll(() => cap.liberaciones.length).toBe(1);
    await expect(page.getByText('No se pudo marcar como liberado')).toBeVisible();
    await expect(page.getByTestId('meli-fila')).toHaveCount(2);
  });

  test('sin ventas pendientes (o con un backend viejo) no aparece la sección', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { meli: [] });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('total-negocio')).toBeVisible();
    await expect(page.getByTestId('meli-por-liberar')).toHaveCount(0);

    await mockCaja(page); // sin el campo: como un backend viejo
    await page.goto('/admin/caja');
    await expect(page.getByTestId('meli-por-liberar')).toHaveCount(0);
  });

  test('en el celu no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await loginComoAdmin(page);
    await mockCaja(page, { aLiberar: 26300, meli: VENTAS });
    await page.goto('/admin/caja');
    await expect(page.getByTestId('meli-fila').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// El pago se ve aparte del avance del pedido: una venta puede estar cobrada y
// sin preparar, o en preparación con solo la seña. El backend está simulado.

const base = { metodo_pago: 'transferencia', creado_en: new Date().toISOString(), items_orden: [], usuarios: null, direccion_envio: { nombre: 'Cli' } };

const ordenes = [
  { ...base, id: 'aaaaaaaa-1', canal: 'admin_manual', estado: 'pagado', total: 44500, estado_pago: 'pagado', monto_cobrado: 44500, saldo: 0, pagos: [{ id: 'p1', estado: 'aprobado', monto: 44500 }] },
  { ...base, id: 'bbbbbbbb-2', canal: 'admin_manual', estado: 'en_preparacion', total: 83000, estado_pago: 'parcial', monto_cobrado: 41500, saldo: 41500, pagos: [{ id: 'p2', estado: 'aprobado', monto: 41500 }] },
  { ...base, id: 'cccccccc-3', canal: 'admin_manual', estado: 'pendiente_pago', total: 42000, estado_pago: 'pendiente', monto_cobrado: 0, saldo: 42000, pagos: [] },
  { ...base, id: 'dddddddd-4', canal: 'web', estado: 'entregado', total: 9000, estado_pago: 'pagado', monto_cobrado: 9000, saldo: 0, pagos: [{ id: 'p4', estado: 'aprobado', monto: 9000 }] },
  { ...base, id: 'eeeeeeee-5', canal: 'admin_manual', estado: 'cancelado', total: 5000, estado_pago: null, monto_cobrado: 0, saldo: 0, pagos: [] },
];

const fila = (page: import('@playwright/test').Page, id: string) => page.locator('tr', { hasText: `#${id.slice(0, 8).toUpperCase()}` });

test.describe('Admin — Órdenes — cobro y pedido por separado', () => {
  test.beforeEach(async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: ordenes, total: ordenes.length, page: 1, totalPages: 1 } }));
    await page.goto('/admin/ordenes');
  });

  test('pagada pero sin empezar: cobro "pagado" y pedido "Sin empezar"', async ({ page }) => {
    const f = fila(page, 'aaaaaaaa-1');
    await expect(f.getByTestId('badge-pago')).toHaveText('pagado');
    await expect(f).toContainText('Sin empezar');
  });

  test('en preparación con solo la seña: cobro "pago parcial" y pedido "En preparación", con el saldo', async ({ page }) => {
    const f = fila(page, 'bbbbbbbb-2');
    await expect(f.getByTestId('badge-pago')).toHaveText('pago parcial');
    await expect(f).toContainText('En preparación');
    await expect(f).toContainText('saldo $41.500');
  });

  test('sin cobrar: "sin cobrar" y Sin empezar', async ({ page }) => {
    const f = fila(page, 'cccccccc-3');
    await expect(f.getByTestId('badge-pago')).toHaveText('sin cobrar');
    await expect(f).toContainText('Sin empezar');
    await expect(f).toContainText('saldo $42.000');
  });

  test('orden web entregada: pagada y entregada, sin saldo', async ({ page }) => {
    const f = fila(page, 'dddddddd-4');
    await expect(f.getByTestId('badge-pago')).toHaveText('pagado');
    await expect(f).toContainText('Entregado');
    await expect(f).not.toContainText('saldo');
  });

  test('cancelada: no muestra estado de cobro', async ({ page }) => {
    const f = fila(page, 'eeeeeeee-5');
    await expect(f.getByTestId('badge-pago')).toHaveCount(0);
    await expect(f).toContainText('Cancelado');
  });

  test('una venta en preparación con saldo sigue mostrando "Registrar pago" en Gestionar', async ({ page }) => {
    await fila(page, 'bbbbbbbb-2').getByRole('button', { name: 'Gestionar' }).click();
    await expect(page.getByText('Registrar pago', { exact: false }).first()).toBeVisible();
    // Las opciones del estado del pedido no ofrecen los estados del cobro.
    const select = page.locator('select').filter({ has: page.locator('optgroup') });
    const opciones = await select.locator('option').allTextContents();
    expect(opciones).not.toContain('Pago parcial');
    expect(opciones).not.toContain('Sin cobrar');
    // Ni el estado actual: no es de cobro, es del pedido (la orden está "En preparación").
    // (es una venta MANUAL: su paso inicial es "Sin empezar"; "Sin empezar (pagado)" es el de las órdenes web)
    expect(opciones).toContain('Sin empezar');
    expect(opciones).not.toContain('Sin empezar (pagado)');
    expect(opciones).toContain('En preparación');
  });
});

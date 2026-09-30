import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// C3 — una venta manual nace 'sin_preparar' (paso previo al diseño / la preparación) sin importar cuánto se
// cobró: el cobro se ve aparte, en su columna. Las ventas manuales viejas todavía pueden estar en
// 'pendiente_pago' / 'pago_parcial' / 'pagado' y se siguen viendo bien. Backend simulado.

const base = { creado_en: new Date().toISOString(), items_orden: [], usuarios: null, direccion_envio: { nombre: 'Cli' } };
const manual = (id: string, estado: string, cobrado: number, total = 83000, extra: Record<string, unknown> = {}) => ({
  ...base,
  id,
  canal: 'admin_manual',
  metodo_pago: 'efectivo',
  estado,
  total,
  estado_pago: cobrado <= 0 ? 'pendiente' : cobrado < total ? 'parcial' : 'pagado',
  monto_cobrado: cobrado,
  saldo: Math.max(0, total - cobrado),
  pagos: cobrado > 0 ? [{ id: 'p-' + id, estado: 'aprobado', monto: cobrado }] : [],
  ...extra,
});
const web = (id: string, estado: string) => ({
  ...base, id, canal: 'web', metodo_pago: 'mercadopago', estado, total: 9000, estado_pago: 'pagado', monto_cobrado: 9000, saldo: 0, pagos: [{ id: 'p-w', estado: 'aprobado', monto: 9000 }],
});

const fila = (page: Page, id: string) => page.locator('tr', { hasText: `#${id.slice(0, 8).toUpperCase()}` });
const selectEstado = (page: Page) => page.locator('select').filter({ has: page.locator('optgroup') });

async function abrir(page: Page, ordenes: unknown[]) {
  await loginComoAdmin(page);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: ordenes, total: ordenes.length, page: 1, totalPages: 1 } }));
  await page.goto('/admin/ordenes');
}

test.describe('Admin — Órdenes — venta manual "Sin empezar"', () => {
  test('sin cobrar, con seña y saldada se ven igual de "Sin empezar" en el pedido; el cobro es lo que cambia', async ({ page }) => {
    await abrir(page, [
      manual('aaaaaaaa-1', 'sin_preparar', 0, 42000),
      manual('bbbbbbbb-2', 'sin_preparar', 41500),
      manual('cccccccc-3', 'sin_preparar', 5000, 5000),
    ]);

    for (const [id, cobro] of [['aaaaaaaa-1', 'sin cobrar'], ['bbbbbbbb-2', 'pago parcial'], ['cccccccc-3', 'pagado']] as const) {
      const f = fila(page, id);
      await expect(f.getByTestId('badge-pago')).toHaveText(cobro);
      await expect(f).toContainText('Sin empezar');
    }
    await expect(fila(page, 'bbbbbbbb-2')).toContainText('saldo $41.500');
    await expect(fila(page, 'cccccccc-3')).not.toContainText('saldo');
  });

  test('el badge del pedido es gris (nadie empezó) y no muestra la clave cruda', async ({ page }) => {
    await abrir(page, [manual('aaaaaaaa-1', 'sin_preparar', 100)]);
    await expect(fila(page, 'aaaaaaaa-1').getByText('Sin empezar')).toHaveClass(/bg-gray-100/);
    await expect(page.locator('tbody')).not.toContainText('sin_preparar');
    await expect(page.locator('tbody')).not.toContainText('sin preparar');
  });

  test('las ventas manuales viejas (pendiente_pago / pago_parcial / pagado) también se ven como "Sin empezar"', async ({ page }) => {
    await abrir(page, [
      manual('dddddddd-4', 'pendiente_pago', 0, 42000),
      manual('eeeeeeee-5', 'pago_parcial', 100),
      manual('ffffffff-6', 'pagado', 83000),
    ]);
    for (const id of ['dddddddd-4', 'eeeeeeee-5', 'ffffffff-6']) await expect(fila(page, id)).toContainText('Sin empezar');
  });

  test('el select de una venta manual ofrece "Sin empezar" (no "Sin empezar (pagado)", que es de las órdenes web)', async ({ page }) => {
    await abrir(page, [manual('aaaaaaaa-1', 'sin_preparar', 100)]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();

    const opciones = await selectEstado(page).locator('option').allTextContents();
    expect(opciones).toEqual([
      'En diseño', 'Diseño listo', 'Esperando OK del cliente',
      'Sin empezar', 'En preparación',
      'Listo para retirar', 'Listo para enviar', 'Enviado', 'Entregado',
      'Cancelado',
    ]);
    await expect(selectEstado(page)).toHaveValue('sin_preparar');
  });

  test('el select de una orden web ya paga sigue ofreciendo "Sin empezar (pagado)"', async ({ page }) => {
    await abrir(page, [web('aaaaaaaa-1', 'pagado')]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    const opciones = await selectEstado(page).locator('option').allTextContents();
    expect(opciones).toContain('Sin empezar (pagado)');
    expect(opciones).not.toContain('Sin empezar');
  });

  test('una venta manual vieja en "pago parcial" muestra su estado actual como "(actual)", sin dejar el select en blanco', async ({ page }) => {
    await abrir(page, [manual('eeeeeeee-5', 'pago_parcial', 100)]);
    await fila(page, 'eeeeeeee-5').getByRole('button', { name: 'Gestionar' }).click();
    await expect(selectEstado(page)).toHaveValue('pago_parcial');
    await expect(selectEstado(page).locator('option').first()).toHaveText('Pago parcial (actual)');
  });

  test('"Registrar pago" aparece mientras haya saldo, y pasar a diseño no lo esconde', async ({ page }) => {
    await abrir(page, [manual('aaaaaaaa-1', 'en_diseno', 41500)]);
    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await expect(page.getByText('Registrar pago', { exact: false }).first()).toBeVisible();
  });

  test('cambiar una venta manual sin empezar a "En diseño" manda el estado al backend', async ({ page }) => {
    await abrir(page, [manual('aaaaaaaa-1', 'sin_preparar', 100)]);
    let body: Record<string, any> | null = null;
    await page.route('**/api/v1/ordenes/aaaaaaaa-1', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      body = route.request().postDataJSON();
      return route.fulfill({ json: { id: 'aaaaaaaa-1' } });
    });
    page.on('dialog', (d) => void d.accept());

    await fila(page, 'aaaaaaaa-1').getByRole('button', { name: 'Gestionar' }).click();
    await selectEstado(page).selectOption('en_diseno');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect.poll(() => body).not.toBeNull();
    expect(body!.estado).toBe('en_diseno');
  });
});

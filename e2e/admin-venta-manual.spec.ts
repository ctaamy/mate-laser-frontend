import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// Venta manual: cargar en el admin una venta realizada fuera de la web
// (presencial, redes, feria) — ver mate-laser-backend/src/modules/ordenes
// (crearVentaManual/registrarPago) y CLAUDE.md.

test.describe('Admin — Órdenes — cargar venta manual', () => {
  test('arma el pedido, calcula el total y lo manda a POST /ordenes/venta-manual', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-1', estado: 'pago_parcial' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByText('Cant.', { exact: true }).locator('..').locator('input').fill('2');
    await page.getByRole('button', { name: 'Agregar' }).click();

    await expect(page.getByText('Total: $16.000')).toBeVisible();

    await page.getByText('Monto cobrado ahora', { exact: true }).locator('..').locator('input').fill('5000');
    await page.getByText('Cliente (opcional)', { exact: true }).locator('..').locator('input').fill('Juan Pérez');

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.items).toEqual([
      expect.objectContaining({ producto_id: PRODUCTO_ADMIN_MOCK.id, cantidad: 2, precio_unitario: 8000 }),
    ]);
    expect(bodyEnviado.monto_pagado).toBe(5000);
    expect(bodyEnviado.metodo_pago).toBe('efectivo');
    expect(bodyEnviado.nombre_cliente).toBe('Juan Pérez');
  });

  test('el botón "Cargar venta" queda deshabilitado sin productos agregados', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await expect(page.getByRole('button', { name: 'Cargar venta', exact: true })).toBeDisabled();
  });
});

test.describe('Admin — Órdenes — registrar pago de una venta manual con seña', () => {
  const ORDEN_PARCIAL = {
    id: 'orden-parcial-1',
    canal: 'admin_manual',
    estado: 'pago_parcial',
    total: 16000,
    metodo_pago: 'efectivo',
    creado_en: new Date().toISOString(),
    direccion_envio: { tipo: 'venta_manual', nombre: 'Juan Pérez' },
    pagos: [{ estado: 'aprobado', monto: 5000 }],
    items_orden: [{ id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2, precio_unitario: 8000, subtotal: 16000 }],
  };

  test('muestra el saldo pendiente y manda el pago nuevo a POST /ordenes/:id/registrar-pago', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_PARCIAL] } }));

    let bodyEnviado: any = null;
    await page.route(`**/api/v1/ordenes/${ORDEN_PARCIAL.id}/registrar-pago`, (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { ...ORDEN_PARCIAL, estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');

    // saldo mostrado en la fila de la tabla
    await expect(page.getByText('saldo $11.000')).toBeVisible();

    await page.getByRole('button', { name: 'Gestionar' }).click();
    await expect(page.getByText('Cobrado: $5.000 de $16.000')).toBeVisible();

    await page.getByText('Monto', { exact: true }).locator('..').locator('input').fill('11000');
    await page.getByRole('button', { name: 'Registrar' }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado).toEqual({ monto: 11000, metodo_pago: 'efectivo' });
  });
});

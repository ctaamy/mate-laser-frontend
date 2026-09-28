import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// Fase 1 de "editar venta manual": agregar/quitar productos de una venta ya
// cargada (antes solo se podía anular todo o registrar un pago nuevo). Ver
// PUT /ordenes/:id/items — mate-laser-backend/src/modules/ordenes/ordenes.service.ts
// (editarItemsVentaManual) y CLAUDE.md.

const ORDEN_MANUAL = {
  id: 'orden-manual-1',
  canal: 'admin_manual',
  estado: 'pago_parcial',
  total: 8000,
  subtotal: 8000,
  costo_envio: 0,
  metodo_pago: 'efectivo',
  metodo_envio_id: null,
  metodos_envio: null,
  envios_orden: [] as unknown[],
  es_prueba: false,
  creado_en: new Date().toISOString(),
  direccion_envio: { nombre: 'Juan Pérez' },
  pagos: [{ estado: 'aprobado', monto: 4000 }],
  items_orden: [
    { id: 'item-1', producto_id: 'otro-prod', nombre_producto: 'Bombilla de acero', cantidad: 1, precio_unitario: 8000, subtotal: 8000, color: null, texto_grabado: null },
  ],
};

test.describe('Admin — Órdenes — agregar productos a una venta manual', () => {
  test('agrega un producto y lo manda a PUT /ordenes/:id/items', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MANUAL] } }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/orden-manual-1/items', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { ...ORDEN_MANUAL, subtotal: 24000, total: 24000, items_orden: [...ORDEN_MANUAL.items_orden, { id: 'item-2', nombre_producto: PRODUCTO_ADMIN_MOCK.nombre, cantidad: 2, precio_unitario: 8000, subtotal: 16000 }] } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: '+ Agregar producto' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByText('Cant.', { exact: true }).locator('..').locator('input').fill('2');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();

    await expect(page.getByText('Nuevo subtotal: $24.000')).toBeVisible();

    await page.getByRole('button', { name: 'Guardar productos' }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.items).toEqual([
      expect.objectContaining({ nombre_producto: 'Bombilla de acero', cantidad: 1, precio_unitario: 8000 }),
      expect.objectContaining({ producto_id: PRODUCTO_ADMIN_MOCK.id, cantidad: 2, precio_unitario: 8000 }),
    ]);
    // El modal sigue abierto con el total ya actualizado (no vuelve a la tabla).
    await expect(page.getByRole('button', { name: 'Guardar productos' })).toHaveCount(0);
  });

  test('si el backend rechaza la edición (400), muestra el error sin cerrar el modal', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MANUAL] } }));
    await page.route('**/api/v1/ordenes/orden-manual-1/items', (route) =>
      route.fulfill({ status: 400, json: { statusCode: 400, message: 'Stock insuficiente para Mate Imperial Grabado' } }),
    );

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: '+ Agregar producto' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar productos' }).click();

    await expect(page.getByText('Stock insuficiente para Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar productos' })).toBeVisible();
  });

  test('quitar el único ítem deja el botón "Guardar productos" deshabilitado', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MANUAL] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: '+ Agregar producto' }).click();

    await page.getByRole('button', { name: 'Quitar' }).click();

    await expect(page.getByText('Sin productos: agregá al menos uno.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar productos' })).toBeDisabled();
  });

  test('no ofrece agregar productos a una orden del canal web', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, canal: 'web' }] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('button', { name: '+ Agregar producto' })).toHaveCount(0);
  });

  test.describe('bloqueada con una explicación (no oculta sin más) según el estado de la venta', () => {
    test('venta ya entregada', async ({ page }) => {
      await loginComoAdmin(page);
      await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, estado: 'entregado' }] } }));

      await page.goto('/admin/ordenes');
      await page.getByRole('button', { name: 'Gestionar' }).click();

      await expect(page.getByRole('button', { name: '+ Agregar producto' })).toHaveCount(0);
      await expect(page.getByText('Ya está lista para retirar, enviada o entregada', { exact: false })).toBeVisible();
    });

    test('venta con envío ya generado', async ({ page }) => {
      await loginComoAdmin(page);
      await page.route('**/api/v1/ordenes?**', (route) =>
        route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, envios_orden: [{ id: 'envio-1' }] }] } }),
      );

      await page.goto('/admin/ordenes');
      await page.getByRole('button', { name: 'Gestionar' }).click();

      await expect(page.getByRole('button', { name: '+ Agregar producto' })).toHaveCount(0);
      await expect(page.getByText('Ya tiene un envío generado', { exact: false })).toBeVisible();
    });

    test('venta con método de envío con costo (no retiro)', async ({ page }) => {
      await loginComoAdmin(page);
      await page.route('**/api/v1/ordenes?**', (route) =>
        route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, metodo_envio_id: 3, metodos_envio: { nombre: 'Correo', proveedor: 'correo' } }] } }),
      );

      await page.goto('/admin/ordenes');
      await page.getByRole('button', { name: 'Gestionar' }).click();

      await expect(page.getByRole('button', { name: '+ Agregar producto' })).toHaveCount(0);
      await expect(page.getByText('costo de envío desactualizado', { exact: false })).toBeVisible();
    });

    test('venta con envío por retiro sigue permitiendo editar (costo siempre $0)', async ({ page }) => {
      await loginComoAdmin(page);
      await mockBackendAdminProductos(page);
      await page.route('**/api/v1/ordenes?**', (route) =>
        route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, metodo_envio_id: 1, metodos_envio: { nombre: 'Retiro en local', proveedor: 'retiro' } }] } }),
      );

      await page.goto('/admin/ordenes');
      await page.getByRole('button', { name: 'Gestionar' }).click();

      await expect(page.getByRole('button', { name: '+ Agregar producto' })).toBeVisible();
    });
  });
});

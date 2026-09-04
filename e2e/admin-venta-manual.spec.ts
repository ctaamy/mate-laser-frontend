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

  test('si el backend rechaza la venta (400), muestra el error en vez de fallar en silencio', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));

    await page.route('**/api/v1/ordenes/venta-manual', (route) =>
      route.fulfill({ status: 400, json: { statusCode: 400, message: ['cp debe ser un código postal argentino de 4 dígitos'] } }),
    );

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect(page.getByText('cp debe ser un código postal argentino de 4 dígitos')).toBeVisible();
    // El modal sigue abierto (no se limpia como en un onSuccess).
    await expect(page.getByRole('button', { name: 'Cargar venta', exact: true })).toBeVisible();
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

test.describe('Admin — Órdenes — venta manual con método de envío', () => {
  const METODOS_ENVIO_MOCK = [
    { id: 1, nombre: 'Retiro en local', proveedor: 'retiro', costo_fijo: 0, api_conectada: false, activo: true },
    { id: 2, nombre: 'Correo estándar', proveedor: 'correo_estandar', costo_fijo: 1500, api_conectada: false, activo: true },
  ];

  test.beforeEach(async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/envios', (route) => route.fulfill({ json: METODOS_ENVIO_MOCK }));
    // Georef (apis.datos.gob.ar) es externo — se aborta para forzar el
    // fallback a inputs de texto libre, sin depender de la red real en el test.
    await page.route('**apis.datos.gob.ar/**', (route) => route.abort());
  });

  test('retiro: no pide dirección y manda metodo_envio_id sin direccion_envio', async ({ page }) => {
    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-2', estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByText('Método de envío', { exact: true }).locator('..').locator('select').selectOption('1');
    // No deberían aparecer campos de dirección para retiro.
    await expect(page.getByPlaceholder('Calle y número')).not.toBeVisible();

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.metodo_envio_id).toBe(1);
    expect(bodyEnviado.direccion_envio).toBeUndefined();
  });

  test('envío a domicilio: pide dirección y la manda junto con metodo_envio_id', async ({ page }) => {
    await page.route('**/api/v1/envios/calcular', (route) => route.fulfill({
      json: METODOS_ENVIO_MOCK.map(m => ({ id: m.id, nombre: m.nombre, proveedor: m.proveedor, costo: m.costo_fijo, disponible: true })),
    }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-3', estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByText('Método de envío', { exact: true }).locator('..').locator('select').selectOption('2');
    await expect(page.getByText('Costo de envío estimado:', { exact: false })).toBeVisible();

    await page.getByPlaceholder('Calle y número').fill('Av. Corrientes 1234');
    await page.getByPlaceholder('CP').fill('1000');
    await page.getByPlaceholder('Buenos Aires').first().fill('Buenos Aires'); // provincia (fallback)
    await page.getByPlaceholder('Buenos Aires').nth(1).fill('CABA'); // ciudad (fallback)

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.metodo_envio_id).toBe(2);
    expect(bodyEnviado.direccion_envio).toEqual(expect.objectContaining({
      calle: 'Av. Corrientes 1234', cp: '1000', provincia: 'Buenos Aires', ciudad: 'CABA',
    }));
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

test.describe('Admin — Órdenes — anular una venta manual (Fase 2)', () => {
  const ORDEN_MANUAL = {
    id: 'orden-manual-anular-1',
    canal: 'admin_manual',
    estado: 'pago_parcial',
    total: 16000,
    metodo_pago: 'efectivo',
    creado_en: new Date().toISOString(),
    direccion_envio: { tipo: 'venta_manual', nombre: 'Juan Pérez' },
    pagos: [{ estado: 'aprobado', monto: 5000 }],
    items_orden: [{ id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2, precio_unitario: 8000, subtotal: 16000 }],
  };

  test('pide confirmación y llama a POST /ordenes/:id/anular-venta-manual', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MANUAL] } }));

    let anulada = false;
    await page.route(`**/api/v1/ordenes/${ORDEN_MANUAL.id}/anular-venta-manual`, (route) => {
      anulada = true;
      route.fulfill({ json: { ...ORDEN_MANUAL, estado: 'cancelado' } });
    });

    page.on('dialog', dialog => dialog.accept());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: 'Anular venta' }).click();

    await expect.poll(() => anulada).toBe(true);
  });

  test('cancelar la confirmación no llama al endpoint', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MANUAL] } }));

    let anulada = false;
    await page.route(`**/api/v1/ordenes/${ORDEN_MANUAL.id}/anular-venta-manual`, (route) => {
      anulada = true;
      route.fulfill({ json: {} });
    });

    page.on('dialog', dialog => dialog.dismiss());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    await page.getByRole('button', { name: 'Anular venta' }).click();

    await page.waitForTimeout(300);
    expect(anulada).toBe(false);
  });

  test('una venta ya cancelada no muestra el botón "Anular venta"', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, estado: 'cancelado' }] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('button', { name: 'Anular venta' })).not.toBeVisible();
  });

  test('una orden del canal web no muestra el botón "Anular venta"', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [{ ...ORDEN_MANUAL, canal: 'web' }] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('button', { name: 'Anular venta' })).not.toBeVisible();
  });
});

test.describe('Admin — Órdenes — filtro por canal (Fase 3)', () => {
  test('el selector de canal manda ?canal=admin_manual al backend', async ({ page }) => {
    await loginComoAdmin(page);

    let ultimaUrl = '';
    await page.route('**/api/v1/ordenes?**', (route) => {
      ultimaUrl = route.request().url();
      route.fulfill({ json: { data: [] } });
    });

    await page.goto('/admin/ordenes');
    await page.getByText('Todos los canales', { exact: true }).locator('..').selectOption('admin_manual');

    await expect.poll(() => ultimaUrl).toContain('canal=admin_manual');
  });

  test('muestra quién cargó una venta manual ("por <admin>")', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({
      json: { data: [{
        id: 'orden-manual-2', canal: 'admin_manual', estado: 'pagado', total: 8000, metodo_pago: 'efectivo',
        creado_en: new Date().toISOString(), direccion_envio: { tipo: 'venta_manual' },
        cargado_por: { id: 'admin-1', email: 'admin@test.com', nombre: 'Admin', apellido: 'Test' },
      }] },
    }));

    await page.goto('/admin/ordenes');

    await expect(page.getByText('por Admin', { exact: false })).toBeVisible();
  });
});

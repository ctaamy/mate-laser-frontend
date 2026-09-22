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

  // Hallazgo de auditoría: el checkout público exige quién recibe/DNI para
  // logística privada (proveedor 'oca', BENI Express) pero la venta manual
  // no lo pedía para el mismo courier — ver DireccionEnvioDto.esLogisticaPrivada.
  test('BENI Express (oca): pide quién recibe y DNI, y los manda en direccion_envio', async ({ page }) => {
    await page.route('**/api/v1/envios', (route) => route.fulfill({
      json: [...METODOS_ENVIO_MOCK, { id: 3, nombre: 'BENI Express', proveedor: 'oca', costo_fijo: 6000, api_conectada: false, activo: true }],
    }));
    await page.route('**/api/v1/envios/calcular', (route) => route.fulfill({
      json: [{ id: 3, nombre: 'BENI Express', proveedor: 'oca', costo: 6000, disponible: true }],
    }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-4', estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByText('Método de envío', { exact: true }).locator('..').locator('select').selectOption('3');
    await expect(page.getByText('¿Recibe el comprador?', { exact: false })).toBeVisible();

    await page.getByPlaceholder('Calle y número').fill('Av. Corrientes 1234');
    await page.getByPlaceholder('CP').fill('1000');
    await page.getByPlaceholder('Buenos Aires').first().fill('Buenos Aires');
    await page.getByPlaceholder('Buenos Aires').nth(1).fill('CABA');

    // Sin elegir "¿Recibe el comprador?" ni cargar DNI, no debería poder
    // completarse silenciosamente con datos incompletos.
    await page.getByText('¿Recibe el comprador?', { exact: false }).locator('..').locator('select').selectOption('false');
    await page.getByPlaceholder('Nombre de quien recibe').fill('María Gómez');
    await page.getByPlaceholder('Ej: 30123456').fill('30123456');

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.direccion_envio).toEqual(expect.objectContaining({
      recibe_comprador: false, quien_recibe: 'María Gómez', dni_receptor: '30123456',
    }));
  });

  test('BENI Express (oca): "recibe el comprador" autocompleta con el nombre del cliente y deshabilita el campo', async ({ page }) => {
    await page.route('**/api/v1/envios', (route) => route.fulfill({
      json: [...METODOS_ENVIO_MOCK, { id: 3, nombre: 'BENI Express', proveedor: 'oca', costo_fijo: 6000, api_conectada: false, activo: true }],
    }));
    await page.route('**/api/v1/envios/calcular', (route) => route.fulfill({
      json: [{ id: 3, nombre: 'BENI Express', proveedor: 'oca', costo: 6000, disponible: true }],
    }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();
    await page.getByText('Método de envío', { exact: true }).locator('..').locator('select').selectOption('3');
    await page.getByPlaceholder('Calle y número').fill('Av. Corrientes 1234');
    await page.getByPlaceholder('CP').fill('1000');
    await page.getByPlaceholder('Buenos Aires').first().fill('Buenos Aires');
    await page.getByPlaceholder('Buenos Aires').nth(1).fill('CABA');

    await page.getByText('Cliente (opcional)', { exact: true }).locator('..').locator('input').fill('Juan Pérez');
    await page.getByText('¿Recibe el comprador?', { exact: false }).locator('..').locator('select').selectOption('true');

    const quienRecibe = page.getByPlaceholder('Nombre de quien recibe');
    await expect(quienRecibe).toHaveValue('Juan Pérez');
    await expect(quienRecibe).toBeDisabled();
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

// Bug encontrado en la auditoría: el modal cerraba directo con cualquier
// click en el backdrop, sin avisar, perdiendo todo lo cargado. Mismo patrón
// que admin-productos.spec.ts (useDirtyGuard).
test.describe('Admin — Órdenes — cerrar el modal de venta manual sin perder datos', () => {
  test.beforeEach(async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
  });

  test('click afuera del modal con productos cargados pide confirmación antes de cerrar', async ({ page }) => {
    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
    await expect(page.getByRole('heading', { name: 'Cargar venta manual' })).toBeVisible();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByText('Total: $8.000')).toBeVisible();

    let dialogVisto = false;
    page.once('dialog', async (dialog) => {
      dialogVisto = true;
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss(); // cancelar → el modal sigue abierto con los datos
    });

    await page.mouse.click(5, 5);
    await page.waitForTimeout(200);

    expect(dialogVisto).toBe(true);
    await expect(page.getByRole('heading', { name: 'Cargar venta manual' })).toBeVisible();
    await expect(page.getByText('Total: $8.000')).toBeVisible();
  });

  test('click afuera del modal sin cambios cierra directo, sin pedir confirmación', async ({ page }) => {
    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
    await expect(page.getByRole('heading', { name: 'Cargar venta manual' })).toBeVisible();

    let dialogVisto = false;
    page.once('dialog', async (dialog) => { dialogVisto = true; await dialog.dismiss(); });

    await page.mouse.click(5, 5);

    await expect(page.getByRole('heading', { name: 'Cargar venta manual' })).not.toBeVisible();
    expect(dialogVisto).toBe(false);
  });

  test('confirmar el cierre descarta los datos y la próxima apertura arranca vacía', async ({ page }) => {
    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    page.once('dialog', async (dialog) => await dialog.accept());
    await page.mouse.click(5, 5);
    await expect(page.getByRole('heading', { name: 'Cargar venta manual' })).not.toBeVisible();

    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
    await expect(page.getByText('Todavía no agregaste productos.')).toBeVisible();
  });
});

test.describe('Admin — Órdenes — canal de venta (Instagram, feria, etc.)', () => {
  test('lo manda en origen_venta cuando se selecciona', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-5', estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();

    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();
    await page.getByText('Canal de venta', { exact: false }).locator('..').locator('select').selectOption('feria');

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.origen_venta).toBe('feria');
  });

  test('sin seleccionar nada, no manda origen_venta', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));

    let bodyEnviado: any = null;
    await page.route('**/api/v1/ordenes/venta-manual', (route) => {
      bodyEnviado = route.request().postDataJSON();
      route.fulfill({ json: { id: 'venta-6', estado: 'pagado' } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: '+ Cargar venta manual' }).click();
    await page.getByText('Producto', { exact: true }).locator('..').locator('select').selectOption(PRODUCTO_ADMIN_MOCK.id);
    await page.getByRole('button', { name: 'Agregar' }).click();

    await page.getByRole('button', { name: 'Cargar venta', exact: true }).click();

    await expect.poll(() => bodyEnviado).not.toBeNull();
    expect(bodyEnviado.origen_venta).toBeUndefined();
  });
});

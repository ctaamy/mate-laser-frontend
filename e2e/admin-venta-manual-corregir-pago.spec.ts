import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// Fase 2 de "editar venta manual": corregir a mano la cuenta (y, solo en una
// venta manual, el método) de un cobro YA aprobado -- a diferencia de
// "Registrar pago" (que suma un cobro nuevo), esto anula el movimiento de
// caja original y crea uno nuevo. Ver PUT /caja/pagos/:pagoId/cuenta
// (mate-laser-backend/src/modules/caja/caja-sync.service.ts) y CLAUDE.md.

const ORDEN_MANUAL = {
  id: 'orden-manual-1',
  canal: 'admin_manual',
  estado: 'pagado',
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
  pagos: [
    { id: 'pago-1', estado: 'aprobado', proveedor: 'efectivo', monto: 8000, cuenta_caja_id: 'c-banco-facu', pagado_en: '2026-09-20T15:00:00.000Z' },
  ],
  items_orden: [
    { id: 'item-1', producto_id: 'otro-prod', nombre_producto: 'Bombilla de acero', cantidad: 1, precio_unitario: 8000, subtotal: 8000, color: null, texto_grabado: null },
  ],
};

async function abrirGestionar(page: Page, orden: object = ORDEN_MANUAL, cajaOpts: Parameters<typeof mockCaja>[1] = {}) {
  await loginComoAdmin(page);
  const cap = await mockCaja(page, cajaOpts);
  await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [orden] } }));
  await page.goto('/admin/ordenes');
  await page.getByRole('button', { name: 'Gestionar' }).click();
  return cap;
}

test.describe('Admin — Órdenes — corregir la cuenta/método de un cobro ya aprobado', () => {
  test('lista el pago con fecha, monto, método y cuenta actual', async ({ page }) => {
    await abrirGestionar(page);
    await expect(page.getByText('20/9/2026', { exact: false })).toBeVisible();
    await expect(page.getByText('$8.000', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Banco Facu', { exact: false })).toBeVisible();
  });

  test('corrige la cuenta y el método de una venta manual, y actualiza el renglón sin cerrar el modal', async ({ page }) => {
    const cap = await abrirGestionar(page);

    await page.getByRole('button', { name: 'Corregir' }).click();
    await page.getByLabel('Método de pago').selectOption('transferencia');
    await page.getByLabel('Cuenta correcta').selectOption({ label: 'Banco Tami' });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Confirmar corrección' }).click();

    await expect.poll(() => cap.correccionesPago).toHaveLength(1);
    expect(cap.correccionesPago[0]).toMatchObject({ pagoId: 'pago-1', body: { cuenta_caja_id: 'c-banco-tami', metodo_pago: 'transferencia' } });

    // El formulario se cierra solo y el renglón queda con el dato nuevo -- sin cerrar el modal Gestionar.
    await expect(page.getByRole('button', { name: 'Confirmar corrección' })).toHaveCount(0);
    await expect(page.getByText('Banco Tami', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Orden #/i })).toBeVisible();
  });

  test('cancelar la confirmación no llama al backend', async ({ page }) => {
    const cap = await abrirGestionar(page);

    await page.getByRole('button', { name: 'Corregir' }).click();
    // "Banco Tami" no es válido para el método por default (efectivo -> solo cuentas de efectivo).
    await page.getByLabel('Método de pago').selectOption('transferencia');
    await page.getByLabel('Cuenta correcta').selectOption({ label: 'Banco Tami' });

    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Confirmar corrección' }).click();

    expect(cap.correccionesPago).toHaveLength(0);
  });

  test('si el backend rechaza la corrección (400), muestra el error sin cerrar el formulario', async ({ page }) => {
    await abrirGestionar(page, ORDEN_MANUAL, { estadoCorregirPago: 400, mensajeCorregirPago: 'La cuenta elegida empezó después de la fecha del cobro' });

    await page.getByRole('button', { name: 'Corregir' }).click();
    await page.getByLabel('Método de pago').selectOption('transferencia');
    await page.getByLabel('Cuenta correcta').selectOption({ label: 'Banco Tami' });
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Confirmar corrección' }).click();

    await expect(page.getByText('La cuenta elegida empezó después de la fecha del cobro')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar corrección' })).toBeVisible();
  });

  test('"Confirmar corrección" arranca deshabilitado en un pago sin cuenta elegida todavía', async ({ page }) => {
    await abrirGestionar(page, { ...ORDEN_MANUAL, pagos: [{ ...ORDEN_MANUAL.pagos[0], cuenta_caja_id: null }] });
    await page.getByRole('button', { name: 'Corregir' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar corrección' })).toBeDisabled();
  });

  test('"Ocultar" colapsa el formulario sin llamar al backend', async ({ page }) => {
    const cap = await abrirGestionar(page);
    await page.getByRole('button', { name: 'Corregir' }).click();
    await page.getByRole('button', { name: 'Ocultar' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar corrección' })).toHaveCount(0);
    expect(cap.correccionesPago).toHaveLength(0);
  });

  test('un pago de Mercado Pago (orden del canal web) no ofrece cambiar el método, solo la cuenta -- y solo cuentas de Mercado Pago', async ({ page }) => {
    const ordenWeb = {
      ...ORDEN_MANUAL,
      canal: 'web',
      pagos: [{ id: 'pago-mp-1', estado: 'aprobado', proveedor: 'mercadopago', monto: 8000, cuenta_caja_id: null, pagado_en: '2026-09-20T15:00:00.000Z' }],
    };
    const cap = await abrirGestionar(page, ordenWeb, { proveedorPagoSinCambiar: 'mercadopago' });

    await page.getByRole('button', { name: 'Corregir' }).click();
    await expect(page.getByLabel('Método de pago')).toHaveCount(0);
    await expect(page.getByLabel('Cuenta correcta').locator('option')).toHaveText(['Elegí una cuenta...', 'Mercado Pago (Facu)']);

    await page.getByLabel('Cuenta correcta').selectOption({ label: 'Mercado Pago (Facu)' });
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Confirmar corrección' }).click();

    await expect.poll(() => cap.correccionesPago).toHaveLength(1);
    expect(cap.correccionesPago[0].body).toEqual({ cuenta_caja_id: 'c-mp' });
  });

  test('una orden sin pagos aprobados no muestra la sección de pagos', async ({ page }) => {
    await abrirGestionar(page, { ...ORDEN_MANUAL, pagos: [{ id: 'pago-1', estado: 'pendiente', proveedor: 'efectivo', monto: 8000 }] });
    await expect(page.getByRole('button', { name: 'Corregir' })).toHaveCount(0);
  });
});

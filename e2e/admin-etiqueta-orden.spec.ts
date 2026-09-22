import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Vista standalone /admin/ordenes/:id/etiqueta — ticket interno imprimible
// para BENI Express/retiro (ver EtiquetaOrden.tsx). No es una etiqueta de
// correo oficial: no hay API de courier real conectada para esos 2 métodos.

const ORDEN_RETIRO = {
  id: 'orden-etq-1',
  notas: 'Frágil',
  direccion_envio: { tipo: 'retiro', nombre: 'Juan Pérez', telefono: '1122334455' },
  metodo_envio_nombre: 'Retiro por sucursal',
  metodos_envio: {
    nombre: 'Retiro por sucursal',
    proveedor: 'retiro',
    ubicacion: { direccion: 'Av. Siempreviva 742', localidad: 'CABA', partido: 'CABA', horarios: 'Lun a Vie 10 a 18' },
  },
  items_orden: [
    { id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2, color: 'negro', texto_grabado: 'Para Juan' },
  ],
};

const ORDEN_BENI = {
  id: 'orden-etq-2',
  direccion_envio: {
    nombre: 'María Gómez', telefono: '1155667788', calle: 'Av. Corrientes 1234', cp: '1000',
    ciudad: 'CABA', provincia: 'Buenos Aires', quien_recibe: 'María Gómez', dni_receptor: '30123456',
  },
  metodo_envio_nombre: 'BENI Express',
  metodos_envio: { nombre: 'BENI Express', proveedor: 'oca' },
  items_orden: [{ id: 'item-1', nombre_producto: 'Bombilla de acero', cantidad: 1 }],
};

test.describe('Admin — Etiqueta interna imprimible', () => {
  test('retiro: muestra el punto de retiro (desde metodos_envio.ubicacion), no la dirección del cliente', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(`**/api/v1/ordenes/${ORDEN_RETIRO.id}`, (route) => route.fulfill({ json: ORDEN_RETIRO }));

    await page.goto(`/admin/ordenes/${ORDEN_RETIRO.id}/etiqueta`);

    await expect(page.getByText('Juan Pérez')).toBeVisible();
    await expect(page.getByText('Av. Siempreviva 742')).toBeVisible();
    await expect(page.getByText('Lun a Vie 10 a 18')).toBeVisible();
    await expect(page.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByText('"Para Juan"')).toBeVisible();
    await expect(page.getByText('Frágil')).toBeVisible();
  });

  test('BENI Express: muestra la dirección del destinatario y quién recibe/DNI', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(`**/api/v1/ordenes/${ORDEN_BENI.id}`, (route) => route.fulfill({ json: ORDEN_BENI }));

    await page.goto(`/admin/ordenes/${ORDEN_BENI.id}/etiqueta`);

    await expect(page.getByText('María Gómez').first()).toBeVisible();
    await expect(page.getByText('Av. Corrientes 1234')).toBeVisible();
    await expect(page.getByText('30123456', { exact: false })).toBeVisible();
  });

  test('orden inexistente: muestra un error en vez de romperse en blanco', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/orden-no-existe', (route) => route.fulfill({ status: 404, json: { message: 'no encontrada' } }));

    await page.goto('/admin/ordenes/orden-no-existe/etiqueta');

    await expect(page.getByText(/no se pudo cargar/i)).toBeVisible();
  });
});

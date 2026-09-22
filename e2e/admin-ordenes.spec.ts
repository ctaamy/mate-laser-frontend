import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 8: el modal de "Gestionar" una orden mostraba estado,
// tracking y notas, pero no qué productos se compraron — justo el dato más
// operativo para atender un pedido. El backend ya incluía items_orden en
// GET /ordenes (ver ordenes.service.ts findAll), solo faltaba mostrarlo.

const ORDEN_CON_ITEMS = {
  id: 'orden-items-1', estado: 'pagado', total: 17500, metodo_pago: 'mercadopago',
  creado_en: new Date().toISOString(), usuarios: { nombre: 'Ana', apellido: 'Gómez' },
  items_orden: [
    {
      id: 'item-1', nombre_producto: 'Mate Imperial Grabado', cantidad: 2,
      precio_unitario: 8000, subtotal: 16000, color: 'negro', texto_grabado: 'Para Juan',
    },
    {
      id: 'item-2', nombre_producto: 'Bombilla de acero', cantidad: 1,
      precio_unitario: 1500, subtotal: 1500, color: null, texto_grabado: null,
    },
  ],
};

test.describe('Admin — Órdenes — ítems del pedido en el modal de gestión', () => {
  test('muestra los productos comprados (nombre, cantidad, precio, color y grabado)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_CON_ITEMS] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByText('Bombilla de acero')).toBeVisible();
    await expect(page.getByText('2 × $8.000', { exact: false })).toBeVisible();
    await expect(page.getByText('negro', { exact: false })).toBeVisible();
    await expect(page.getByText('"Para Juan"')).toBeVisible();
  });

  test('sin ítems, muestra un mensaje en vez de dejar la sección vacía sin explicación', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) =>
      route.fulfill({ json: { data: [{ ...ORDEN_CON_ITEMS, items_orden: [] }] } }),
    );

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByText('Sin ítems.')).toBeVisible();
  });
});

// "Imprimir etiqueta": ticket interno para BENI Express/retiro, los 2 únicos
// métodos sin API de courier real conectada (ver EtiquetaOrden.tsx). No debe
// aparecer para métodos con API real (Correo/Andreani, aunque hoy tampoco
// estén conectados) ni para órdenes sin método de envío.
test.describe('Admin — Órdenes — botón "Imprimir etiqueta"', () => {
  const ordenCon = (proveedor: string | null) => ({
    ...ORDEN_CON_ITEMS,
    id: 'orden-etiqueta-1',
    metodo_envio_nombre: proveedor ? 'Envío' : undefined,
    metodos_envio: proveedor ? { nombre: 'Envío', proveedor } : undefined,
  });

  test('aparece para BENI Express (oca)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('oca')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toHaveAttribute('href', '/admin/ordenes/orden-etiqueta-1/etiqueta');
  });

  test('aparece para retiro', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('retiro')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).toBeVisible();
  });

  test('no aparece para un método con API de courier real (correo/andreani)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon('correo')] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).not.toBeVisible();
  });

  test('no aparece sin método de envío', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ordenCon(null)] } }));

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();

    await expect(page.getByRole('link', { name: 'Imprimir etiqueta' })).not.toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// Bug de venta: con "Grabado personalizado" prendido y el texto vacío, la ficha
// sumaba el costo del grabado al precio, pero el servidor solo cobra el grabado
// si la línea trae texto (common/precios.ts). El carrito quedaba con un precio
// que el checkout rechazaba ("el precio cambió") y no había cómo corregirlo.
// Ahora el texto es obligatorio mientras el grabado está prendido.

const COSTO_GRABADO = 1500;
const BOTON_AGREGAR = /Agregar al carrito/i;
const MOTIVO = /Escribí el texto a grabar/;

async function abrirFicha(page: Page) {
  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  // La ficha del producto con costo de grabado (el mock base no lo trae).
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) =>
    route.fulfill({ json: { ...PRODUCTO_MOCK, costo_grabado: COSTO_GRABADO } }),
  );
  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
}

const itemsDelCarrito = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('carrito-storage');
    return raw ? (JSON.parse(raw).state.items as Record<string, unknown>[]) : [];
  });

test.describe('Grabado personalizado: el texto es obligatorio', () => {
  test('prendido y sin texto no se puede agregar: el botón queda bloqueado y dice por qué', async ({ page }) => {
    await abrirFicha(page);
    const agregar = page.getByRole('button', { name: BOTON_AGREGAR });

    // Sin grabado: se agrega normal (precio base).
    await expect(agregar).toBeEnabled();
    await expect(page.getByText(MOTIVO)).toHaveCount(0);

    await page.getByText('Grabado personalizado').click();
    await expect(agregar).toBeDisabled();
    await expect(page.getByText(MOTIVO)).toBeVisible();
    // El precio ya muestra el grabado sumado: por eso no puede agregarse vacío.
    await expect(page.getByText('$9.500').first()).toBeVisible();
  });

  test('con texto se habilita y la línea viaja con el texto y el precio con grabado', async ({ page }) => {
    await abrirFicha(page);
    await page.getByText('Grabado personalizado').click();
    await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('Para Juan');

    const agregar = page.getByRole('button', { name: BOTON_AGREGAR });
    await expect(agregar).toBeEnabled();
    await expect(page.getByText(MOTIVO)).toHaveCount(0);
    await agregar.click();
    await expect(page.getByText('✓ Agregado')).toBeVisible();

    const items = await itemsDelCarrito(page);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      con_grabado: true,
      texto_grabado: 'Para Juan',
      precio_unitario: PRODUCTO_MOCK.precio_base + COSTO_GRABADO,
    });
  });

  test('un texto de solo espacios cuenta como vacío', async ({ page }) => {
    await abrirFicha(page);
    await page.getByText('Grabado personalizado').click();
    await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('    ');

    await expect(page.getByRole('button', { name: BOTON_AGREGAR })).toBeDisabled();
    await expect(page.getByText(MOTIVO)).toBeVisible();
  });

  test('el texto se guarda sin los espacios de los costados', async ({ page }) => {
    await abrirFicha(page);
    await page.getByText('Grabado personalizado').click();
    await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('  Ana  ');
    await page.getByRole('button', { name: BOTON_AGREGAR }).click();
    await expect(page.getByText('✓ Agregado')).toBeVisible();

    expect((await itemsDelCarrito(page))[0]).toMatchObject({ texto_grabado: 'Ana' });
  });

  test('apagar el grabado vuelve a permitir agregar sin texto, y sin sumar el costo', async ({ page }) => {
    await abrirFicha(page);
    const toggle = page.getByText('Grabado personalizado');
    await toggle.click();
    await expect(page.getByRole('button', { name: BOTON_AGREGAR })).toBeDisabled();

    await toggle.click();
    const agregar = page.getByRole('button', { name: BOTON_AGREGAR });
    await expect(agregar).toBeEnabled();
    await agregar.click();
    await expect(page.getByText('✓ Agregado')).toBeVisible();

    const [item] = await itemsDelCarrito(page);
    expect(item.precio_unitario).toBe(PRODUCTO_MOCK.precio_base);
    expect(item.con_grabado).toBeUndefined();
    expect(item.texto_grabado).toBeUndefined();
  });
});

test.describe('Carrito guardado con un grabado sin texto (versión anterior)', () => {
  test('esa línea no se podía comprar: se descarta al abrir y las demás quedan', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    // Un carrito persistido con la versión 3 del store: una línea sana y la rota.
    await page.addInitScript((idProducto) => {
      if (localStorage.getItem('carrito-storage')) return;
      localStorage.setItem(
        'carrito-storage',
        JSON.stringify({
          version: 3,
          state: {
            actualizadoEn: Date.now(),
            cupon: null,
            cuponPendiente: null,
            items: [
              { producto_id: idProducto, nombre_producto: 'Mate sano', precio_unitario: 8000, cantidad: 1 },
              {
                producto_id: idProducto,
                nombre_producto: 'Mate con grabado vacío',
                precio_unitario: 9500,
                cantidad: 1,
                con_grabado: true,
              },
            ],
          },
        }),
      );
    }, PRODUCTO_MOCK.id);

    await page.goto('/carrito');
    await expect(page.getByText('Mate sano')).toBeVisible();
    await expect(page.getByText('Mate con grabado vacío')).toHaveCount(0);
  });
});

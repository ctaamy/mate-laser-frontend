import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Fase B del sistema de variantes: selector de opciones en ProductoDetalle.tsx,
// cambio de imagen y stock según la combinación elegida. No toca carrito/checkout
// más allá de que el variante_id viaja en el item agregado.

const IMG_NATURAL = { id: 'img-natural', producto_id: PRODUCTO_MOCK.id, url: 'https://example.com/natural.png', orden: 0, es_principal: true };
const IMG_NEGRO = { id: 'img-negro', producto_id: PRODUCTO_MOCK.id, url: 'https://example.com/negro.png', orden: 1, es_principal: false };

const TIPO_COLOR = {
  id: 'tipo-color',
  producto_id: PRODUCTO_MOCK.id,
  nombre: 'Color',
  orden: 0,
  valores: [
    { id: 'valor-natural', tipo_opcion_id: 'tipo-color', valor: 'Natural', orden: 0 },
    { id: 'valor-negro', tipo_opcion_id: 'tipo-color', valor: 'Negro', orden: 1 },
  ],
};

const VARIANTE_NATURAL = {
  id: 'variante-natural',
  producto_id: PRODUCTO_MOCK.id,
  disponible: true,
  pocas_unidades: false,
  cantidad_maxima: 8,
  imagen_id: 'img-natural',
  imagenes_producto: IMG_NATURAL,
  activo: true,
  variante_valores: [{ variante_id: 'variante-natural', valor_opcion_id: 'valor-natural', valores_opcion: { ...TIPO_COLOR.valores[0], tipos_opcion: TIPO_COLOR } }],
};

const VARIANTE_NEGRO = {
  id: 'variante-negro',
  producto_id: PRODUCTO_MOCK.id,
  disponible: false,
  pocas_unidades: false,
  cantidad_maxima: 0,
  imagen_id: 'img-negro',
  imagenes_producto: IMG_NEGRO,
  activo: true,
  variante_valores: [{ variante_id: 'variante-negro', valor_opcion_id: 'valor-negro', valores_opcion: { ...TIPO_COLOR.valores[1], tipos_opcion: TIPO_COLOR } }],
};

async function mockProducto(page: import('@playwright/test').Page, overrides: Record<string, any> = {}) {
  const producto = {
    ...PRODUCTO_MOCK,
    apto_grabado: false,
    personalizado_habilitado: false,
    colores_disponibles: [],
    imagenes_producto: [IMG_NATURAL, IMG_NEGRO],
    tipos_opcion: [TIPO_COLOR],
    variantes_producto: [VARIANTE_NATURAL, VARIANTE_NEGRO],
    ...overrides,
  };
  await page.route(`**/api/v1/productos/${producto.slug}`, (route) => route.fulfill({ json: producto }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
  return producto;
}

test.describe('Selector de variantes en producto', () => {
  test('producto sin tipos_opcion: no muestra selector, se comporta como hoy', async ({ page }) => {
    await mockProducto(page, { tipos_opcion: [], variantes_producto: [] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.getByText('Color', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Stock disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
  });

  test('producto con variantes: pide elegir opción antes de mostrar stock y habilitar el botón', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByText('Seleccioná una opción para ver el stock')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();
  });

  test('seleccionar una variante con stock: muestra su stock y habilita agregar al carrito', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Natural' }).click();

    await expect(page.getByText('· Natural')).toBeVisible();
    await expect(page.getByText('Stock disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
  });

  test('volver a tocar el valor ya elegido lo deselecciona', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const btnNatural = page.getByRole('button', { name: 'Natural' });

    await btnNatural.click();
    await expect(page.getByText('· Natural')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();

    // Segundo click sobre el mismo valor: limpia la selección.
    await btnNatural.click();
    await expect(page.getByText('· Natural')).not.toBeVisible();
    await expect(page.getByText('Seleccioná una opción para ver el stock')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();
  });

  test('seleccionar una variante sin stock: mantiene el botón deshabilitado', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Negro' }).click();

    await expect(page.getByText('Sin stock disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();
  });

  test('agregar al carrito con variante seleccionada: el item guarda el variante_id correcto', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Natural' }).click();
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    await expect(page.getByText('✓ Agregado')).toBeVisible();

    const carrito = await page.evaluate(() => {
      const raw = localStorage.getItem('carrito-storage');
      return raw ? JSON.parse(raw) : null;
    });
    expect(carrito.state.items).toHaveLength(1);
    expect(carrito.state.items[0].variante_id).toBe('variante-natural');
    expect(carrito.state.items[0].stock).toBe(8);
  });
});

test.describe('Precio por variante en la PDP', () => {
  // Natural sin precio propio (usa el base $8.000), Negro con precio_override
  // $12.000. Ambas con stock → hay dispersión de precio.
  const NEGRO_CON_STOCK = { ...VARIANTE_NEGRO, disponible: true, cantidad_maxima: 5 };
  const NEGRO_CARO = { ...NEGRO_CON_STOCK, precio_override: 12000 };

  const precioGrande = (page: import('@playwright/test').Page) => page.locator('span.text-3xl');

  test('antes de elegir la combinación muestra "Desde $X" con el precio más barato', async ({ page }) => {
    await mockProducto(page, { variantes_producto: [VARIANTE_NATURAL, NEGRO_CARO] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByText('Desde', { exact: true })).toBeVisible();
    await expect(precioGrande(page)).toHaveText('$8.000');
    await expect(page.getByText('El precio final depende de las opciones que elijas.')).toBeVisible();
  });

  test('elegir la variante con precio propio: muestra ese precio y el contexto, y va al carrito', async ({ page }) => {
    await mockProducto(page, { variantes_producto: [VARIANTE_NATURAL, NEGRO_CARO] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Negro' }).click();

    await expect(precioGrande(page)).toHaveText('$12.000');
    await expect(page.getByText('Desde', { exact: true })).not.toBeVisible();
    await expect(page.getByText(/Precio para/)).toContainText('$4.000 más que el precio base');

    await page.getByRole('button', { name: /Agregar al carrito/i }).click();
    const carrito = await page.evaluate(() => JSON.parse(localStorage.getItem('carrito-storage')!));
    expect(carrito.state.items[0].variante_id).toBe('variante-negro');
    expect(carrito.state.items[0].precio_unitario).toBe(12000);
  });

  test('elegir la variante sin precio propio: usa el precio base', async ({ page }) => {
    await mockProducto(page, { variantes_producto: [VARIANTE_NATURAL, NEGRO_CARO] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Natural' }).click();

    await expect(precioGrande(page)).toHaveText('$8.000');
    await expect(page.getByText(/Precio para/)).not.toBeVisible();
  });

  test('el precio tachado y el "-%" se ocultan cuando el precio mostrado es un precio propio', async ({ page }) => {
    // precio_base 8000, precio_tachado 15000 → -47% cuando aplica.
    await mockProducto(page, {
      precio_tachado: 15000,
      variantes_producto: [VARIANTE_NATURAL, NEGRO_CARO],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    // Antes de elegir: hay una variante con precio propio en juego → sin "-%".
    await expect(page.getByText('-47%')).not.toBeVisible();

    // Variante sin override: el descuento sí aplica (es sobre el precio base).
    await page.getByRole('button', { name: 'Natural' }).click();
    await expect(page.getByText('-47%')).toBeVisible();
    await expect(page.getByText('$15.000')).toBeVisible();

    // Variante con override: el -47% se calculó sobre el base, no sobre lo que
    // se paga → se oculta.
    await page.getByRole('button', { name: 'Negro' }).click();
    await expect(page.getByText('-47%')).not.toBeVisible();
    await expect(page.getByText('$15.000')).not.toBeVisible();
  });

  test('sin ninguna variante con precio propio: la PDP no muestra "Desde"', async ({ page }) => {
    await mockProducto(page, { variantes_producto: [VARIANTE_NATURAL, NEGRO_CON_STOCK] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByText('Desde', { exact: true })).not.toBeVisible();
    await expect(precioGrande(page)).toHaveText('$8.000');
  });
});

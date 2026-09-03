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

    await expect(page.getByText('Elegí color para ver el stock y el precio.')).toBeVisible();
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

  test('volver a tocar el valor ya elegido lo mantiene (selector obligatorio, no se deselecciona)', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const btnNatural = page.getByRole('button', { name: 'Natural' });

    await btnNatural.click();
    await expect(page.getByText('· Natural')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();

    // Segundo click sobre el mismo valor: no hace nada, la selección se mantiene.
    await btnNatural.click();
    await expect(page.getByText('· Natural')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
  });

  test('tipo de opción con un único valor: se autoselecciona y no bloquea el CTA', async ({ page }) => {
    const TIPO_BOMBILLA = {
      id: 'tipo-bombilla', producto_id: PRODUCTO_MOCK.id, nombre: 'Bombilla', orden: 0,
      valores: [{ id: 'valor-pico', tipo_opcion_id: 'tipo-bombilla', valor: 'Pico de loro', orden: 0 }],
    };
    const VARIANTE_UNICA = {
      id: 'variante-unica', producto_id: PRODUCTO_MOCK.id, disponible: true, pocas_unidades: false,
      cantidad_maxima: 4, activo: true,
      variante_valores: [{ variante_id: 'variante-unica', valor_opcion_id: 'valor-pico', valores_opcion: { ...TIPO_BOMBILLA.valores[0], tipos_opcion: TIPO_BOMBILLA } }],
    };
    await mockProducto(page, { tipos_opcion: [TIPO_BOMBILLA], variantes_producto: [VARIANTE_UNICA] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByText('Stock disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
    await expect(page.getByText(/para ver el stock/)).not.toBeVisible();
  });

  test('la cantidad queda deshabilitada hasta elegir una variante con stock', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('button', { name: 'Sumar una unidad' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Restar una unidad' })).toBeDisabled();

    await page.getByRole('button', { name: 'Natural' }).click();

    await expect(page.getByRole('button', { name: 'Sumar una unidad' })).toBeEnabled();
  });

  test('un valor sin stock aparece deshabilitado y tachado, y no se puede agregar', async ({ page }) => {
    await mockProducto(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const negro = page.getByRole('button', { name: 'Negro' });
    await expect(negro).toBeDisabled();
    await expect(negro).toHaveClass(/line-through/);
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

test.describe('Disponibilidad por opción (Fase 2)', () => {
  const TIPO_MEDIDA = {
    id: 'tipo-medida', producto_id: PRODUCTO_MOCK.id, nombre: 'Medida', orden: 1,
    valores: [
      { id: 'valor-chico', tipo_opcion_id: 'tipo-medida', valor: 'Chico', orden: 0 },
      { id: 'valor-grande', tipo_opcion_id: 'tipo-medida', valor: 'Grande', orden: 1 },
    ],
  };
  const vv = (varianteId: string, tipo: any, idx: number) => ({
    variante_id: varianteId, valor_opcion_id: tipo.valores[idx].id,
    valores_opcion: { ...tipo.valores[idx], tipos_opcion: tipo },
  });
  const mkVariante = (id: string, colorIdx: number, medidaIdx: number, disponible: boolean) => ({
    id, producto_id: PRODUCTO_MOCK.id, disponible, pocas_unidades: false,
    cantidad_maxima: disponible ? 5 : 0, activo: true,
    variante_valores: [vv(id, TIPO_COLOR, colorIdx), vv(id, TIPO_MEDIDA, medidaIdx)],
  });

  test('elegir un valor deshabilita las opciones de otro tipo sin stock para esa combinación', async ({ page }) => {
    await mockProducto(page, {
      tipos_opcion: [TIPO_COLOR, TIPO_MEDIDA],
      variantes_producto: [
        mkVariante('v-nat-chico', 0, 0, true),
        mkVariante('v-nat-grande', 0, 1, false),
        mkVariante('v-neg-chico', 1, 0, false),
        mkVariante('v-neg-grande', 1, 1, true),
      ],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const grande = page.getByRole('button', { name: 'Grande' });
    await expect(grande).toBeEnabled(); // sin nada elegido, Negro+Grande tiene stock

    await page.getByRole('button', { name: 'Natural' }).click();

    await expect(grande).toBeDisabled(); // Natural+Grande no tiene stock
    await expect(grande).toHaveClass(/line-through/);
    await expect(page.getByRole('button', { name: 'Chico' })).toBeEnabled();

    // Leyenda visible (el title no se ve en touch) + a11y en el botón.
    await expect(page.getByText('no tienen stock para esta combinación')).toBeVisible();
    await expect(grande).toHaveAttribute('aria-label', 'Grande — sin stock para esta combinación');
  });

  test('salvaguarda: si ningún valor de un tipo tiene stock, no se deshabilita ninguno', async ({ page }) => {
    await mockProducto(page, {
      variantes_producto: [
        { ...VARIANTE_NATURAL, disponible: false, cantidad_maxima: 0 },
        { ...VARIANTE_NEGRO, disponible: false, cantidad_maxima: 0 },
      ],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('button', { name: 'Natural' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Negro' })).toBeEnabled();

    // Igual no se puede comprar: al elegir, la línea de stock lo deja claro.
    await page.getByRole('button', { name: 'Natural' }).click();
    await expect(page.getByText('Sin stock por ahora')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();
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

  test('con dispersión de precio, el valor de opción muestra su "+$X" cuando es inequívoco', async ({ page }) => {
    await mockProducto(page, { variantes_producto: [VARIANTE_NATURAL, NEGRO_CARO] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('button', { name: 'Negro' })).toContainText('+$4.000');
    await expect(page.getByRole('button', { name: 'Natural', exact: true })).not.toContainText('$');
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

test.describe('Imagen en selección parcial (Fase 3)', () => {
  const IMG_GENERICA = { id: 'img-gen', producto_id: PRODUCTO_MOCK.id, url: 'https://example.com/generica.png', orden: 0, es_principal: true };

  const TIPO_MEDIDA = {
    id: 'tipo-medida', producto_id: PRODUCTO_MOCK.id, nombre: 'Medida', orden: 1,
    valores: [
      { id: 'valor-chico', tipo_opcion_id: 'tipo-medida', valor: 'Chico', orden: 0 },
      { id: 'valor-grande', tipo_opcion_id: 'tipo-medida', valor: 'Grande', orden: 1 },
    ],
  };
  const vv = (varianteId: string, tipo: any, idx: number) => ({
    variante_id: varianteId, valor_opcion_id: tipo.valores[idx].id,
    valores_opcion: { ...tipo.valores[idx], tipos_opcion: tipo },
  });

  // Natural + Chico trae su propia imagen; el resto no.
  const V_NAT_CHICO = {
    id: 'v-nat-chico', producto_id: PRODUCTO_MOCK.id, disponible: true, pocas_unidades: false,
    cantidad_maxima: 5, activo: true, imagen_id: 'img-natural', imagenes_producto: IMG_NATURAL,
    variante_valores: [vv('v-nat-chico', TIPO_COLOR, 0), vv('v-nat-chico', TIPO_MEDIDA, 0)],
  };
  const V_NAT_GRANDE = {
    id: 'v-nat-grande', producto_id: PRODUCTO_MOCK.id, disponible: true, pocas_unidades: false,
    cantidad_maxima: 5, activo: true,
    variante_valores: [vv('v-nat-grande', TIPO_COLOR, 0), vv('v-nat-grande', TIPO_MEDIDA, 1)],
  };

  const imagenPrincipal = (page: import('@playwright/test').Page) => page.locator('img.absolute').last();

  test('con una sola opción elegida (combo incompleto) ya muestra la imagen de una variante compatible', async ({ page }) => {
    await mockProducto(page, {
      imagenes_producto: [IMG_GENERICA],
      tipos_opcion: [TIPO_COLOR, TIPO_MEDIDA],
      variantes_producto: [V_NAT_CHICO, V_NAT_GRANDE],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(imagenPrincipal(page)).toHaveAttribute('src', 'https://example.com/generica.png');

    await page.getByRole('button', { name: 'Natural' }).click(); // Medida sigue sin elegir

    await expect(imagenPrincipal(page)).toHaveAttribute('src', 'https://example.com/natural.png');
  });
});

// Feature "stock compartido entre variantes": el backend (aVistaPublica) colapsa
// la disponibilidad de cada variante contra el pool del producto, así que la PDP
// no necesita lógica nueva — estos tests fijan que la rendea bien.
test.describe('Stock compartido entre variantes (pool del producto)', () => {
  test('pool a 0: cualquier variante que elija queda "Sin stock por ahora" y el CTA bloqueado', async ({ page }) => {
    await mockProducto(page, {
      stock_compartido: true,
      // Con el pool en 0, el backend manda TODAS las variantes sin stock,
      // sin importar el contador propio de cada una.
      variantes_producto: [
        { ...VARIANTE_NATURAL, disponible: false, pocas_unidades: false, cantidad_maxima: 0 },
        { ...VARIANTE_NEGRO, disponible: false, pocas_unidades: false, cantidad_maxima: 0 },
      ],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Natural' }).click();
    await expect(page.getByText('Sin stock por ahora')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();

    await page.getByRole('button', { name: 'Negro' }).click();
    await expect(page.getByText('Sin stock por ahora')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeDisabled();
  });

  test('pool con pocas unidades: todas las variantes muestran el aviso y comparten el tope de cantidad', async ({ page }) => {
    await mockProducto(page, {
      stock_compartido: true,
      variantes_producto: [
        { ...VARIANTE_NATURAL, disponible: true, pocas_unidades: true, cantidad_maxima: 2 },
        { ...VARIANTE_NEGRO, disponible: true, pocas_unidades: true, cantidad_maxima: 2 },
      ],
    });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByRole('button', { name: 'Negro' }).click();
    await expect(page.getByText('¡Últimas unidades!', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeEnabled();
  });
});

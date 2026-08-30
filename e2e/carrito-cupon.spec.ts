import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// PR #2 de "cupones por selección": el cupón aplicado en el carrito ahora vive
// en el store (no en estado local de Carrito.tsx), sobrevive a la navegación al
// checkout y llega a POST /ordenes con `descuento` + `cupon_id` reales. Antes
// el checkout mandaba `descuento: 0` fijo y el cupón se perdía en el camino.

const CUPON = {
  valido: true,
  cupon_id: 'cup-e2e-1',
  codigo: 'MATE20',
  tipo: 'porcentaje',
  valor: 20,
  aplica_a_todo: true,
  subtotal_elegible: PRODUCTO_MOCK.precio_base,
  descuento: Math.round(PRODUCTO_MOCK.precio_base * 0.2), // 1600
  items_elegibles: [PRODUCTO_MOCK.id],
};

// Mock de POST /cupones/validar: MATE20 devuelve el descuento, cualquier otro
// código 404 con el mensaje del backend.
async function mockValidarCupon(page: Page) {
  await page.route('**/api/v1/cupones/validar', (route) => {
    const body = route.request().postDataJSON() as { codigo?: string };
    if ((body?.codigo || '').toUpperCase() === 'MATE20') {
      return route.fulfill({ json: CUPON });
    }
    return route.fulfill({ status: 404, json: { message: 'Cupón no válido' } });
  });
}

// Registra un mock de POST /ordenes que captura el body enviado, para poder
// afirmar qué `descuento`/`cupon_id` mandó el checkout.
async function capturarOrden(page: Page) {
  const capturado: { body?: any } = {};
  await page.route('**/api/v1/ordenes', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    capturado.body = route.request().postDataJSON();
    return route.fulfill({
      json: { id: 'orden-e2e-1', estado: 'pendiente', metodo_pago: 'mercadopago' },
    });
  });
  return capturado;
}

async function agregarProductoAlCarrito(page: Page) {
  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
  await page.getByRole('button', { name: /Agregar al carrito/i }).click();
  await expect(page.getByText('✓ Agregado')).toBeVisible();
}

test.describe('Cupón — carrito → checkout → orden', () => {
  test('aplica el descuento, lo mantiene en el checkout y lo manda en la orden', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);
    const orden = await capturarOrden(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');

    // Sin cupón: total = subtotal.
    await expect(page.getByText('$8.000').first()).toBeVisible();

    // Aplicar MATE20.
    await page.getByPlaceholder('Código de descuento').fill('MATE20');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    // Cupón aplicado + línea de descuento + total recalculado.
    await expect(page.getByText('aplicado')).toBeVisible();
    await expect(page.getByText('Descuento (MATE20)')).toBeVisible();
    await expect(page.getByText('$1.600')).toBeVisible();
    await expect(page.getByText('$6.400')).toBeVisible();

    // Quitar el cupón: vuelve todo atrás.
    await page.getByRole('button', { name: /Quitar/ }).click();
    await expect(page.getByText('Descuento (MATE20)')).toHaveCount(0);
    await expect(page.getByText('$1.600')).toHaveCount(0);
    await expect(page.getByPlaceholder('Código de descuento')).toBeVisible();

    // Re-aplicar y avanzar al checkout.
    await page.getByPlaceholder('Código de descuento').fill('MATE20');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();
    await expect(page.getByText('$6.400')).toBeVisible();

    await page.getByRole('button', { name: /Continuar con el envío/i }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // El descuento sobrevive a la navegación: aparece en el resumen del checkout.
    await expect(page.getByText('Descuento (MATE20)')).toBeVisible();
    await expect(page.getByText('$1.600')).toBeVisible();

    // Completar el checkout hasta confirmar.
    await page.getByPlaceholder('María').fill('Juana');
    await page.getByPlaceholder('González').fill('Pérez');
    await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
    await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
    await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
    await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
    await page.getByText('Retiro en local').click();
    await page.getByRole('button', { name: /Continuar al pago/i }).click();
    await page.getByRole('button', { name: /Confirmar y pagar/i }).click();
    await expect(page).toHaveURL(/\/pago\//);

    // La orden se creó con el descuento y el cupón, no con descuento 0.
    expect(orden.body).toMatchObject({
      descuento: CUPON.descuento,
      cupon_id: CUPON.cupon_id,
      subtotal: PRODUCTO_MOCK.precio_base,
      total: PRODUCTO_MOCK.precio_base - CUPON.descuento,
    });
  });

  test('código inválido muestra el error del backend y no aplica descuento', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');

    await page.getByPlaceholder('Código de descuento').fill('NOEXISTE');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('Cupón no válido')).toBeVisible();
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
    // El total sigue siendo el subtotal.
    await expect(page.getByText('$8.000').first()).toBeVisible();
  });
});

// Fase 1: alcance parcial. Se siembra un carrito de 2 items directo en
// localStorage para no depender de dos páginas de producto distintas.
test.describe('Cupón con alcance parcial (Fase 1)', () => {
  async function seedCarrito2Items(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem('carrito-storage', JSON.stringify({
        state: {
          items: [
            { producto_id: 'prod-a', nombre_producto: 'Mate premium', precio_unitario: 8000, cantidad: 1, disponible: true, stock: 5 },
            { producto_id: 'prod-b', nombre_producto: 'Bombilla', precio_unitario: 3000, cantidad: 1, disponible: true, stock: 5 },
          ],
          actualizadoEn: Date.now(),
          cupon: null,
        },
        version: 1,
      }));
    });
    // El carrito revalida disponibilidad contra /productos?ids=... — que los
    // dos productos vuelvan disponibles para no ensuciar la vista.
    await page.route('**/api/v1/productos?**', (route) =>
      route.fulfill({
        json: {
          data: [
            { id: 'prod-a', disponible: true, cantidad_maxima: 5 },
            { id: 'prod-b', disponible: true, cantidad_maxima: 5 },
          ],
          total: 2, page: 1, totalPages: 1,
        },
      }),
    );
  }

  test('descuento parcial: caption "aplicado a 1 de 2" y total recalculado', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('**/api/v1/cupones/validar', (route) =>
      route.fulfill({
        json: {
          valido: true, cupon_id: 'cup-scoped', codigo: 'MATES50', tipo: 'porcentaje', valor: 50,
          aplica_a_todo: false, subtotal_elegible: 8000, descuento: 4000, items_elegibles: ['prod-a'],
        },
      }),
    );
    await seedCarrito2Items(page);

    await page.goto('/carrito');
    await expect(page.getByText('Mate premium')).toBeVisible();

    await page.getByPlaceholder('Código de descuento').fill('MATES50');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('aplicado a 1 de 2 productos')).toBeVisible();
    await expect(page.getByText('$4.000')).toBeVisible(); // descuento
    await expect(page.getByText('$7.000')).toBeVisible(); // 11.000 - 4.000
  });

  test('SIN_ITEMS_ELEGIBLES: aviso ámbar, no error rojo, sin descuento', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('**/api/v1/cupones/validar', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'El cupón no aplica a ninguno de los productos de tu carrito', motivo: 'SIN_ITEMS_ELEGIBLES' },
      }),
    );
    await seedCarrito2Items(page);

    await page.goto('/carrito');
    await page.getByPlaceholder('Código de descuento').fill('OTROS');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('El cupón no aplica a ninguno de los productos de tu carrito')).toBeVisible();
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
    // Subtotal y Total siguen en 11.000 (nada aplicado).
    await expect(page.getByText('$11.000')).toHaveCount(2);
  });
});

// Fase 2: límite de usos por cliente.
test.describe('Cupón con límite por cliente (Fase 2)', () => {
  test('REQUIERE_LOGIN: aviso ámbar con link a iniciar sesión, sin descuento', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('**/api/v1/cupones/validar', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'Iniciá sesión o creá tu cuenta para usar este cupón.', motivo: 'REQUIERE_LOGIN' },
      }),
    );

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');
    await page.getByPlaceholder('Código de descuento').fill('BIENVENIDA');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('Iniciá sesión o creá tu cuenta para usar este cupón.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Iniciá sesión/ })).toBeVisible();
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
    // No es error rojo.
    await expect(page.locator('.text-red-500')).toHaveCount(0);
  });

  test('LIMITE_POR_USUARIO: aviso ámbar, sin descuento', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('**/api/v1/cupones/validar', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'Ya usaste este cupón y es uno por persona.', motivo: 'LIMITE_POR_USUARIO' },
      }),
    );

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito');
    await page.getByPlaceholder('Código de descuento').fill('BIENVENIDA');
    await page.getByRole('button', { name: /^Aplicar$/ }).click();

    await expect(page.getByText('Ya usaste este cupón y es uno por persona.')).toBeVisible();
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
    await expect(page.getByText('$8.000').first()).toBeVisible();
  });
});

// Fase 2c: cupón traído por ?cupon= en la URL (link del mail de bienvenida).
// CuponWatcher lo deja como "pendiente" en el store; el carrito ofrece aplicarlo.
test.describe('Cupón pendiente (?cupon=)', () => {
  test('la URL con ?cupon= muestra el banner "tenés un cupón listo" y lo aplica', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito?cupon=MATE20');

    const banner = page.getByText(/Tenés un cupón listo/);
    await expect(banner).toBeVisible();
    await expect(page.getByText('MATE20', { exact: true })).toBeVisible();
    // El query param se limpia de la URL.
    await expect(page).toHaveURL(/\/carrito$/);

    await page.getByRole('button', { name: 'Aplicar cupón pendiente' }).click();

    await expect(page.getByText(/Descuento \(MATE20\)/)).toBeVisible();
    await expect(banner).toHaveCount(0);
  });

  test('descartar el banner con la ✕ no aplica nada', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await mockValidarCupon(page);

    await agregarProductoAlCarrito(page);
    await page.goto('/carrito?cupon=MATE20');

    await expect(page.getByText(/Tenés un cupón listo/)).toBeVisible();
    await page.getByRole('button', { name: 'Descartar cupón' }).click();

    await expect(page.getByText(/Tenés un cupón listo/)).toHaveCount(0);
    await expect(page.getByText(/Descuento \(/)).toHaveCount(0);
  });
});

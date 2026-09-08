import { test, expect, type Page } from '@playwright/test';
import { PRODUCTO_MOCK, mockGeoref } from './fixtures';

// F4 — caja "Envío y retiro" en la ficha de producto (ProductoDetalle).

const EXPRESS = {
  id: 1, nombre: 'Envío Express', proveedor: 'oca', descripcion: 'Llega en 24 a 72 hs',
  costo: 6000, costo_original: 6000, api_conectada: false, envio_gratis: false, disponible: true,
};
const RETIRO = {
  id: 2, nombre: 'Retiro en Once', proveedor: 'retiro', descripcion: 'Coordinamos por WhatsApp',
  costo: 0, costo_original: 0, api_conectada: false, envio_gratis: false, disponible: true,
  recomendado: true,
  ubicacion: { direccion: 'Larrea 324', localidad: 'Once', partido: 'CABA', horarios: 'Lun a Vie de 10 a 18 h' },
};
const CORREO = {
  id: 3, nombre: 'Correo Argentino', proveedor: 'correo', descripcion: 'Llega en 3 a 7 días',
  costo: 4990, costo_original: 4990, api_conectada: false, envio_gratis: false, disponible: true,
};

async function setup(
  page: Page,
  opts: { metodos: unknown[]; onCalcular?: (body: any) => void; clearStorage?: boolean } = { metodos: [] },
) {
  // addInitScript corre en cada navegación (incluida reload): solo lo usamos
  // cuando el test NO depende de la persistencia del destino elegido.
  if (opts.clearStorage !== false) {
    await page.addInitScript(() => window.localStorage.clear());
  }
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) => route.fulfill({ json: PRODUCTO_MOCK }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
  await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], algoritmo: 'heuristica' } }),
  );
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
    route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  await mockGeoref(page);
  await page.route('**/api/v1/envios/calcular', (route) => {
    opts.onCalcular?.(route.request().postDataJSON());
    return route.fulfill({ json: opts.metodos });
  });
}

async function elegirDestino(page: Page) {
  const caja = page.getByTestId('calculadora-envio');
  await caja.getByRole('combobox').first().selectOption('Buenos Aires');
  await caja.getByRole('combobox').nth(1).selectOption('Ciudad E2E');
}

test.describe('PDP — calculadora de envío', () => {
  test('estado inicial: mensaje universal + selector, sin pegarle a /envios/calcular', async ({ page }) => {
    let calcularLlamado = false;
    await setup(page, { metodos: [], onCalcular: () => { calcularLlamado = true; } });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    const caja = page.getByTestId('calculadora-envio');
    await expect(caja.getByText('Envío y retiro')).toBeVisible();
    await expect(caja.getByText(/Enviamos a todo el país/)).toBeVisible();
    await expect(caja.getByRole('combobox').first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(calcularLlamado).toBe(false);
  });

  test('al elegir provincia y ciudad calcula y muestra Express + retiro (con badge y dirección)', async ({ page }) => {
    let body: any = null;
    await setup(page, { metodos: [CORREO, RETIRO, EXPRESS], onCalcular: (b) => { body = b; } });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await elegirDestino(page);

    await expect(page.getByText('Envío Express')).toBeVisible();
    await expect(page.getByText('Llega en 24 a 72 hs')).toBeVisible();
    await expect(page.getByText('$6.000')).toBeVisible();
    await expect(page.getByText('Retiro en Once')).toBeVisible();
    await expect(page.getByText('Más cerca tuyo')).toBeVisible();
    await expect(page.getByText('Larrea 324, Once')).toBeVisible();
    // Correo/Andreani NO se muestran en la PDP
    await expect(page.getByText('Correo Argentino')).toHaveCount(0);

    expect(body).toMatchObject({ partido: 'Partido E2E', localidad: 'Ciudad E2E' });
  });

  test('la ubicación queda guardada: al recargar muestra el resultado sin volver a elegir', async ({ page }) => {
    await setup(page, { metodos: [EXPRESS, RETIRO], clearStorage: false });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await elegirDestino(page);
    await expect(page.getByText('Envío Express')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Envío Express')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar' })).toBeVisible();
    await expect(page.getByTestId('calculadora-envio').getByRole('combobox')).toHaveCount(0);
  });

  test('fuera de la zona Express: no dice "no disponible", manda al checkout', async ({ page }) => {
    await setup(page, { metodos: [{ ...EXPRESS, disponible: false, costo: null }, { ...RETIRO, recomendado: false }] });

    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await elegirDestino(page);

    await expect(page.getByText(/lo ves en el checkout, antes de pagar/)).toBeVisible();
    await expect(page.getByText(/no disponible/i)).toHaveCount(0);
    await expect(page.getByText('Retiro en Once')).toBeVisible();
  });
});

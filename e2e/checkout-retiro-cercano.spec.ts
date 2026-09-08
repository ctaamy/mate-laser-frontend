import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago, PRODUCTO_MOCK } from './fixtures';

// F3 — el checkout muestra la dirección de cada punto de retiro y recomienda
// (badge + primero en la lista) el más cercano al comprador.

const RETIRO_CERCANO = {
  id: 20, nombre: 'Retiro en Once', proveedor: 'retiro', descripcion: 'Coordinamos por WhatsApp',
  costo: 0, costo_original: 0, api_conectada: false, envio_gratis: false, disponible: true,
  recomendado: true,
  ubicacion: { direccion: 'Larrea 324', localidad: 'Once', partido: 'CABA', horarios: 'Lun a Vie de 10 a 18 h' },
};
const RETIRO_LEJOS = {
  id: 21, nombre: 'Retiro en Villa Crespo', proveedor: 'retiro', descripcion: 'Coordinamos por WhatsApp',
  costo: 0, costo_original: 0, api_conectada: false, envio_gratis: false, disponible: true,
  recomendado: false,
  ubicacion: { direccion: 'Corrientes 5400', localidad: 'Villa Crespo', partido: 'CABA' },
};
const CORREO = {
  id: 22, nombre: 'Correo Argentino', proveedor: 'correo', descripcion: 'Llega en 3 a 7 días hábiles',
  costo: 4990, costo_original: 4990, api_conectada: false, envio_gratis: false, disponible: true,
};

async function irAEnvio(page: Page, metodos: unknown[]) {
  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  await page.route('**/api/v1/envios/calcular', (route) => route.fulfill({ json: metodos }));

  await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
  await page.getByRole('button', { name: /Agregar al carrito/i }).click();
  await page.goto('/carrito');
  await page.getByRole('button', { name: /Continuar con el envío/i }).click();
  await page.getByPlaceholder('María').fill('Juana');
  await page.getByPlaceholder('González').fill('Pérez');
  await page.getByPlaceholder('tu@email.com').fill('juana@test.com');
  await page.getByPlaceholder('+54 11 XXXX-XXXX').fill('1122334455');
  await page.getByLabel(/Provincia \*/).selectOption('Buenos Aires');
  await page.getByLabel(/Ciudad \/ Localidad \*/).selectOption('Ciudad E2E');
  await expect(page.getByText('Correo Argentino')).toBeVisible();
}

test.describe('Checkout — punto de retiro más cercano (F3)', () => {
  // El backend devuelve las filas ordenadas por `orden`; el front reordena.
  test('el retiro recomendado va primero, con badge "Más cerca tuyo" y su dirección', async ({ page }) => {
    await irAEnvio(page, [CORREO, RETIRO_LEJOS, RETIRO_CERCANO]);

    await expect(page.getByText('Más cerca tuyo')).toBeVisible();
    await expect(page.getByText('Larrea 324, Once')).toBeVisible();
    await expect(page.getByText('Lun a Vie de 10 a 18 h')).toBeVisible();

    // Orden en la lista: recomendado → otro retiro → Correo
    const txt = await page.locator('.flujo-compra').innerText();
    expect(txt.indexOf('Retiro en Once')).toBeLessThan(txt.indexOf('Retiro en Villa Crespo'));
    expect(txt.indexOf('Retiro en Villa Crespo')).toBeLessThan(txt.indexOf('Correo Argentino'));
  });

  test('al elegir el retiro, el aviso muestra la dirección y el horario', async ({ page }) => {
    await irAEnvio(page, [RETIRO_CERCANO, CORREO]);

    await page.getByText('Retiro en Once').click();
    // El aviso (no la card) combina dirección + horario en una sola línea.
    await expect(page.getByText(/Retirás en\s*Larrea 324, Once.*Lun a Vie de 10 a 18 h/s)).toBeVisible();
  });

  test('sin recomendado, no aparece el badge y no se reordena', async ({ page }) => {
    await irAEnvio(page, [CORREO, { ...RETIRO_LEJOS, id: 30, nombre: 'Retiro único' }]);

    await expect(page.getByText('Más cerca tuyo')).toHaveCount(0);
    await expect(page.getByText('Corrientes 5400, Villa Crespo')).toBeVisible();
  });
});

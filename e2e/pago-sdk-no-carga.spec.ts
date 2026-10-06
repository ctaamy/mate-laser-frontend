import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago } from './fixtures';

// Si el script del SDK de Mercado Pago no llega (sin conexión, un bloqueador de
// anuncios frenando mercadopago.com), /pago quedaba con el spinner "Cargando
// formulario de pago…" para siempre: no escuchaba `onerror` ni había timeout.
// Ahora avisa y deja reintentar.

const ESPERA_FORMULARIO = 'Cargando formulario de pago…';
const AVISO_FORMULARIO_LISTO = 'Con tarjeta, elegí si es de crédito o de débito.';

// Cuerpo de un SDK "real": window.MercadoPago recién existe cuando el script se ejecuta.
const SDK_QUE_SE_DEFINE_AL_CARGAR = `
  window.MercadoPago = function () {
    return { bricks: function () { return { create: function (tipo, id, settings) {
      window.__mpBrickSettings = settings;
      setTimeout(function () { settings.callbacks.onReady(); }, 0);
      return Promise.resolve({ unmount: function () {} });
    } }; } };
  };
`;

test.describe('Pago: el SDK de Mercado Pago no carga', () => {
  test('avisa que no cargó, saca el spinner y "Reintentar" lo vuelve a pedir', async ({ page }) => {
    const { ordenId } = await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });

    let bloqueado = true;
    let pedidos = 0;
    // Se registra DESPUÉS del helper: Playwright resuelve primero la ruta más nueva.
    await page.route('https://sdk.mercadopago.com/js/v2', (route) => {
      pedidos += 1;
      return bloqueado
        ? route.abort()
        : route.fulfill({ contentType: 'application/javascript', body: '/* noop: MercadoPago ya definido */' });
    });

    await page.goto(`/pago/${ordenId}`);

    const aviso = page.getByRole('alert').filter({ hasText: 'No pudimos cargar el formulario de pago' });
    await expect(aviso).toBeVisible();
    await expect(page.getByText(ESPERA_FORMULARIO)).toHaveCount(0);
    expect(pedidos).toBe(1);

    // El bloqueo se levantó (volvió la red / se desactivó el adblock): reintentar.
    bloqueado = false;
    await aviso.getByRole('button', { name: 'Reintentar' }).click();

    await expect(aviso).toHaveCount(0);
    // Montó el Brick: aparece la línea que solo se muestra con el formulario listo.
    await expect(page.getByText(AVISO_FORMULARIO_LISTO)).toBeVisible();
    expect(pedidos).toBe(2);
  });

  test('reintentar con el SDK todavía caído vuelve a mostrar el aviso (no queda colgado)', async ({ page }) => {
    const { ordenId } = await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.route('https://sdk.mercadopago.com/js/v2', (route) => route.abort());

    await page.goto(`/pago/${ordenId}`);
    const aviso = page.getByRole('alert').filter({ hasText: 'No pudimos cargar el formulario de pago' });
    await expect(aviso).toBeVisible();

    await aviso.getByRole('button', { name: 'Reintentar' }).click();
    await expect(aviso).toBeVisible();
    await expect(page.getByText(ESPERA_FORMULARIO)).toHaveCount(0);
  });

  test('con el SDK sano el formulario carga como siempre y no aparece el aviso', async ({ page }) => {
    const { ordenId } = await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(`/pago/${ordenId}`);

    await expect(page.getByText(AVISO_FORMULARIO_LISTO)).toBeVisible();
    await expect(page.getByText('No pudimos cargar el formulario de pago')).toHaveCount(0);
  });

  // Bug conocido (solo en dev, donde React monta los efectos dos veces): el segundo
  // montaje veía el <script> en el DOM, lo daba por cargado y armaba el Brick antes
  // de que existiera window.MercadoPago → "window.MercadoPago is not a constructor".
  test('un SDK que tarda en cargar no rompe el montaje (el remontaje espera al script)', async ({ page }) => {
    const { ordenId } = await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    // Sin el stub del helper: window.MercadoPago NO existe hasta que el script cargue.
    await page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>).MercadoPago;
    });
    await page.route('https://sdk.mercadopago.com/js/v2', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ contentType: 'application/javascript', body: SDK_QUE_SE_DEFINE_AL_CARGAR });
    });

    await page.goto(`/pago/${ordenId}`);

    await expect(page.getByText(AVISO_FORMULARIO_LISTO)).toBeVisible();
    expect(errores.filter((m) => /not a constructor/i.test(m))).toEqual([]);
  });
});

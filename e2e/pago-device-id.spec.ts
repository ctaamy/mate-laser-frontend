import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago, dispararSubmitDelBrick } from './fixtures';

// Fase 3a-1 (calidad de integración MP): el SDK de Mercado Pago genera un
// Device ID y lo deja en window.MP_DEVICE_SESSION_ID (verificado en producción:
// aparece en menos de 1 s después de instanciar MercadoPago). Pago.tsx lo lee
// al confirmar el pago y lo manda a /pagos/procesar-mp; el backend se lo pasa a
// MP como header X-Meli-Session-Id, que usa su motor antifraude para aprobar
// más pagos legítimos.
//
// El stub del SDK de estos e2e no genera el Device ID: cada test lo simula
// como lo hace el SDK real (una global que aparece después de instanciarlo).

const ORDEN_URL = '/pago/orden-e2e-1';

test.describe('Device ID de MP en el pago', () => {
  test('el pago envía a /pagos/procesar-mp el Device ID que generó el SDK', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.addInitScript(() => {
      (window as any).MP_DEVICE_SESSION_ID = 'device-e2e-0123456789';
    });
    await page.goto(ORDEN_URL);

    const request = page.waitForRequest((r) => r.url().includes('/pagos/procesar-mp'));
    await dispararSubmitDelBrick(page);
    const body = (await request).postDataJSON();

    expect(body.device_id).toBe('device-e2e-0123456789');
    // Lo demás del pago sigue igual.
    expect(body.token).toBe('tok-fake');
    expect(body.payment_method_id).toBe('visa');
    expect(body.external_reference).toBe('orden-e2e-1');
  });

  test('el Device ID se lee al confirmar el pago, no al montar el Brick (el SDK lo genera de forma asíncrona)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(ORDEN_URL);
    await page.waitForFunction(() => (window as any).__mpBrickSettings != null);

    // Recién ahora "aparece", como pasa con el SDK real segundos después de montar.
    await page.evaluate(() => {
      (window as any).MP_DEVICE_SESSION_ID = 'device-e2e-tardio-9876543210';
    });

    const request = page.waitForRequest((r) => r.url().includes('/pagos/procesar-mp'));
    await dispararSubmitDelBrick(page);

    expect((await request).postDataJSON().device_id).toBe('device-e2e-tardio-9876543210');
  });

  test('si el SDK no generó el Device ID, el pago se envía igual y sin ese campo', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(ORDEN_URL);

    const request = page.waitForRequest((r) => r.url().includes('/pagos/procesar-mp'));
    await dispararSubmitDelBrick(page);
    const body = (await request).postDataJSON();

    expect(body).not.toHaveProperty('device_id');
    expect(body.token).toBe('tok-fake');
    // El pago no se bloquea: sigue el flujo normal hasta la confirmación.
    await expect(page).toHaveURL(/\/confirmacion\/orden-e2e-1/);
  });

  test('un valor que no es texto en la global no se manda (no rompe el pago)', async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.addInitScript(() => {
      (window as any).MP_DEVICE_SESSION_ID = { raro: true };
    });
    await page.goto(ORDEN_URL);

    const request = page.waitForRequest((r) => r.url().includes('/pagos/procesar-mp'));
    await dispararSubmitDelBrick(page);

    expect((await request).postDataJSON()).not.toHaveProperty('device_id');
  });
});

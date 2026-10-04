import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago } from './fixtures';

// Caracterización de cómo reacciona Pago.tsx al onError del Payment Brick de MP.
//
// Se escribió ANTES de agregar el aviso de "tarjeta en la sección equivocada"
// (docs/propuesta-aviso-tarjeta-debito-brick.md): CLAUDE.md pide tests previos
// que cubran el código de pagos antes de tocarlo. Fija lo que NO tiene que
// cambiar con ese aviso:
//   · un error `critical` sigue mostrando el cartel rojo de error fatal;
//   · cualquier otro error del Brick no muestra ese cartel (el Brick ya pinta
//     su propio mensaje en el campo);
//   · un payload raro no rompe la página;
//   · el error se sigue logueando en consola.

const ORDEN_URL = '/pago/orden-e2e-1';
const CARTEL_FATAL = 'Error en el procesador de pagos.';

// Dispara onError del Brick como lo haría el SDK real: llamando al callback
// que Pago.tsx le pasó en create(...). El stub de e2e/fixtures.ts expone esos
// settings en window.__mpBrickSettings.
async function dispararErrorDelBrick(page: Page, payload: unknown) {
  await page.waitForFunction(() => (window as any).__mpBrickSettings != null);
  await page.evaluate((p) => {
    (window as any).__mpBrickSettings.callbacks.onError(p);
  }, payload);
}

test.describe('onError del Brick en /pago', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
    await page.goto(ORDEN_URL);
    await page.waitForFunction(() => (window as any).__mpBrickSettings != null);
  });

  test('un error crítico muestra el cartel de error del procesador de pagos', async ({ page }) => {
    await dispararErrorDelBrick(page, { type: 'critical', cause: 'fields_setup_failed', message: 'boom' });

    await expect(page.getByText(CARTEL_FATAL)).toBeVisible();
  });

  test('el error de tarjeta en sección equivocada (non_critical) no muestra el cartel de error fatal', async ({ page }) => {
    await dispararErrorDelBrick(page, {
      type: 'non_critical',
      cause: 'missing_payment_information',
      message: 'payment_method_not_in_allowed_types',
    });
    await page.waitForTimeout(300);

    await expect(page.getByText(CARTEL_FATAL)).toHaveCount(0);
  });

  test('otros errores no críticos no muestran el cartel de error fatal', async ({ page }) => {
    for (const message of [
      'no_payment_method_for_provided_bin',
      'payment_method_not_in_allowed_methods',
      'no_issuers_found_for_card',
    ]) {
      await dispararErrorDelBrick(page, { type: 'non_critical', cause: 'missing_payment_information', message });
    }
    await page.waitForTimeout(300);

    await expect(page.getByText(CARTEL_FATAL)).toHaveCount(0);
  });

  test('payloads raros no rompen la página', async ({ page }) => {
    const erroresDePagina: string[] = [];
    page.on('pageerror', (e) => erroresDePagina.push(e.message));

    for (const payload of [undefined, null, 'x', 42, {}]) {
      await dispararErrorDelBrick(page, payload);
    }
    await page.waitForTimeout(300);

    expect(erroresDePagina).toEqual([]);
    await expect(page.getByText(CARTEL_FATAL)).toHaveCount(0);
    await expect(page.getByText(/total a pagar/i)).toBeVisible();
  });

  test('el error del Brick se sigue logueando en consola', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') logs.push(msg.text());
    });

    await dispararErrorDelBrick(page, { type: 'non_critical', cause: 'x', message: 'y' });
    await page.waitForTimeout(300);

    expect(logs.some((l) => l.includes('Brick error:'))).toBe(true);
  });
});

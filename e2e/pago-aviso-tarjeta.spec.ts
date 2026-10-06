import { test, expect, type Page } from '@playwright/test';
import { mockBackendYMercadoPago } from './fixtures';

// Lo que los tests agregan a window (stub del SDK de MP, espías de Umami y de scroll).
type VentanaDeTest = {
  __mpBrickSettings: { callbacks: Record<string, (arg?: unknown) => unknown> };
  __marca?: unknown;
  __umami: [string, Record<string, unknown>?][];
  __scrolls: unknown[];
  umami: { track: (evento: string, datos?: Record<string, unknown>) => void };
};


// Aviso de "tarjeta en la sección equivocada" del Payment Brick + línea de
// WhatsApp en /pago (docs/propuesta-aviso-tarjeta-debito-brick.md del monorepo mate-laser).
//
// Problema real: si alguien abre "Tarjeta de crédito" y pone una tarjeta de
// DÉBITO (o al revés), el Brick marca el campo con "No pudimos obtener la
// información de pago. Intenta otra tarjeta" sin explicar qué pasó. Medido con
// el SDK real: llega onError({ type: 'non_critical', cause:
// 'missing_payment_information', message: 'payment_method_not_in_allowed_types' })
// y onBinChange llega ~300 ms ANTES que ese onError.
//
// El SDK real está stubbeado (e2e/fixtures.ts): los tests invocan los callbacks
// que Pago.tsx le pasa a bricks().create(...), expuestos en window.__mpBrickSettings.

const ORDEN_URL = '/pago/orden-e2e-1';
const ERROR_TARJETA = {
  type: 'non_critical',
  cause: 'missing_payment_information',
  message: 'payment_method_not_in_allowed_types',
};

const TEXTO_BASE = 'Con tarjeta, elegí si es de crédito o de débito.';
const TITULO_ERROR = 'Esa tarjeta no va en esta opción.';
const CARTEL_FATAL = 'Error en el procesador de pagos.';

async function abrirPago(page: Page, opts: { configuracion?: Record<string, unknown> } = {}) {
  // Espías del navegador: Umami (analítica) y scrollIntoView.
  await page.addInitScript(() => {
    const w = window as unknown as VentanaDeTest;
    w.__umami = [];
    w.umami = { track: (evento: string, datos?: Record<string, unknown>) => w.__umami.push([evento, datos]) };
    w.__scrolls = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
      if ((this as HTMLElement).dataset?.testid === 'aviso-tarjeta') w.__scrolls.push(arg);
      return original.call(this, arg);
    };
  });
  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  // Registrada después => tiene prioridad sobre el `{}` del fixture.
  if (opts.configuracion) {
    await page.route(/\/api\/v1\/configuracion$/, (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: opts.configuracion }) : route.continue(),
    );
  }
  await page.goto(ORDEN_URL);
  await page.waitForFunction(() => (window as unknown as VentanaDeTest).__mpBrickSettings != null);
}

async function brick(page: Page, callback: 'onError' | 'onBinChange' | 'onReady' | 'onSubmit', arg?: unknown) {
  await page.evaluate(
    ([cb, a]) => (window as unknown as VentanaDeTest).__mpBrickSettings.callbacks[cb as string](a),
    [callback, arg] as const,
  );
}

const aviso = (page: Page) => page.getByTestId('aviso-tarjeta');

test.describe('Aviso de tarjeta en la sección equivocada', () => {
  test('estado base: una línea de ayuda neutra, en un contenedor aria-live que está siempre en el DOM', async ({ page }) => {
    await abrirPago(page);

    await expect(aviso(page)).toHaveAttribute('role', 'status');
    await expect(aviso(page)).toHaveAttribute('aria-live', 'polite');
    await expect(aviso(page)).toContainText(TEXTO_BASE);
    await expect(aviso(page)).not.toContainText(TITULO_ERROR);
  });

  test('el error exacto de MP pasa el mismo cartel al estado de error y nombra las dos opciones', async ({ page }) => {
    await abrirPago(page);

    await brick(page, 'onError', ERROR_TARJETA);

    await expect(aviso(page)).toContainText(TITULO_ERROR);
    await expect(aviso(page)).toContainText('“Tarjeta de débito”');
    await expect(aviso(page)).toContainText('“Tarjeta de crédito”');
    await expect(aviso(page)).not.toContainText(TEXTO_BASE);
    // No es un error fatal: no aparece el recuadro rojo ni se reusa ese estado.
    await expect(page.getByText(CARTEL_FATAL)).toHaveCount(0);
  });

  test('el aviso no remonta el Brick (el usuario no pierde lo que tipeó)', async ({ page }) => {
    await abrirPago(page);
    await page.evaluate(() => { (window as unknown as VentanaDeTest).__marca = (window as unknown as VentanaDeTest).__mpBrickSettings; });

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    await brick(page, 'onBinChange', '40027686');
    await expect(aviso(page)).toContainText(TEXTO_BASE);

    // create() pisa __mpBrickSettings cada vez que se monta un Brick: si es el mismo objeto, no hubo remonte.
    expect(await page.evaluate(() => (window as unknown as VentanaDeTest).__marca === (window as unknown as VentanaDeTest).__mpBrickSettings)).toBe(true);
  });

  test('otros errores del Brick (incluidos los "hermanos" del mismo cause) no cambian el estado', async ({ page }) => {
    await abrirPago(page);

    for (const message of [
      'no_payment_method_for_provided_bin',
      'payment_method_not_in_allowed_methods',
      'no_issuers_found_for_card',
      'payment_method_not_in_allowed_types_x',
    ]) {
      await brick(page, 'onError', { type: 'non_critical', cause: 'missing_payment_information', message });
    }
    // Mismo message pero sin ser objeto / sin message: tampoco.
    await brick(page, 'onError', 'payment_method_not_in_allowed_types');

    await expect(aviso(page)).toContainText(TEXTO_BASE);
    await expect(aviso(page)).not.toContainText(TITULO_ERROR);
  });

  test('un error crítico sigue mostrando el cartel fatal y no el aviso', async ({ page }) => {
    await abrirPago(page);

    await brick(page, 'onError', { type: 'critical', cause: 'fields_setup_failed', message: 'boom' });

    await expect(page.getByText(CARTEL_FATAL)).toBeVisible();
    await expect(aviso(page)).not.toContainText(TITULO_ERROR);
  });

  test('payloads raros no rompen la página ni cambian el estado', async ({ page }) => {
    const erroresDePagina: string[] = [];
    page.on('pageerror', (e) => erroresDePagina.push(e.message));
    await abrirPago(page);

    for (const payload of [undefined, null, 'x', 42, {}, { message: null }, { message: { a: 1 } }]) {
      await brick(page, 'onError', payload);
    }

    expect(erroresDePagina).toEqual([]);
    await expect(aviso(page)).toContainText(TEXTO_BASE);
  });

  test('vuelve al estado base con un número nuevo (onBinChange), al reintentar (onReady) y al pagar (onSubmit)', async ({ page }) => {
    await abrirPago(page);
    // Con el pago fallando, onSubmit no navega: se puede mirar el aviso después.
    await page.route('**/api/v1/pagos/procesar-mp', (route) => route.fulfill({ status: 500, json: { message: 'caído' } }));

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    await brick(page, 'onBinChange', '45099535');
    await expect(aviso(page)).toContainText(TEXTO_BASE);

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    await brick(page, 'onReady');
    await expect(aviso(page)).toContainText(TEXTO_BASE);

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    await brick(page, 'onSubmit', { formData: { token: 'tok-fake', payment_method_id: 'visa' } }).catch(() => {});
    await expect(aviso(page)).toContainText(TEXTO_BASE);
  });

  test('scrollea al aviso una sola vez por episodio (nearest) y sin mover el foco', async ({ page }) => {
    await abrirPago(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    // El error puede dispararse varias veces seguidas: no tiene que "saltar" en cada una.
    await brick(page, 'onError', ERROR_TARJETA);
    await brick(page, 'onError', ERROR_TARJETA);

    const scrolls = await page.evaluate(() => (window as unknown as VentanaDeTest).__scrolls);
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]).toMatchObject({ block: 'nearest' });
    // No robó el foco (cerraría el teclado en mobile).
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    // Un episodio nuevo (después de limpiar) sí vuelve a scrollear.
    await brick(page, 'onBinChange', '45099535');
    await brick(page, 'onError', ERROR_TARJETA);
    await expect.poll(() => page.evaluate(() => (window as unknown as VentanaDeTest).__scrolls.length)).toBe(2);
  });
});

test.describe('Telemetría del aviso', () => {
  test('mide el error y el aviso, solo con valores saneados y sin el BIN', async ({ page }) => {
    await abrirPago(page);

    await brick(page, 'onError', ERROR_TARJETA);
    await expect(aviso(page)).toContainText(TITULO_ERROR);
    // Un message con pinta de dato (BIN) no se manda tal cual.
    await brick(page, 'onError', { type: 'non_critical', cause: 'x', message: 'bin 40027686 raro' });

    const eventos = (await page.evaluate(() => (window as unknown as VentanaDeTest).__umami)) as [string, Record<string, unknown>?][];

    expect(eventos).toContainEqual([
      'mp_brick_error',
      { tipo: 'non_critical', causa: 'missing_payment_information', mensaje: 'payment_method_not_in_allowed_types' },
    ]);
    expect(eventos.filter(([e]) => e === 'pago_aviso_tarjeta')).toHaveLength(1);
    expect(eventos).toContainEqual(['mp_brick_error', { tipo: 'non_critical', causa: 'x', mensaje: 'otro' }]);
    // Ningún valor de ningún evento contiene 6+ dígitos seguidos.
    expect(JSON.stringify(eventos)).not.toMatch(/\d{6,}/);
  });
});

test.describe('Línea de WhatsApp en /pago', () => {
  test('con teléfono configurado: link a WhatsApp con el número de pedido en el mensaje', async ({ page }) => {
    await abrirPago(page, { configuracion: { telefono_contacto: '+54 9 11 5555-1234' } });

    const link = page.getByRole('link', { name: /escribinos por whatsapp/i });
    await expect(link).toBeVisible();
    await expect(page.getByText(/¿algo no funciona\?/i)).toBeVisible();

    const href = (await link.getAttribute('href'))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=/);
    expect(decodeURIComponent(href.split('text=')[1])).toContain('#ORDEN-E2');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('sin teléfono configurado: no se muestra la línea (no hay a dónde mandar)', async ({ page }) => {
    await abrirPago(page, { configuracion: {} });

    await expect(page.getByText(/¿algo no funciona\?/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /escribinos por whatsapp/i })).toHaveCount(0);
  });
});

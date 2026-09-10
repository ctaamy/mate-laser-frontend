import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Smoke test post-deploy: el Brick de pago de Mercado Pago no debe generar
// violaciones de Content-Security-Policy en el frontend deployado.
//
// Por qué existe: el SDK real de MP (sdk.mercadopago.com/js/v2) nunca corre
// en el E2E funcional — e2e/fixtures.ts lo mockea entero — y la CSP de
// public/serve.json solo se aplica en producción (la sirve `serve`, no el
// dev server de Vite). O sea: la combinación "SDK real × CSP real" no la
// cubre ningún otro test. Cada vez que se toca la CSP o MP bumpea el SDK,
// el checkout se puede romper en prod sin que CI se entere. Esto lo agarra.
//
// Corre contra SMOKE_BASE_URL — que tiene que ser el DOMINIO REAL
// (www.matelaserstudio.com.ar), no el crudo de Fly: la API solo permite ese
// origen por CORS y el Brick de MP solo renderiza en el dominio registrado
// para la public key. Stubbea la orden del backend (para forzar el montaje
// del Brick) y el chrome del sitio (Navbar/tema — no toca MP ni la CSP);
// todo lo de MP (SDK, iframes de mercadolibre/mlstatic, la CSP servida) va real.
// ─────────────────────────────────────────────────────────────────────────

type CspViolation = {
  violatedDirective: string;
  blockedURI: string;
  sourceFile: string;
  lineNumber: number;
};

const ORDEN_SMOKE = {
  id: 'smoke-csp',
  estado: 'pendiente',
  total: 1000,
  subtotal: 1000,
  costo_envio: 0,
  descuento: 0,
  metodo_pago: 'mercadopago',
  direccion_envio: { tipo: 'retiro' },
  creado_en: new Date().toISOString(),
  items_orden: [
    {
      id: 'smoke-item-1',
      producto_id: 'smoke-prod-1',
      nombre_producto: 'Producto smoke',
      precio_unitario: 1000,
      cantidad: 1,
      subtotal: 1000,
    },
  ],
  pagos: [{ estado: 'pendiente', proveedor: 'mercadopago' }],
};

test('el Brick de MP monta sin violaciones de CSP en el frontend deployado', async ({ page }) => {
  const base = process.env.SMOKE_BASE_URL;

  // Capturar violaciones de CSP del documento principal. Es acá donde
  // impactan las que venimos arreglando: <script> inline del SDK
  // (script-src), iframe de mercadolibre.com (frame-src), fetches del SDK
  // (connect-src). Una violación DENTRO del iframe de MP no burbujea hasta
  // acá — pero esas son CSP de MP, no nuestra.
  await page.addInitScript(() => {
    (window as Window & { __cspViolations?: unknown[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as Window & { __cspViolations?: unknown[] }).__cspViolations!.push({
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
      });
    });
  });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  // La orden: sin esto Pago.tsx corta antes de montar el Brick (necesita
  // `orden` truthy y en un estado pagable).
  await page.route('**/api/v1/ordenes/**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: ORDEN_SMOKE })
      : route.continue(),
  );
  // CuotasBanner (montado en Pago.tsx) — evitar depender de que el producto
  // smoke exista en la DB real.
  await page.route('**/api/v1/productos/**/promociones-bancarias', (route) =>
    route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 1, sin_interes: false } }),
  );
  // Chrome del sitio (Navbar / tema / footer) — le pega a estos endpoints al
  // cargar CUALQUIER página. Contra SMOKE_BASE_URL corren sobre la API real
  // de prod, cuyo CORS NO permite el dominio crudo de Fly (a propósito:
  // nadie entra por ahí). Sin stubbearlos, fallan por CORS y llenan la
  // consola de errores que no tienen nada que ver con lo que este test
  // valida (SDK real de MP × CSP real) — y encima dejan la página a medio
  // cargar, lo que puede tapar/retrasar el montaje del Brick. Se responden
  // con lo mínimo para que la página cargue limpia.
  await page.route('**/api/v1/configuracion', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/v1/configuracion/homepage', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));

  await page.goto(`/pago/${ORDEN_SMOKE.id}`, { waitUntil: 'domcontentloaded' });

  // El Brick real monta un iframe de MP/ML/mlstatic cuando el SDK terminó
  // de inicializar. Si la CSP bloquea alguna etapa, este selector no aparece.
  const brickIframe = page.locator(
    'iframe[src*="mercadopago.com"], iframe[src*="mercadolibre.com"], iframe[src*="mlstatic.com"]',
  );
  const BRICK_TIMEOUT_MS = 60_000; // MP a veces tarda en inicializar el SDK
  const montó = await brickIframe
    .first()
    .waitFor({ state: 'attached', timeout: BRICK_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);

  // Margen para violaciones tardías: el SDK inicializa en etapas y la CSP
  // falla de a una por vez.
  await page.waitForTimeout(3_000);

  const violaciones = (await page.evaluate(
    () => (window as Window & { __cspViolations?: CspViolation[] }).__cspViolations ?? [],
  )) as CspViolation[];

  const detalle = violaciones
    .map((v) => `  · ${v.violatedDirective} bloqueó ${v.blockedURI || '(inline)'} — ${v.sourceFile}:${v.lineNumber}`)
    .join('\n');

  expect(
    violaciones,
    `El Brick de MP disparó ${violaciones.length} violación(es) de CSP en ${base}:\n${detalle}\n` +
      `→ Ajustar el header Content-Security-Policy en mate-laser-frontend/public/serve.json.\n` +
      `Console errors:\n  ${consoleErrors.join('\n  ') || '(ninguno)'}`,
  ).toHaveLength(0);

  // Red de seguridad: si el Brick deja de montar SIN disparar una violación
  // de CSP (otra rotura: SDK caído, cambio de API del Brick, timeout), que
  // el smoke igual lo marque en vez de pasar en verde.
  expect(
    montó,
    `El iframe del Brick de MP no apareció en ${BRICK_TIMEOUT_MS / 1000}s en ${base}, y no se ` +
      `registraron violaciones de CSP — así que es otra cosa (SDK caído, cambio de API del Brick, red).\n` +
      `Console errors:\n  ${consoleErrors.join('\n  ') || '(ninguno)'}`,
  ).toBe(true);
});

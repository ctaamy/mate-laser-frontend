import type { Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Fixtures y mocks para el E2E de compra.
//
// Mockeamos TODO el backend (vía page.route) y el SDK de Mercado Pago.
// Esto hace el test hermético y rápido (no requiere Postgres ni una cuenta
// real de MP), y nos deja apuntar la lupa exactamente donde vive el bug de
// "redirect post-pago fallido": la lógica de navegación en Pago.tsx, que es
// 100% client-side (no depende de los back_urls de Mercado Pago).
//
// Trade-off consciente: esto NO es un test de integración contra el backend
// real. Si el día de mañana se rompe el contrato entre frontend y backend
// (ej. cambia la forma de la respuesta de /pagos/procesar-mp), este test no
// lo detecta — eso lo cubren los unit tests de pagos.service.spec.ts.
// ─────────────────────────────────────────────────────────────────────────

export const PRODUCTO_MOCK = {
  id: 'prod-e2e-1',
  nombre: 'Mate Imperial Grabado',
  slug: 'mate-imperial-grabado',
  descripcion: 'Mate de acero con grabado láser personalizado',
  precio_base: 8000,
  stock: 10,
  stock_alerta: 2,
  apto_grabado: true,
  personalizado_habilitado: true,
  personalizado_max_chars: 20,
  personalizado_placeholder: 'Ej: Para Juan',
  colores_disponibles: ['negro', 'blanco'],
  activo: true,
  destacado: true,
  orden: 1,
  creado_en: new Date().toISOString(),
  imagenes_producto: [],
};

export const METODO_ENVIO_MOCK = {
  id: 1,
  nombre: 'Retiro en local',
  proveedor: 'retiro',
  descripcion: 'Retirá tu pedido en el local',
  costo: 0,
  costo_original: 0,
  api_conectada: false,
  envio_gratis: false,
};

const ORDEN_ID = 'orden-e2e-1';

function ordenMock(overrides: Record<string, any> = {}) {
  return {
    id: ORDEN_ID,
    estado: 'pendiente',
    direccion_envio: { tipo: 'retiro' },
    subtotal: 8000,
    costo_envio: 0,
    descuento: 0,
    total: 8000,
    metodo_pago: 'mercadopago',
    creado_en: new Date().toISOString(),
    items_orden: [
      {
        id: 'item-1',
        orden_id: ORDEN_ID,
        producto_id: PRODUCTO_MOCK.id,
        nombre_producto: PRODUCTO_MOCK.nombre,
        texto_grabado: 'Para Juan',
        precio_unitario: 8000,
        cantidad: 1,
        subtotal: 8000,
      },
    ],
    pagos: [{ estado: 'pendiente', proveedor: 'mercadopago' }],
    ...overrides,
  };
}

// Stub del SDK de Mercado Pago (sdk.mercadopago.com/js/v2). Se inyecta con
// addInitScript ANTES de que corra cualquier script de la página, evitando
// la carrera de red del <script src> real: window.MercadoPago queda
// definido de forma síncrona apenas arranca el documento.
// Expone window.__mpBrickSettings para que el test dispare onSubmit/onReady
// como si el usuario hubiera completado el formulario del Brick.
const FAKE_MP_SDK = `
  window.MercadoPago = function (publicKey, options) {
    return {
      bricks: function () {
        return {
          create: function (type, containerId, settings) {
            window.__mpBrickSettings = settings;
            setTimeout(function () {
              if (settings.callbacks && settings.callbacks.onReady) settings.callbacks.onReady();
            }, 0);
            return Promise.resolve({ unmount: function () {} });
          },
        };
      },
    };
  };
`;

export async function mockBackendYMercadoPago(
  page: Page,
  opts: { estadoPagoBrick: 'approved' | 'rejected' },
) {
  await page.addInitScript(FAKE_MP_SDK);

  // El <script src="https://sdk.mercadopago.com/js/v2"> real igual se agrega
  // al DOM (Pago.tsx lo hace incondicionalmente) — lo respondemos vacío para
  // que dispare su evento onload y el componente marque sdkReady=true.
  await page.route('https://sdk.mercadopago.com/js/v2', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '/* noop: MercadoPago ya definido vía addInitScript */' }),
  );

  // Listado y detalle de producto
  await page.route('**/api/v1/productos?**', (route) =>
    route.fulfill({ json: { data: [PRODUCTO_MOCK], total: 1, page: 1, totalPages: 1 } }),
  );
  await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) =>
    route.fulfill({ json: PRODUCTO_MOCK }),
  );

  // Cotización de envío
  await page.route('**/api/v1/envios/calcular', (route) =>
    route.fulfill({ json: [METODO_ENVIO_MOCK] }),
  );

  // Creación de la orden (checkout → pago)
  await page.route('**/api/v1/ordenes', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({ json: ordenMock() });
  });

  // Consulta de la orden (usada por Pago.tsx y Confirmacion.tsx)
  let estadoActualOrden = 'pendiente';
  await page.route(`**/api/v1/ordenes/${ORDEN_ID}`, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      json: ordenMock({
        estado: estadoActualOrden,
        pagos: [{ estado: estadoActualOrden === 'pagado' ? 'aprobado' : estadoActualOrden, proveedor: 'mercadopago' }],
      }),
    });
  });

  // Procesamiento del pago vía Brick — acá se decide aprobado vs rechazado
  await page.route('**/api/v1/pagos/procesar-mp', (route) => {
    const status = opts.estadoPagoBrick;
    estadoActualOrden = status === 'approved' ? 'pagado' : 'rechazado';
    return route.fulfill({
      json: { status, status_detail: status === 'approved' ? 'accredited' : 'cc_rejected_other', orden_id: ORDEN_ID },
    });
  });

  return { ordenId: ORDEN_ID };
}

// Dispara el onSubmit del Brick como si el usuario hubiera cargado la tarjeta
// y hecho click en "Pagar" dentro del iframe de Mercado Pago.
export async function dispararSubmitDelBrick(page: Page) {
  await page.waitForFunction(() => (window as any).__mpBrickSettings != null);
  await page.evaluate(() => {
    const settings = (window as any).__mpBrickSettings;
    return settings.callbacks.onSubmit({ formData: { token: 'tok-fake', payment_method_id: 'visa' } });
  });
}

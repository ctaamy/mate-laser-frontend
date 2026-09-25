import type { Page, Route } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Backend de "Caja y compras" simulado con page.route (mismo patrón que
// fixtures-admin.ts): tests herméticos, sin Postgres. Guarda lo que la UI
// manda para poder asserir sobre los cuerpos de los POST/PUT.
// ─────────────────────────────────────────────────────────────────────────

const ART = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
export const hoyART = () => ART.format(new Date());

export const CUENTAS = [
  { id: 'c-banco-tami', nombre: 'Banco Tami', tipo: 'banco', titular: 'Tami', alias: 'mlaser', recibe: 'transferencias_web', es_del_negocio: true, saldo_inicial: 100000, fecha_inicio: '2026-09-01', orden: 0, archivada: false, saldo: 98500, a_liberar: 0 },
  { id: 'c-mp', nombre: 'Mercado Pago (Facu)', tipo: 'mercadopago', titular: 'Facu', alias: null, recibe: null, es_del_negocio: true, saldo_inicial: 20000, fecha_inicio: '2026-09-01', orden: 1, archivada: false, saldo: 20000, a_liberar: 0 },
  { id: 'c-banco-facu', nombre: 'Banco Facu', tipo: 'banco', titular: 'Facu', alias: null, recibe: null, es_del_negocio: true, saldo_inicial: 3000, fecha_inicio: '2026-09-01', orden: 2, archivada: false, saldo: 3000, a_liberar: 0 },
  { id: 'c-efectivo', nombre: 'Efectivo', tipo: 'efectivo', titular: null, alias: null, recibe: 'efectivo_ventas', es_del_negocio: true, saldo_inicial: 5000, fecha_inicio: '2026-09-01', orden: 3, archivada: false, saldo: 5000, a_liberar: 0 },
  { id: 'c-bolsillo-facu', nombre: 'Bolsillo de Facu', tipo: 'bolsillo', titular: 'Facu', alias: null, recibe: null, es_del_negocio: false, saldo_inicial: 0, fecha_inicio: '2026-09-01', orden: 100, archivada: false, saldo: -12000, a_liberar: 0 },
] as const;

export type MovimientoMock = Record<string, unknown>;

export interface CuerpoMovimiento {
  tipo: string;
  cuenta_id: string;
  monto: number;
  categoria: string;
  clave_cliente: string;
  fecha?: string;
  nota?: string;
  devolver?: boolean;
}

export const mov = (o: MovimientoMock = {}): MovimientoMock => ({
  id: 'm-1',
  fecha: hoyART(),
  monto: -1500,
  categoria: 'insumos',
  origen: 'manual',
  nota: 'Tinta para la impresora',
  grupo_id: null,
  cuenta: { id: 'c-banco-tami', nombre: 'Banco Tami', tipo: 'banco', titular: 'Tami' },
  creado_por: 'Facu Cardenas',
  anulado: false,
  es_anulacion: false,
  puede_anular: true,
  puede_corregir: true,
  ...o,
});

export interface Capturas {
  movimientos: CuerpoMovimiento[];
  correcciones: { id: string; body: CuerpoMovimiento }[];
  transferencias: { cuenta_origen_id: string; cuenta_destino_id: string; monto: number; clave_cliente: string }[];
  arqueos: { body: { cuenta_id: string; contado: number; clave_cliente: string }; dryRun: boolean }[];
  setups: unknown[];
  anulaciones: string[];
  listados: string[]; // URLs de GET /caja/movimientos
  /** POST /caja/sincronizar: si la pantalla lo pidió forzado (botón "Actualizar" / cambio de cuenta). */
  sincronizaciones: { forzar: boolean; cuerpo: string | null }[];
  cuentasActualizadas: { id: string; body: Record<string, unknown> }[];
}

export interface OpcionesCaja {
  configurada?: boolean;
  movimientos?: MovimientoMock[];
  /** Estados HTTP sucesivos para POST /caja/movimientos (el último se repite). Ej: [500, 201]. */
  estadosPostMovimiento?: number[];
  /** Segunda página del listado: se devuelve cuando llega `cursor`. */
  paginaSiguiente?: MovimientoMock[];
  /** Resultado del arqueo (dry run y confirmación). */
  arqueo?: { saldo_sistema: number; contado: number; diferencia: number; resultado: 'justo' | 'faltan' | 'sobran' };
  /** Plata de Mercado Pago ya en la cuenta pero todavía "a liberar". */
  aLiberar?: number;
  /** Resultado de POST /caja/sincronizar (por defecto: nada nuevo, nada sin cuenta). */
  sync?: { creados?: number; sin_cuenta?: { pago_id: string; orden_id: string; proveedor: string; monto: number; pagado_en: string }[] };
}

export async function mockCaja(page: Page, opts: OpcionesCaja = {}): Promise<Capturas> {
  const cap: Capturas = { movimientos: [], correcciones: [], transferencias: [], arqueos: [], setups: [], anulaciones: [], listados: [], sincronizaciones: [], cuentasActualizadas: [] };
  let configurada = opts.configurada ?? true;
  let intentosPost = 0;
  const lista = opts.movimientos ?? [mov()];

  const saldos = () => {
    const aLiberar = opts.aLiberar ?? 0;
    const cuentas = (configurada ? CUENTAS : []).map((c) => (c.tipo === 'mercadopago' ? { ...c, saldo: c.saldo + aLiberar, a_liberar: aLiberar } : c));
    const total = cuentas.filter((c) => c.es_del_negocio).reduce((a, c) => a + c.saldo, 0);
    return {
      configurada,
      cuentas,
      total_negocio: total,
      a_liberar_total: aLiberar,
      total_disponible: total - aLiberar,
      socios: cuentas
        .filter((c) => c.tipo === 'bolsillo')
        .map((c) => ({ cuenta_id: c.id, titular: c.titular, saldo: c.saldo, le_debemos: c.saldo < 0 ? -c.saldo : 0, tiene_del_negocio: c.saldo > 0 ? c.saldo : 0 })),
    };
  };

  await page.route(/\/api\/v1\/usuarios\?/, (route) =>
    route.fulfill({ json: { items: [{ nombre: 'Tami' }, { nombre: 'Facu' }], total: 2, page: 1, limit: 20 } }),
  );

  await page.route('**/api/v1/caja/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname.replace('/api/v1/caja', '');
    const metodo = req.method();
    const cuerpo = () => { try { return req.postDataJSON(); } catch { return null; } };

    if (ruta === '/saldos') return route.fulfill({ json: saldos() });
    if (ruta === '/cuentas' && metodo === 'GET') return route.fulfill({ json: configurada ? CUENTAS.map((c) => { const { saldo, a_liberar, ...resto } = c; void saldo; void a_liberar; return resto; }) : [] });

    if (ruta === '/movimientos' && metodo === 'GET') {
      cap.listados.push(req.url());
      if (url.searchParams.get('cursor') && opts.paginaSiguiente) return route.fulfill({ json: { items: opts.paginaSiguiente, next_cursor: null } });
      return route.fulfill({ json: { items: lista, next_cursor: opts.paginaSiguiente ? 'cursor-2' : null } });
    }

    if (ruta === '/movimientos' && metodo === 'POST') {
      const estados = opts.estadosPostMovimiento ?? [201];
      const estado = estados[Math.min(intentosPost, estados.length - 1)];
      intentosPost++;
      cap.movimientos.push(cuerpo());
      if (estado >= 400) return route.fulfill({ status: estado, json: { message: 'Error de prueba' } });
      return route.fulfill({ status: 201, json: { movimientos: [mov()], repetido: false } });
    }

    if (/^\/movimientos\/[^/]+$/.test(ruta) && metodo === 'PUT') {
      cap.correcciones.push({ id: ruta.split('/')[2], body: cuerpo() });
      return route.fulfill({ status: 200, json: { movimientos: [mov()], repetido: false } });
    }

    if (/^\/movimientos\/[^/]+\/anular$/.test(ruta) && metodo === 'POST') {
      cap.anulaciones.push(ruta.split('/')[2]);
      return route.fulfill({ status: 201, json: { movimientos: [] } });
    }

    if (ruta === '/transferencias' && metodo === 'POST') {
      cap.transferencias.push(cuerpo());
      return route.fulfill({ status: 201, json: { movimientos: [mov(), mov({ id: 'm-2', monto: 1 })], repetido: false } });
    }

    if (ruta === '/arqueo' && metodo === 'POST') {
      const dryRun = url.searchParams.get('dry_run') === 'true';
      cap.arqueos.push({ body: cuerpo(), dryRun });
      const r = opts.arqueo ?? { saldo_sistema: 5000, contado: 4980, diferencia: -20, resultado: 'faltan' as const };
      return route.fulfill({
        status: 201,
        json: { cuenta_id: 'c-efectivo', ...r, movimiento: dryRun || r.resultado === 'justo' ? null : mov({ monto: r.diferencia, categoria: 'ajuste_caja' }), repetido: false },
      });
    }

    if (ruta === '/sincronizar' && metodo === 'POST') {
      cap.sincronizaciones.push({ forzar: url.searchParams.get('forzar') === 'true', cuerpo: req.postData() });
      const sinCuenta = opts.sync?.sin_cuenta ?? [];
      return route.fulfill({
        status: 201,
        json: {
          ejecutado_en: new Date().toISOString(),
          revisados: 3,
          creados: opts.sync?.creados ?? 0,
          ya_estaban: 0,
          saltados: { prueba: 0, sin_cuenta: sinCuenta.length, antes_de_inicio: 0, sin_monto: 0 },
          sin_cuenta: sinCuenta,
        },
      });
    }

    if (/^\/cuentas\/[^/]+$/.test(ruta) && metodo === 'PUT') {
      cap.cuentasActualizadas.push({ id: ruta.split('/')[2], body: cuerpo() });
      const c = CUENTAS.find((x) => x.id === ruta.split('/')[2]);
      return route.fulfill({ status: 200, json: c ?? {} });
    }

    if (ruta === '/setup' && metodo === 'POST') {
      cap.setups.push(cuerpo());
      configurada = true; // el refetch de /saldos ya ve la caja armada
      return route.fulfill({ status: 201, json: [] });
    }

    return route.fulfill({ status: 404, json: { message: `Sin mock para ${metodo} ${ruta}` } });
  });

  return cap;
}

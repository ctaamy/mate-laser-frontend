// Módulo Caja del admin: tipos, constantes y formateadores.
// Las listas de tipos/categorías se espejan a mano del backend
// (mate-laser-backend/src/common/caja.ts) — mismo patrón que
// CANALES_VENTA_MANUAL. Si cambia una lista, cambiarla en los dos lados.

export type TipoCuenta = 'efectivo' | 'banco' | 'mercadopago' | 'bolsillo';

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = {
  efectivo: 'Efectivo',
  banco: 'Banco',
  mercadopago: 'Mercado Pago',
  bolsillo: 'Bolsillo',
};

// Chips de "+ Gasto": las 7 del ux-reviewer. `reembolso` y `contracargo` existen
// en el backend: los reembolsos totales los anota solo el sincronizador de cobros;
// los parciales y los contracargos siguen siendo manuales y viven en "Otros".
export const CATEGORIAS_GASTO_CHIPS = [
  { value: 'insumos', label: 'Insumos' },
  { value: 'envios', label: 'Envíos' },
  { value: 'publicidad', label: 'Publicidad' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'retiro_socio', label: 'Retiro mío' },
  { value: 'otros_gastos', label: 'Otros' },
] as const;

export const CATEGORIAS_INGRESO_CHIPS = [
  { value: 'aporte_socio', label: 'Aporte de socio' },
  { value: 'otros_ingresos', label: 'Otros ingresos' },
] as const;

// Todas las categorías que puede mostrar un movimiento, incluidas las que
// escribe el sistema (no se ofrecen a mano).
export const CATEGORIA_LABEL: Record<string, string> = {
  insumos: 'Insumos',
  envios: 'Envíos',
  publicidad: 'Publicidad',
  impuestos: 'Impuestos',
  servicios: 'Servicios',
  retiro_socio: 'Retiro mío',
  reembolso: 'Reembolso',
  contracargo: 'Contracargo',
  otros_gastos: 'Otros gastos',
  aporte_socio: 'Aporte de socio',
  otros_ingresos: 'Otros ingresos',
  transferencia: 'Entre cuentas',
  ajuste_caja: 'Diferencia al contar',
  ventas: 'Ventas',
  comision_mp: 'Comisión de Mercado Pago',
};

/** Qué cobros recibe una cuenta por defecto (una sola cuenta activa por cada uno). */
export type RecibeCuenta = 'transferencias_web' | 'efectivo_ventas';

export const RECIBE_LABEL: Record<RecibeCuenta, string> = {
  transferencias_web: 'Las transferencias de la web',
  efectivo_ventas: 'El efectivo de las ventas',
};

export interface CuentaCaja {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  titular: string | null;
  alias: string | null;
  recibe: RecibeCuenta | null;
  es_del_negocio: boolean;
  saldo_inicial: number;
  fecha_inicio: string;
  orden: number;
  archivada: boolean;
}

export interface CuentaConSaldo extends CuentaCaja {
  saldo: number;
  /** Plata de Mercado Pago ya en la cuenta pero que MP todavía no libera (incluida en `saldo`). */
  a_liberar: number;
}

export interface SocioSaldo {
  cuenta_id: string;
  titular: string | null;
  saldo: number;
  le_debemos: number;
  tiene_del_negocio: number;
}

export interface SaldosCaja {
  configurada: boolean;
  cuentas: CuentaConSaldo[];
  /** Todo lo que hay en las cuentas del negocio, incluido lo que MP todavía no libera. */
  total_negocio: number;
  a_liberar_total: number;
  /** `total_negocio` − `a_liberar_total`: lo que se puede usar hoy. */
  total_disponible: number;
  socios: SocioSaldo[];
}

/** Resultado de POST /caja/sincronizar: qué pasó al pasar los cobros a la caja. */
export interface ResumenSync {
  ejecutado_en: string;
  revisados: number;
  creados: number;
  ya_estaban: number;
  saltados: { prueba: number; sin_cuenta: number; antes_de_inicio: number; sin_monto: number };
  sin_cuenta: { pago_id: string; orden_id: string; proveedor: string; monto: number; pagado_en: string }[];
}

// Mismo criterio que validarCuentaParaCobro del backend (common/caja-cobro.ts).
const TIPOS_POR_METODO: Record<string, readonly TipoCuenta[]> = {
  efectivo: ['efectivo'],
  transferencia: ['banco', 'mercadopago'],
  otro: ['efectivo', 'banco', 'mercadopago'],
};

/** Cuentas del negocio (activas, sin bolsillos) donde puede entrar un cobro por ese método. */
export function cuentasParaMetodo<T extends { tipo: TipoCuenta; archivada: boolean }>(cuentas: T[], metodoPago: string): T[] {
  const tipos = TIPOS_POR_METODO[metodoPago] ?? [];
  return cuentas.filter((c) => !c.archivada && tipos.includes(c.tipo));
}

export interface MovimientoCaja {
  id: string;
  fecha: string;
  monto: number;
  categoria: string;
  origen: 'manual' | 'automatico';
  nota: string | null;
  grupo_id: string | null;
  cuenta: { id: string; nombre: string; tipo: TipoCuenta; titular: string | null } | null;
  creado_por: string | null;
  anulado: boolean;
  es_anulacion: boolean;
  puede_anular: boolean;
  puede_corregir: boolean;
}

export interface ListaMovimientos {
  items: MovimientoCaja[];
  next_cursor: string | null;
}

export interface ResultadoArqueo {
  cuenta_id: string;
  saldo_sistema: number;
  contado: number;
  diferencia: number;
  resultado: 'justo' | 'faltan' | 'sobran';
  movimiento: MovimientoCaja | null;
  repetido: boolean;
}

// ── dinero ──────────────────────────────────────────────────────────────────

/** "$ 1.500" / "$ 1.500,50": sin decimales si es un número entero. */
export function formatearMonto(n: number): string {
  const abs = Math.abs(n);
  const cuerpo = abs.toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}$${cuerpo}`;
}

/** Con signo explícito para las listas: "+$1.500" / "−$1.500". */
export function formatearMontoConSigno(n: number): string {
  return n > 0 ? `+${formatearMonto(n)}` : formatearMonto(n);
}

/**
 * Lo que escribe una persona → número. Acepta "1.500,50" (es-AR), "1500,5",
 * "1500.5" y "$ 1.500". "1.500" es mil quinientos (punto de miles), no 1,5.
 * Devuelve NaN si no se entiende.
 */
export function parsearMonto(texto: string): number {
  const s = texto.replace(/\$/g, '').replace(/\s/g, '');
  if (s === '') return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d+(,\d{1,2})?$/.test(s)) return Number(s.replace(',', '.'));
  if (/^\d+\.\d{1,2}$/.test(s)) return Number(s);
  return NaN;
}

// ── fechas ──────────────────────────────────────────────────────────────────

const formatoFechaART = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' de hoy en hora argentina (no la del navegador). */
export function hoyART(): string {
  return formatoFechaART.format(new Date());
}

/** '2026-09-24' → 'hoy' / 'ayer' / '24/09/2026'. */
export function fechaLegible(fecha: string): string {
  const hoy = hoyART();
  if (fecha === hoy) return 'Hoy';
  const ayer = new Date(`${hoy}T12:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (fecha === ayer.toISOString().slice(0, 10)) return 'Ayer';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

// ── idempotencia ────────────────────────────────────────────────────────────

/**
 * UUID v4 para la clave de idempotencia (`clave_cliente`). `crypto.randomUUID`
 * solo existe en contextos seguros (https / localhost): probando desde el celu
 * por la IP de la LAN no está, así que se arma con getRandomValues.
 */
export function nuevaClave(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── errores ─────────────────────────────────────────────────────────────────

/** Mensaje legible de un error de axios del backend (string o lista de validaciones). */
export function mensajeError(e: unknown, porDefecto = 'No se pudo completar la operación. Probá de nuevo.'): string {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  return msg || porDefecto;
}

// ── cuentas usadas hace poco ────────────────────────────────────────────────

const KEY_RECIENTES = 'mls_caja_cuentas_recientes_v1';

/** Las últimas 3 cuentas usadas (ids), la más reciente primero. Solo comodidad: si falla el storage, no pasa nada. */
export function leerCuentasRecientes(): string[] {
  try {
    const crudo = window.localStorage.getItem(KEY_RECIENTES);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string').slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function marcarCuentaReciente(id: string): void {
  try {
    const nueva = [id, ...leerCuentasRecientes().filter((x) => x !== id)].slice(0, 3);
    window.localStorage.setItem(KEY_RECIENTES, JSON.stringify(nueva));
  } catch {
    /* sin storage: se pierde solo el orden de comodidad */
  }
}

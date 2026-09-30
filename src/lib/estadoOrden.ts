// Pago y avance del pedido, vistos por separado en el admin. El backend
// (mate-laser-backend/src/common/estados-orden.ts) es la fuente de verdad: manda
// `estado_pago`/`monto_cobrado`/`saldo` (`resumenPago`) y valida los cambios de
// estado. Esto espeja sus listas y decide qué texto mostrar.
//
// La línea del pedido: pagado → en_diseno → diseno_listo → esperando_aprobacion →
// en_preparacion → listo_para_retirar | listo_para_enviar → enviado → entregado.

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado';

// Estados posteriores al pago aprobado (espejo de ESTADOS_POST_PAGO del backend,
// que sale de CLASE_ESTADO en common/estados-orden.ts).
export const ESTADOS_POST_PAGO = [
  'sin_preparar',
  'pagado',
  'en_diseno',
  'diseno_listo',
  'esperando_aprobacion',
  'en_preparacion',
  'listo_para_retirar',
  'listo_para_enviar',
  'enviado',
  'entregado',
];

export function esEstadoPostPago(estado: string): boolean {
  return ESTADOS_POST_PAGO.includes(estado);
}

interface OrdenPago {
  estado: string;
  total: number | string;
  estado_pago?: EstadoPago | null;
  saldo?: number;
  pagos?: { estado: string; monto: number | string }[];
}

/** Estado de pago de una orden; null si está cancelada o rechazada. */
export function estadoPagoDe(orden: OrdenPago): EstadoPago | null {
  if (orden.estado_pago !== undefined) return orden.estado_pago;
  if (orden.estado === 'cancelado' || orden.estado === 'rechazado') return null;
  if (orden.estado === 'pago_parcial') return 'parcial';
  return esEstadoPostPago(orden.estado) ? 'pagado' : 'pendiente';
}

/** Lo que falta cobrar de una orden (0 si está saldada o cancelada). */
export function saldoDe(orden: OrdenPago): number {
  if (typeof orden.saldo === 'number') return orden.saldo;
  const cobrado = (orden.pagos ?? []).filter((p) => p.estado === 'aprobado').reduce((acc, p) => acc + Number(p.monto), 0);
  return Math.max(0, Number(orden.total) - cobrado);
}

// Una venta manual nace 'sin_preparar'; las ventas manuales VIEJAS todavía pueden estar en
// 'pendiente_pago' / 'pago_parcial' / 'pagado' (el cobro dentro del estado), y 'pagado' es el paso
// inicial de una orden web ya paga. Todos quieren decir "todavía no se empezó a diseñar ni a
// preparar": esa es la información que va en la columna Pedido (el cobro ya tiene la suya).
const SIN_EMPEZAR = ['sin_preparar', 'pendiente_pago', 'pago_parcial', 'pagado'];

/** Clave (de EstadoBadge) del avance del pedido. */
export function estadoPedidoVisible(estado: string): string {
  return SIN_EMPEZAR.includes(estado) ? 'sin_empezar' : estado;
}

// ── Rótulos ────────────────────────────────────────────────────────────────

/** Rótulo para el admin (con tilde y mayúscula inicial). "Sin empezar" es el paso previo al diseño/preparación. */
export const ETIQUETA_ADMIN: Record<string, string> = {
  pendiente: 'Pendiente',
  reservado: 'Reservado',
  esperando_confirmacion: 'Esperando confirmación de pago',
  pendiente_pago: 'Sin cobrar',
  pago_parcial: 'Pago parcial',
  pagado: 'Pagado',
  sin_preparar: 'Sin empezar',
  sin_empezar: 'Sin empezar',
  en_diseno: 'En diseño',
  diseno_listo: 'Diseño listo',
  esperando_aprobacion: 'Esperando OK del cliente',
  en_preparacion: 'En preparación',
  listo_para_retirar: 'Listo para retirar',
  listo_para_enviar: 'Listo para enviar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
};

/** Texto para el cliente en Mi cuenta: lo que le importa, no el paso interno. */
export const ETIQUETA_CLIENTE: Record<string, string> = {
  pendiente: 'Pendiente de pago',
  reservado: 'Reservado',
  esperando_confirmacion: 'Esperando confirmación del pago',
  pagado: 'Recibimos tu pedido',
  en_diseno: 'Diseñando tu grabado',
  diseno_listo: 'Diseñando tu grabado',
  esperando_aprobacion: 'Necesitamos tu OK',
  en_preparacion: 'Preparando tu pedido',
  listo_para_retirar: 'Listo para retirar',
  listo_para_enviar: 'Preparado para enviar',
  enviado: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
};

/** Si no hay rótulo (estado desconocido de un backend más nuevo), al menos legible: "en_algo" → "En algo". */
export function etiquetaLegible(clave: string): string {
  const t = clave.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function etiquetaAdmin(clave: string): string {
  return ETIQUETA_ADMIN[clave] ?? etiquetaLegible(clave);
}

export function etiquetaCliente(clave: string): string {
  return ETIQUETA_CLIENTE[clave] ?? etiquetaLegible(clave);
}

// ── Select de estado del pedido (Gestionar) ───────────────────────────────

/**
 * Estados que el admin puede elegir a mano, agrupados. NO están los de cobro ni los de
 * espera de pago ('pendiente', 'reservado', 'esperando_confirmacion', 'pendiente_pago',
 * 'pago_parcial'): los mueven el cobro, el webhook y el cron. Solo se muestran si es
 * el estado actual de la orden (para no dejar el select en blanco).
 */
//
// El paso inicial depende del tipo de orden: una venta MANUAL arranca 'sin_preparar' (el cobro no
// está en el estado); una orden WEB ya paga arranca 'pagado'.
export function gruposEstadoPedido(canal?: string | null): { grupo: string; estados: string[] }[] {
  const inicial = canal === 'admin_manual' ? 'sin_preparar' : 'pagado';
  return [
    { grupo: 'Diseño', estados: ['en_diseno', 'diseno_listo', 'esperando_aprobacion'] },
    { grupo: 'Producción', estados: [inicial, 'en_preparacion'] },
    { grupo: 'Entrega', estados: ['listo_para_retirar', 'listo_para_enviar', 'enviado', 'entregado'] },
    { grupo: 'Cerrar', estados: ['cancelado'] },
  ];
}

/** Estados de cobro / espera de pago que no se eligen a mano; se ofrecen solo si son el estado actual. */
export function estadoActualFueraDelSelect(estadoActual: string, canal?: string | null): string | null {
  const elegibles = new Set(gruposEstadoPedido(canal).flatMap((g) => g.estados));
  return estadoActual && !elegibles.has(estadoActual) ? estadoActual : null;
}

/** En el select el paso inicial de una orden web se llama "Sin empezar (pagado)": paga, todavía sin diseño ni preparación. */
export function etiquetaOpcionEstado(estado: string): string {
  return estado === 'pagado' ? 'Sin empezar (pagado)' : etiquetaAdmin(estado);
}

// Estados cuya transición dispara un mail al cliente (ver OrdenesService.update).
const ESTADOS_CON_MAIL = ['enviado', 'listo_para_retirar'];

/** Texto del confirm() al cambiar el estado. Solo se pregunta si el estado cambió. */
export function textoConfirmarCambio(
  nuevoEstado: string,
  orden: { canal?: string | null },
): string {
  const partes = [`¿Confirmás el cambio de estado a "${etiquetaAdmin(nuevoEstado)}"?`];
  // Las ventas manuales no tienen cuenta de cliente: nadie ve el estado ni recibe mails automáticos.
  if (orden.canal !== 'admin_manual') {
    partes.push('El cliente puede ver este estado desde su cuenta.');
    if (ESTADOS_CON_MAIL.includes(nuevoEstado)) partes.push('Se le manda un mail avisándole.');
  }
  return partes.join(' ');
}

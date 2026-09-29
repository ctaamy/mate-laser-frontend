// Pago y avance del pedido, vistos por separado en el admin. El backend
// (mate-laser-backend/src/common/estados-orden.ts, `resumenPago`) es la fuente
// de verdad y manda `estado_pago`/`monto_cobrado`/`saldo`; esto solo cubre a un
// backend viejo y decide qué mostrar en la columna "Pedido".

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado';

// Estados posteriores al pago aprobado (espejo de ESTADOS_POST_PAGO del backend).
const POST_PAGO = ['pagado', 'en_preparacion', 'listo_para_retirar', 'enviado', 'entregado'];

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
  return POST_PAGO.includes(orden.estado) ? 'pagado' : 'pendiente';
}

/** Lo que falta cobrar de una orden (0 si está saldada o cancelada). */
export function saldoDe(orden: OrdenPago): number {
  if (typeof orden.saldo === 'number') return orden.saldo;
  const cobrado = (orden.pagos ?? []).filter((p) => p.estado === 'aprobado').reduce((acc, p) => acc + Number(p.monto), 0);
  return Math.max(0, Number(orden.total) - cobrado);
}

// Mientras el backend siga guardando el pago dentro de `estado` en las ventas
// manuales, 'pendiente_pago' / 'pago_parcial' / 'pagado' quieren decir "todavía
// no se empezó a preparar": esa es la información que va en la columna Pedido
// (el pago ya tiene la suya).
const SIN_PREPARAR = ['pendiente_pago', 'pago_parcial', 'pagado'];

/** Etiqueta (clave de EstadoBadge) del avance del pedido. */
export function estadoPedidoVisible(estado: string): string {
  return SIN_PREPARAR.includes(estado) ? 'sin_preparar' : estado;
}

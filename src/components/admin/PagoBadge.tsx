import type { EstadoPago } from '../../lib/estadoOrden';

const COLOR: Record<EstadoPago, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  parcial: 'bg-amber-100 text-amber-700',
  pagado: 'bg-[#E1F5EE] text-[#0F6E56]',
};

const TEXTO: Record<EstadoPago, string> = {
  pendiente: 'sin cobrar',
  parcial: 'pago parcial',
  pagado: 'pagado',
};

/** Cuánto se cobró de una orden. Independiente de en qué va el pedido. Sin estado (cancelada) no muestra nada. */
export default function PagoBadge({ estadoPago }: { estadoPago: EstadoPago | null }) {
  if (!estadoPago) return <span className="text-xs text-[var(--ink-soft)]">—</span>;
  return (
    <span data-testid="badge-pago" className={`text-xs px-2 py-1 rounded-full font-medium ${COLOR[estadoPago]}`}>
      {TEXTO[estadoPago]}
    </span>
  );
}

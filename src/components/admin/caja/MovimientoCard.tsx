import { useState } from 'react';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import { ErrorBanner } from './campos';
import {
  CATEGORIA_LABEL,
  fechaLegible,
  formatearMontoConSigno,
  mensajeError,
  type MovimientoCaja,
} from '../../../lib/caja';

interface Props {
  m: MovimientoCaja;
  onCorregir: (m: MovimientoCaja) => void;
  onAnular: (m: MovimientoCaja) => Promise<void>;
}

/**
 * Un movimiento como tarjeta (no como fila de tabla: en el celu una tabla de 5
 * columnas no entra). El signo, la palabra "Entró"/"Salió" y el color dicen lo
 * mismo — el color solo no alcanza. Las salidas van en tinta, no en rojo: un
 * gasto no es un error.
 */
export default function MovimientoCard({ m, onCorregir, onAnular }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrada = m.monto > 0;
  const titulo = CATEGORIA_LABEL[m.categoria] ?? m.categoria;
  const colorMonto = m.anulado ? 'text-[var(--ink-soft)] line-through' : entrada ? 'text-[var(--ok)]' : 'text-[var(--ink)]';

  const anular = async () => {
    setError(null);
    setAnulando(true);
    try {
      await onAnular(m);
      setConfirmando(false);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setAnulando(false);
    }
  };

  return (
    <AdminCard padded={false} className="p-4" data-testid="movimiento-caja">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-sm font-medium ${m.anulado ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}`}>{titulo}</div>
          {m.nota && <p className="mt-0.5 break-words text-sm text-[var(--ink-soft)]">{m.nota}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--ink-soft)]">
            {m.cuenta && <span>{m.cuenta.nombre}</span>}
            <span>{fechaLegible(m.fecha)}</span>
            {m.creado_por && <span>Cargó {m.creado_por}</span>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={`text-base font-semibold tabular-nums ${colorMonto}`}>{formatearMontoConSigno(m.monto)}</div>
          <div className="text-xs text-[var(--ink-soft)]">{entrada ? 'Entró' : 'Salió'}</div>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {m.anulado && <Etiqueta>Anulado</Etiqueta>}
            {m.origen === 'automatico' && <Etiqueta>Automático</Etiqueta>}
          </div>
        </div>
      </div>

      {(m.puede_corregir || m.puede_anular) && !confirmando && (
        <div className="mt-3 flex gap-2">
          {m.puede_corregir && (
            <AdminButton size="sm" variant="ghost" onClick={() => onCorregir(m)}>
              Corregir
            </AdminButton>
          )}
          {m.puede_anular && (
            <AdminButton size="sm" variant="ghost" onClick={() => setConfirmando(true)}>
              Anular
            </AdminButton>
          )}
        </div>
      )}

      {confirmando && (
        <div className="mt-3 rounded-[var(--radius-el)] bg-[var(--n-50)] p-3">
          <p className="text-sm text-[var(--ink)]">
            ¿Anular este movimiento? Queda tachado y el saldo vuelve a como estaba.
            {m.grupo_id && ' Se anulan las dos partes.'}
          </p>
          {error && <div className="mt-2"><ErrorBanner>{error}</ErrorBanner></div>}
          <div className="mt-3 flex gap-2">
            <AdminButton size="sm" variant="primary" disabled={anulando} onClick={anular}>
              {anulando ? 'Anulando…' : 'Sí, anular'}
            </AdminButton>
            <AdminButton size="sm" variant="secondary" disabled={anulando} onClick={() => { setConfirmando(false); setError(null); }}>
              No
            </AdminButton>
          </div>
        </div>
      )}
    </AdminCard>
  );
}

function Etiqueta({ children }: { children: string }) {
  return <span className="rounded-full bg-[var(--n-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">{children}</span>;
}

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import AdminButton from '../../../components/admin/ui/AdminButton';
import { AdminSelect } from '../../../components/admin/ui/AdminInput';
import MovimientoCard from '../../../components/admin/caja/MovimientoCard';
import NuevoMovimientoSheet from '../../../components/admin/caja/NuevoMovimientoSheet';
import { useCajaMutaciones, useMovimientos, type FiltrosMovimientos } from '../../../hooks/useCaja';
import { CATEGORIA_LABEL, type MovimientoCaja } from '../../../lib/caja';
import type { CajaContext } from './CajaLayout';

const TIPOS: { value: '' | 'entrada' | 'salida'; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida', label: 'Salidas' },
];

export default function CajaMovimientos() {
  const { saldos, avisar } = useOutletContext<CajaContext>();
  const [cuentaId, setCuentaId] = useState('');
  const [tipo, setTipo] = useState<'' | 'entrada' | 'salida'>('');
  const [categoria, setCategoria] = useState('');
  const [corrigiendo, setCorrigiendo] = useState<MovimientoCaja | null>(null);
  const { anularMovimiento } = useCajaMutaciones();

  const filtros: FiltrosMovimientos = {
    ...(cuentaId && { cuenta_id: cuentaId }),
    ...(tipo && { tipo }),
    ...(categoria && { categoria }),
  };
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useMovimientos(filtros);
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const hayFiltros = !!(cuentaId || tipo || categoria);
  const cuentas = saldos?.cuentas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="group" aria-label="Tipo de movimiento" className="flex w-fit gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">
          {TIPOS.map((t) => (
            <button
              key={t.value || 'todos'}
              type="button"
              aria-pressed={tipo === t.value}
              onClick={() => setTipo(t.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tipo === t.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <AdminSelect fullWidth={false} aria-label="Filtrar por cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </AdminSelect>
          <AdminSelect fullWidth={false} aria-label="Filtrar por categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIA_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </AdminSelect>
        </div>
      </div>

      {isLoading ? (
        <div className="flex animate-pulse flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-[var(--radius-card)] bg-[var(--n-100)]" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-[var(--error)]/20 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
          <AlertCircle size={15} className="shrink-0" />
          No pudimos cargar los movimientos. Probá recargar la página.
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--ink-soft)]">
          {hayFiltros
            ? 'No hay movimientos con esos filtros.'
            : 'Todavía no hay movimientos. Cuando cargues un gasto o un ingreso, aparece acá.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <MovimientoCard
              key={m.id}
              m={m}
              onCorregir={setCorrigiendo}
              onAnular={async (mov) => {
                await anularMovimiento.mutateAsync(mov.id);
                avisar('Movimiento anulado');
              }}
            />
          ))}
          {hasNextPage && (
            <AdminButton variant="secondary" className="self-center" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </AdminButton>
          )}
        </div>
      )}

      {corrigiendo && (
        <NuevoMovimientoSheet
          tipo={corrigiendo.monto < 0 ? 'gasto' : 'ingreso'}
          cuentas={cuentas}
          movimiento={corrigiendo}
          onClose={() => setCorrigiendo(null)}
          onGuardado={avisar}
        />
      )}
    </div>
  );
}

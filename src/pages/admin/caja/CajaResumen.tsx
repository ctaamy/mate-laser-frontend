import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertCircle, ArrowRightLeft, HandCoins, Settings2, TrendingDown, TrendingUp } from 'lucide-react';
import AdminCard from '../../../components/admin/ui/AdminCard';
import AdminButton from '../../../components/admin/ui/AdminButton';
import MovimientoCard from '../../../components/admin/caja/MovimientoCard';
import SetupCaja from '../../../components/admin/caja/SetupCaja';
import { useMovimientos } from '../../../hooks/useCaja';
import { TIPO_CUENTA_LABEL, formatearMonto, type CuentaConSaldo } from '../../../lib/caja';
import type { CajaContext } from './CajaLayout';

// En 360 px son 2 por fila: con el texto de tamaño normal "Contar la caja" se parte en dos líneas.
const ACCION = 'whitespace-nowrap px-2 text-[13px] sm:px-4 sm:text-sm';

/** Cuentas del negocio agrupadas por titular (Tami, Facu, Negocio…), con subtotal. */
function agruparPorTitular(cuentas: CuentaConSaldo[]) {
  const grupos = new Map<string, CuentaConSaldo[]>();
  for (const c of cuentas) {
    const clave = c.titular?.trim() || 'Sin titular';
    grupos.set(clave, [...(grupos.get(clave) ?? []), c]);
  }
  return [...grupos.entries()].map(([titular, items]) => ({
    titular,
    cuentas: items,
    subtotal: items.reduce((acc, c) => acc + Math.round(c.saldo * 100), 0) / 100,
  }));
}

/** Aclaración de una cuenta solo si el nombre no lo dice ya ("Banco Tami" no necesita "Banco a nombre de Tami"). */
function aclaracion(c: CuentaConSaldo): string {
  const nombre = c.nombre.toLowerCase();
  const partes: string[] = [];
  if (!nombre.includes(TIPO_CUENTA_LABEL[c.tipo].toLowerCase())) partes.push(TIPO_CUENTA_LABEL[c.tipo]);
  if (c.titular && !nombre.includes(c.titular.toLowerCase())) partes.push(`a nombre de ${c.titular}`);
  return partes.join(', ');
}

function FilaSaldo({ cuenta, destacada = false }: { cuenta: CuentaConSaldo; destacada?: boolean }) {
  const detalle = aclaracion(cuenta);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className={`truncate text-sm text-[var(--ink)] ${destacada ? 'font-medium' : ''}`}>{cuenta.nombre}</div>
        {detalle && <div className="text-xs text-[var(--ink-soft)]">{detalle}</div>}
      </div>
      <div className={`shrink-0 text-sm tabular-nums text-[var(--ink)] ${destacada ? 'font-semibold' : ''}`}>{formatearMonto(cuenta.saldo)}</div>
    </div>
  );
}

export default function CajaResumen() {
  const { saldos, cargando, error, abrir } = useOutletContext<CajaContext>();
  const { data: ultimos } = useMovimientos({}, 5);
  // En el celu los grupos arrancan cerrados (una pantalla, sin scroll); en escritorio, abiertos.
  const [abiertos] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  if (cargando) {
    return (
      <div className="flex animate-pulse flex-col gap-4" aria-busy="true">
        <div className="h-32 rounded-[var(--radius-card)] bg-[var(--n-100)]" />
        <div className="h-24 rounded-[var(--radius-card)] bg-[var(--n-100)]" />
      </div>
    );
  }

  if (error || !saldos) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-[var(--error)]/20 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
        <AlertCircle size={15} className="shrink-0" />
        No pudimos cargar la caja. Probá recargar la página.
      </div>
    );
  }

  if (!saldos.configurada) return <SetupCaja />;

  const delNegocio = saldos.cuentas.filter((c) => c.es_del_negocio && !c.archivada);
  const grupos = agruparPorTitular(delNegocio);
  const debemos = saldos.socios.filter((s) => s.le_debemos > 0);
  const tienen = saldos.socios.filter((s) => s.tiene_del_negocio > 0);
  const items = ultimos?.pages[0]?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Un solo protagonista: la plata que hay. */}
      <AdminCard className="flex flex-col gap-4">
        <div>
          <div className="text-sm text-[var(--ink-soft)]">Plata disponible</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-[var(--ink)]" data-testid="total-negocio">
            {formatearMonto(saldos.total_negocio)}
          </div>
          <div className="mt-1 text-sm text-[var(--ink-soft)]">
            En {delNegocio.length} {delNegocio.length === 1 ? 'cuenta' : 'cuentas'}, sumando efectivo, bancos y Mercado Pago.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <AdminButton variant="primary" className={ACCION} icon={<TrendingDown size={15} />} onClick={() => abrir('gasto')}>Gasto</AdminButton>
          <AdminButton variant="secondary" className={ACCION} icon={<TrendingUp size={15} />} onClick={() => abrir('ingreso')}>Ingreso</AdminButton>
          <AdminButton variant="secondary" className={ACCION} icon={<ArrowRightLeft size={15} />} onClick={() => abrir('transferencia')}>Pasar plata</AdminButton>
          <AdminButton variant="secondary" className={ACCION} icon={<HandCoins size={15} />} onClick={() => abrir('arqueo')}>Contar la caja</AdminButton>
        </div>
      </AdminCard>

      {(debemos.length > 0 || tienen.length > 0) && (
        <div className="flex flex-col gap-2" data-testid="socios">
          {debemos.map((s) => (
            <p key={s.cuenta_id} className="rounded-[var(--radius-el)] border-l-4 border-[var(--warn)] bg-[var(--warn-soft)] px-4 py-3 text-sm text-[var(--warn)]">
              Le debemos a {s.titular ?? 'un socio'} <strong className="font-semibold">{formatearMonto(s.le_debemos)}</strong> por plata que puso de su bolsillo.
            </p>
          ))}
          {tienen.map((s) => (
            <p key={s.cuenta_id} className="rounded-[var(--radius-el)] border-l-4 border-[var(--n-300)] bg-[var(--n-100)] px-4 py-3 text-sm text-[var(--ink)]">
              {s.titular ?? 'Un socio'} tiene <strong className="font-semibold">{formatearMonto(s.tiene_del_negocio)}</strong> del negocio en su bolsillo.
            </p>
          ))}
        </div>
      )}

      <section aria-labelledby="cuentas-titulo" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="cuentas-titulo" className="text-sm font-medium text-[var(--ink)]">Cuentas</h2>
          <AdminButton size="sm" variant="ghost" icon={<Settings2 size={14} />} onClick={() => abrir('cuentas')}>Mis cuentas</AdminButton>
        </div>
        {grupos.map((g) =>
          g.cuentas.length === 1 ? (
            // Un titular con una sola cuenta: una fila, sin desplegable que repita el mismo monto.
            <AdminCard key={g.titular} padded={false} data-testid="grupo-titular">
              <FilaSaldo cuenta={g.cuentas[0]} destacada />
            </AdminCard>
          ) : (
            <AdminCard key={g.titular} padded={false} data-testid="grupo-titular">
              <details open={abiertos}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
                  <span className="text-sm font-medium text-[var(--ink)]">{g.titular}</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatearMonto(g.subtotal)}</span>
                </summary>
                <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {g.cuentas.map((c) => (
                    <li key={c.id}>
                      <FilaSaldo cuenta={c} />
                    </li>
                  ))}
                </ul>
              </details>
            </AdminCard>
          ),
        )}
      </section>

      <section aria-labelledby="ultimos-titulo" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="ultimos-titulo" className="text-sm font-medium text-[var(--ink)]">Últimos movimientos</h2>
          <Link to="/admin/caja/movimientos" className="text-sm text-[var(--accent)] hover:underline">Ver todos</Link>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">Todavía no cargaste ningún movimiento. Empezá con un gasto: es lo más rápido.</p>
        ) : (
          // Acá solo se mira; corregir y anular viven en la pestaña Movimientos.
          items.map((m) => (
            <MovimientoCard key={m.id} m={{ ...m, puede_anular: false, puede_corregir: false }} onCorregir={() => undefined} onAnular={async () => undefined} />
          ))
        )}
      </section>
    </div>
  );
}

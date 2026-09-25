import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AdminButton from '../../../components/admin/ui/AdminButton';
import NuevoMovimientoSheet from '../../../components/admin/caja/NuevoMovimientoSheet';
import TransferenciaSheet from '../../../components/admin/caja/TransferenciaSheet';
import ArqueoSheet from '../../../components/admin/caja/ArqueoSheet';
import CuentasSheet from '../../../components/admin/caja/CuentasSheet';
import { useSaldos } from '../../../hooks/useCaja';
import type { SaldosCaja } from '../../../lib/caja';

export type Hoja = 'gasto' | 'ingreso' | 'transferencia' | 'arqueo' | 'cuentas';
const HOJAS: readonly Hoja[] = ['gasto', 'ingreso', 'transferencia', 'arqueo', 'cuentas'];

/** Lo que las pantallas hijas reciben del hub (useOutletContext). */
export interface CajaContext {
  saldos: SaldosCaja | undefined;
  cargando: boolean;
  error: boolean;
  abrir: (hoja: Hoja) => void;
  avisar: (mensaje: string) => void;
}

const TABS = [
  { to: '/admin/caja', label: 'Resumen', end: true },
  { to: '/admin/caja/movimientos', label: 'Movimientos', end: false },
];

/**
 * Hub "Caja y compras": una sola tarjeta del admin que abre esta sección, con
 * sus submódulos adentro como pestañas. Las hojas de carga se abren con
 * `?nuevo=gasto` (etc.): el mismo mecanismo sirve para los botones y para un
 * acceso directo en la pantalla de inicio del celu.
 */
export default function AdminCajaLayout() {
  const [params, setParams] = useSearchParams();
  const { data: saldos, isLoading, isError } = useSaldos();
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const avisar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  const pedida = params.get('nuevo');
  const hoja = HOJAS.find((h) => h === pedida) ?? null;
  const configurada = !!saldos?.configurada;

  const abrir = useCallback(
    (h: Hoja) => setParams((p) => { const n = new URLSearchParams(p); n.set('nuevo', h); return n; }),
    [setParams],
  );
  const cerrar = useCallback(
    () => setParams((p) => { const n = new URLSearchParams(p); n.delete('nuevo'); return n; }, { replace: true }),
    [setParams],
  );

  const cuentas = saldos?.cuentas ?? [];
  const contexto: CajaContext = { saldos, cargando: isLoading, error: isError, abrir, avisar };

  return (
    <div className="flex flex-col gap-5 p-4 pb-24 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Caja y compras</h1>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">Cuánta plata hay, adónde va y de dónde viene.</p>
        </div>
        {/* El contenedor es el que se oculta: `hidden` no le gana al `inline-flex` propio de AdminButton. */}
        {configurada && (
          <div className="hidden md:block">
            <AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => abrir('gasto')}>
              Gasto
            </AdminButton>
          </div>
        )}
      </div>

      <nav aria-label="Secciones de caja" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {aviso && (
        <p role="status" className="rounded-[var(--radius-el)] bg-[var(--ok-soft)] px-4 py-2.5 text-sm text-[var(--ok)]">
          {aviso}
        </p>
      )}

      <Outlet context={contexto} />

      {configurada && (
        <button
          type="button"
          data-testid="fab-gasto"
          onClick={() => abrir('gasto')}
          className="fixed bottom-5 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-base font-medium text-white [box-shadow:var(--shadow-hover)] active:bg-[var(--accent-hover)] md:hidden"
        >
          <Plus size={20} /> Gasto
        </button>
      )}

      {configurada && hoja === 'gasto' && <NuevoMovimientoSheet tipo="gasto" cuentas={cuentas} onClose={cerrar} onGuardado={avisar} />}
      {configurada && hoja === 'ingreso' && <NuevoMovimientoSheet tipo="ingreso" cuentas={cuentas} onClose={cerrar} onGuardado={avisar} />}
      {configurada && hoja === 'transferencia' && <TransferenciaSheet cuentas={cuentas} onClose={cerrar} onGuardado={avisar} />}
      {configurada && hoja === 'arqueo' && <ArqueoSheet cuentas={cuentas} onClose={cerrar} onGuardado={avisar} />}
      {configurada && hoja === 'cuentas' && <CuentasSheet onClose={cerrar} onGuardado={avisar} />}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import api from '../../../lib/api';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import { AdminInput, AdminLabel, AdminSelect } from '../ui/AdminInput';
import { ErrorBanner, MontoInput } from './campos';
import { useCajaMutaciones } from '../../../hooks/useCaja';
import { formatearMonto, hoyART, mensajeError, parsearMonto } from '../../../lib/caja';

interface FilaCuentaSetup {
  clave: number;
  nombre: string;
  tipo: 'efectivo' | 'banco' | 'mercadopago';
  titular: string;
  saldo: string;
}

let contador = 0;
const fila = (nombre: string, tipo: FilaCuentaSetup['tipo']): FilaCuentaSetup => ({ clave: ++contador, nombre, tipo, titular: '', saldo: '' });

/**
 * Paso inicial, una sola vez: "¿Cuánta plata tenés hoy en cada cuenta?". Sin este
 * paso los saldos serían falsos desde el primer día. Los socios se precargan con
 * los admins del panel (los que van a cargar datos), editables.
 */
export default function SetupCaja() {
  const { setup } = useCajaMutaciones();
  const [fecha, setFecha] = useState(hoyART());
  const [cuentas, setCuentas] = useState<FilaCuentaSetup[]>(() => [fila('Efectivo', 'efectivo'), fila('Banco', 'banco'), fila('Mercado Pago', 'mercadopago')]);
  const [socios, setSocios] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: admins } = useQuery({
    queryKey: ['caja-setup-admins'],
    queryFn: () =>
      api.get('/usuarios', { params: { rol: 'admin', limit: 20 } }).then((r) => (r.data?.items ?? []) as { nombre?: string | null }[]),
  });
  // Hasta que la persona toque algo, los socios son los admins.
  const sociosActuales = socios ?? [...new Set((admins ?? []).map((a) => a.nombre?.trim()).filter((n): n is string => !!n))];

  const cambiar = (clave: number, cambios: Partial<FilaCuentaSetup>) =>
    setCuentas((cs) => cs.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)));

  const saldoDe = (c: FilaCuentaSetup) => (c.saldo.trim() === '' ? 0 : parsearMonto(c.saldo));
  const montosOk = cuentas.every((c) => !Number.isNaN(saldoDe(c)));
  const nombresOk = cuentas.length > 0 && cuentas.every((c) => c.nombre.trim());
  const mpOk = cuentas.filter((c) => c.tipo === 'mercadopago').length <= 1;
  const total = cuentas.reduce((acc, c) => acc + (Number.isNaN(saldoDe(c)) ? 0 : saldoDe(c)), 0);

  const empezar = async () => {
    setError(null);
    setOcupado(true);
    try {
      await setup.mutateAsync({
        fecha_inicio: fecha,
        cuentas: cuentas.map((c) => ({
          nombre: c.nombre.trim(),
          tipo: c.tipo,
          saldo_inicial: saldoDe(c),
          ...(c.titular.trim() ? { titular: c.titular.trim() } : {}),
        })),
        socios: sociosActuales.map((s) => s.trim()).filter(Boolean),
      });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <AdminCard className="flex flex-col gap-6" data-testid="setup-caja">
      <div>
        <h2 className="text-lg font-semibold text-[var(--ink)]">¿Cuánta plata tenés hoy en cada cuenta?</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Cargá lo que hay ahora en cada cuenta. Desde acá la caja va sumando y restando: sin este paso los saldos no coincidirían con la realidad.
        </p>
      </div>

      <div className="sm:max-w-xs">
        <AdminLabel htmlFor="setup-fecha">Contar desde</AdminLabel>
        <AdminInput id="setup-fecha" type="date" value={fecha} max={hoyART()} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <div className="flex flex-col gap-4">
        {cuentas.map((c) => (
          <div key={c.clave} className="flex flex-col gap-3 rounded-[var(--radius-el)] border border-[var(--line)] p-4" data-testid="setup-cuenta">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <AdminLabel htmlFor={`setup-nombre-${c.clave}`}>Nombre de la cuenta</AdminLabel>
                <AdminInput id={`setup-nombre-${c.clave}`} value={c.nombre} onChange={(e) => cambiar(c.clave, { nombre: e.target.value })} maxLength={100} />
              </div>
              {cuentas.length > 1 && (
                <button
                  type="button"
                  aria-label={`Sacar ${c.nombre || 'cuenta'}`}
                  onClick={() => setCuentas((cs) => cs.filter((x) => x.clave !== c.clave))}
                  className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--n-100)]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <AdminLabel htmlFor={`setup-tipo-${c.clave}`}>Tipo</AdminLabel>
                <AdminSelect id={`setup-tipo-${c.clave}`} value={c.tipo} onChange={(e) => cambiar(c.clave, { tipo: e.target.value as FilaCuentaSetup['tipo'] })}>
                  <option value="efectivo">Efectivo</option>
                  <option value="banco">Banco</option>
                  <option value="mercadopago">Mercado Pago</option>
                </AdminSelect>
              </div>
              <div>
                <AdminLabel htmlFor={`setup-titular-${c.clave}`}>A nombre de (opcional)</AdminLabel>
                <AdminInput id={`setup-titular-${c.clave}`} value={c.titular} onChange={(e) => cambiar(c.clave, { titular: e.target.value })} maxLength={100} placeholder="Ej: Tami" />
              </div>
            </div>
            <MontoInput id={`setup-saldo-${c.clave}`} label="Hay ahora" value={c.saldo} onChange={(v) => cambiar(c.clave, { saldo: v })} reservarEco={false} />
          </div>
        ))}
        <AdminButton variant="secondary" className="self-start" icon={<Plus size={15} />} onClick={() => setCuentas((cs) => [...cs, fila('', 'banco')])}>
          Agregar otra cuenta
        </AdminButton>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--ink)]">¿Quiénes son los socios?</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Cada uno tiene un “bolsillo” para anotar la plata propia que pone en el negocio, sin mezclarla con la caja.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="setup-socios">
          {sociosActuales.map((s) => (
            <li key={s} className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] py-1 pl-3 pr-1 text-sm text-[var(--ink)]">
              {s}
              <button
                type="button"
                aria-label={`Sacar a ${s}`}
                onClick={() => setSocios(sociosActuales.filter((x) => x !== s))}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--n-100)]"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <SumarSocio existentes={sociosActuales} onSumar={(n) => setSocios([...sociosActuales, n])} />
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        {!mpOk && <ErrorBanner>Solo puede haber una cuenta de Mercado Pago.</ErrorBanner>}
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="text-sm text-[var(--ink-soft)]">
          Total con el que arrancás: <strong className="font-semibold text-[var(--ink)]">{formatearMonto(total)}</strong>
        </p>
        <AdminButton variant="primary" className="w-full sm:w-auto sm:self-start" disabled={ocupado || !montosOk || !nombresOk || !mpOk} onClick={empezar}>
          {ocupado ? 'Guardando…' : 'Empezar'}
        </AdminButton>
      </div>
    </AdminCard>
  );
}

function SumarSocio({ existentes, onSumar }: { existentes: string[]; onSumar: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('');
  const limpio = nombre.trim();
  const repetido = existentes.some((s) => s.toLowerCase() === limpio.toLowerCase());
  const sumar = () => {
    if (!limpio || repetido) return;
    onSumar(limpio);
    setNombre('');
  };
  return (
    <div className="mt-3 flex max-w-sm gap-2">
      <AdminInput
        aria-label="Nombre del socio"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } }}
        maxLength={100}
        placeholder="Sumar un socio"
      />
      <AdminButton variant="secondary" disabled={!limpio || repetido} onClick={sumar}>Sumar</AdminButton>
    </div>
  );
}

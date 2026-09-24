import { useState } from 'react';
import AdminSheet from '../ui/AdminSheet';
import AdminButton from '../ui/AdminButton';
import { AdminInput, AdminLabel } from '../ui/AdminInput';
import { ChipGroup, ErrorBanner, MontoInput } from './campos';
import { useCajaMutaciones, useCuentas } from '../../../hooks/useCaja';
import {
  TIPO_CUENTA_LABEL,
  formatearMonto,
  hoyART,
  mensajeError,
  parsearMonto,
  type CuentaCaja,
  type TipoCuenta,
} from '../../../lib/caja';

interface Props {
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

const TIPOS_ALTA: { value: Exclude<TipoCuenta, 'bolsillo'>; label: string }[] = [
  { value: 'banco', label: 'Banco' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'mercadopago', label: 'Mercado Pago' },
];

/** "Mis cuentas": alta, edición y archivo. Las cuentas nunca se borran. */
export default function CuentasSheet({ onClose, onGuardado }: Props) {
  const { data: cuentas = [], isLoading } = useCuentas(true);
  const [agregando, setAgregando] = useState(false);
  const activas = cuentas.filter((c) => !c.archivada);
  const archivadas = cuentas.filter((c) => c.archivada);

  return (
    <AdminSheet open onClose={onClose} title="Mis cuentas" maxWidth="lg">
      <div className="flex flex-col gap-5">
        {isLoading && <p className="text-sm text-[var(--ink-soft)]">Cargando…</p>}

        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {activas.map((c) => (
            <FilaCuenta key={c.id} cuenta={c} onGuardado={onGuardado} />
          ))}
        </ul>

        {agregando ? (
          <FormAlta onListo={(m) => { setAgregando(false); onGuardado(m); }} onCancelar={() => setAgregando(false)} />
        ) : (
          <AdminButton variant="secondary" className="self-start" onClick={() => setAgregando(true)}>
            Agregar cuenta
          </AdminButton>
        )}

        {archivadas.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-medium text-[var(--ink-soft)]">Archivadas</h3>
            <ul className="flex flex-col divide-y divide-[var(--line)]">
              {archivadas.map((c) => (
                <FilaCuenta key={c.id} cuenta={c} onGuardado={onGuardado} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminSheet>
  );
}

function FilaCuenta({ cuenta, onGuardado }: { cuenta: CuentaCaja; onGuardado: (m: string) => void }) {
  const { actualizarCuenta, archivarCuenta, desarchivarCuenta } = useCajaMutaciones();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [titular, setTitular] = useState(cuenta.titular ?? '');
  const [alias, setAlias] = useState(cuenta.alias ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<unknown>, ok: string, alTerminar?: () => void) => {
    setError(null);
    setOcupado(true);
    try {
      await fn();
      onGuardado(ok);
      alTerminar?.();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const guardar = () =>
    correr(
      () => actualizarCuenta.mutateAsync({ id: cuenta.id, nombre: nombre.trim(), titular: titular.trim(), alias: alias.trim() }),
      'Cuenta actualizada',
      () => setEditando(false),
    );

  const esBolsillo = cuenta.tipo === 'bolsillo';

  return (
    <li className="py-3" data-testid="fila-cuenta">
      {editando ? (
        <div className="flex flex-col gap-3">
          <div>
            <AdminLabel htmlFor={`cta-nombre-${cuenta.id}`}>Nombre</AdminLabel>
            <AdminInput id={`cta-nombre-${cuenta.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} />
          </div>
          <div>
            <AdminLabel htmlFor={`cta-titular-${cuenta.id}`}>A nombre de</AdminLabel>
            <AdminInput id={`cta-titular-${cuenta.id}`} value={titular} onChange={(e) => setTitular(e.target.value)} maxLength={100} placeholder="Ej: Tami" />
          </div>
          {!esBolsillo && (
            <div>
              <AdminLabel htmlFor={`cta-alias-${cuenta.id}`}>Alias (opcional)</AdminLabel>
              <AdminInput id={`cta-alias-${cuenta.id}`} value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={100} placeholder="Solo de referencia" />
            </div>
          )}
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex gap-2">
            <AdminButton size="sm" variant="primary" disabled={ocupado || !nombre.trim()} onClick={guardar}>Guardar</AdminButton>
            <AdminButton size="sm" variant="secondary" disabled={ocupado} onClick={() => { setEditando(false); setError(null); }}>Cancelar</AdminButton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--ink)]">{cuenta.nombre}</div>
              <div className="text-xs text-[var(--ink-soft)]">
                {TIPO_CUENTA_LABEL[cuenta.tipo]}
                {cuenta.titular ? ` de ${cuenta.titular}` : ''}
                {cuenta.alias ? ` — ${cuenta.alias}` : ''}
              </div>
            </div>
            {!cuenta.archivada && (
              <span className="shrink-0 text-xs text-[var(--ink-soft)]">Desde {cuenta.fecha_inicio.split('-').reverse().join('/')}</span>
            )}
          </div>

          {error && <div className="mt-2"><ErrorBanner>{error}</ErrorBanner></div>}

          {confirmando ? (
            <div className="mt-2 rounded-[var(--radius-el)] bg-[var(--n-50)] p-3">
              <p className="text-sm text-[var(--ink)]">¿Archivar “{cuenta.nombre}”? Deja de aparecer para cargar movimientos; su historial queda. Solo se puede con saldo cero.</p>
              <div className="mt-2 flex gap-2">
                <AdminButton size="sm" variant="primary" disabled={ocupado} onClick={() => correr(() => archivarCuenta.mutateAsync(cuenta.id), 'Cuenta archivada', () => setConfirmando(false))}>
                  Sí, archivar
                </AdminButton>
                <AdminButton size="sm" variant="secondary" disabled={ocupado} onClick={() => { setConfirmando(false); setError(null); }}>No</AdminButton>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              {!cuenta.archivada && <AdminButton size="sm" variant="ghost" onClick={() => setEditando(true)}>Editar</AdminButton>}
              {!cuenta.archivada && !esBolsillo && <AdminButton size="sm" variant="ghost" onClick={() => setConfirmando(true)}>Archivar</AdminButton>}
              {cuenta.archivada && (
                <AdminButton size="sm" variant="ghost" disabled={ocupado} onClick={() => correr(() => desarchivarCuenta.mutateAsync(cuenta.id), 'Cuenta restaurada')}>
                  Restaurar
                </AdminButton>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function FormAlta({ onListo, onCancelar }: { onListo: (m: string) => void; onCancelar: () => void }) {
  const { crearCuenta } = useCajaMutaciones();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<Exclude<TipoCuenta, 'bolsillo'> | ''>('');
  const [titular, setTitular] = useState('');
  const [alias, setAlias] = useState('');
  const [saldo, setSaldo] = useState('');
  const [fecha, setFecha] = useState(hoyART());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const saldoN = saldo.trim() === '' ? 0 : parsearMonto(saldo);
  const falta = !nombre.trim() || !tipo || Number.isNaN(saldoN);

  const guardar = async () => {
    if (falta || !tipo) return;
    setError(null);
    setOcupado(true);
    try {
      await crearCuenta.mutateAsync({
        nombre: nombre.trim(),
        tipo,
        saldo_inicial: saldoN,
        fecha_inicio: fecha,
        ...(titular.trim() ? { titular: titular.trim() } : {}),
        ...(alias.trim() ? { alias: alias.trim() } : {}),
      });
      onListo(`Cuenta “${nombre.trim()}” creada${saldoN ? ` con ${formatearMonto(saldoN)}` : ''}`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
      <h3 className="text-sm font-medium text-[var(--ink)]">Cuenta nueva</h3>
      <ChipGroup label="Tipo" opciones={TIPOS_ALTA} value={tipo} onChange={setTipo} />
      <div>
        <AdminLabel htmlFor="cta-nueva-nombre">Nombre</AdminLabel>
        <AdminInput id="cta-nueva-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} placeholder="Ej: Banco Galicia" />
      </div>
      <div>
        <AdminLabel htmlFor="cta-nueva-titular">A nombre de</AdminLabel>
        <AdminInput id="cta-nueva-titular" value={titular} onChange={(e) => setTitular(e.target.value)} maxLength={100} placeholder="Ej: Facu" />
      </div>
      <div>
        <AdminLabel htmlFor="cta-nueva-alias">Alias (opcional)</AdminLabel>
        <AdminInput id="cta-nueva-alias" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={100} placeholder="Solo de referencia; no hace falta el CBU" />
      </div>
      <MontoInput id="cta-nueva-saldo" label="¿Cuánto hay hoy en esta cuenta?" value={saldo} onChange={setSaldo} />
      <div>
        <AdminLabel htmlFor="cta-nueva-fecha">Contar desde</AdminLabel>
        <AdminInput id="cta-nueva-fecha" type="date" value={fecha} max={hoyART()} onChange={(e) => setFecha(e.target.value)} />
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex gap-2">
        <AdminButton variant="primary" disabled={falta || ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Crear cuenta'}</AdminButton>
        <AdminButton variant="secondary" disabled={ocupado} onClick={onCancelar}>Cancelar</AdminButton>
      </div>
    </div>
  );
}

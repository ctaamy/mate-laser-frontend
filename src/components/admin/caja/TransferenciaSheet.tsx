import { useEffect, useState } from 'react';
import AdminSheet from '../ui/AdminSheet';
import AdminButton from '../ui/AdminButton';
import { AdminInput, AdminLabel, AdminTextarea } from '../ui/AdminInput';
import { CuentaChips, ErrorBanner, FraseConfirmacion, MontoInput } from './campos';
import { useDirtyGuard } from '../../../hooks/useDirtyGuard';
import { useCajaMutaciones } from '../../../hooks/useCaja';
import {
  formatearMonto,
  hoyART,
  leerCuentasRecientes,
  marcarCuentaReciente,
  mensajeError,
  nuevaClave,
  parsearMonto,
  type CuentaCaja,
} from '../../../lib/caja';

interface Props {
  cuentas: CuentaCaja[];
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

interface Estado {
  origenId: string;
  destinoId: string;
  monto: string;
  fecha: string;
  nota: string;
}

/** "Pasar plata entre cuentas": mueve plata sin que cambie el total del negocio. */
export default function TransferenciaSheet({ cuentas, onClose, onGuardado }: Props) {
  const { transferir } = useCajaMutaciones();
  const { marcarSnapshot, confirmarCierre } = useDirtyGuard<Estado>();
  const activas = cuentas.filter((c) => !c.archivada);

  const [estado, setEstado] = useState<Estado>({ origenId: '', destinoId: '', monto: '', fecha: '', nota: '' });
  const [clave] = useState(nuevaClave);
  const [verFecha, setVerFecha] = useState(false);
  const [verNota, setVerNota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    marcarSnapshot(estado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origen = activas.find((c) => c.id === estado.origenId) ?? null;
  const destino = activas.find((c) => c.id === estado.destinoId) ?? null;
  const montoN = parsearMonto(estado.monto);
  const falta = !(montoN > 0) || !origen || !destino;

  const cerrar = () => {
    if (confirmarCierre(estado)) onClose();
  };

  const guardar = async () => {
    if (falta || !origen || !destino || guardando) return;
    setError(null);
    setGuardando(true);
    try {
      await transferir.mutateAsync({
        cuenta_origen_id: origen.id,
        cuenta_destino_id: destino.id,
        monto: montoN,
        clave_cliente: clave,
        ...(estado.fecha && estado.fecha !== hoyART() ? { fecha: estado.fecha } : {}),
        ...(estado.nota.trim() ? { nota: estado.nota.trim() } : {}),
      });
      marcarCuentaReciente(origen.id);
      onGuardado(`Pasaste ${formatearMonto(montoN)} de ${origen.nombre} a ${destino.nombre}`);
      onClose();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const pista =
    origen?.tipo === 'bolsillo'
      ? 'Es plata que pone un socio: el negocio se la debe hasta que se la devuelva.'
      : destino?.tipo === 'bolsillo'
        ? 'Es una devolución de plata que puso un socio.'
        : null;

  return (
    <AdminSheet
      open
      onClose={cerrar}
      title="Pasar plata entre cuentas"
      footer={
        <>
          {!falta && origen && destino && (
            <FraseConfirmacion>
              Vas a pasar {formatearMonto(montoN)} de {origen.nombre} a {destino.nombre}.
            </FraseConfirmacion>
          )}
          {error && <div className="mb-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <AdminButton variant="primary" className="w-full sm:ml-auto sm:flex sm:w-auto" disabled={falta || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Pasar plata'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <MontoInput id="caja-transf-monto" label="Monto" value={estado.monto} onChange={(v) => setEstado((e) => ({ ...e, monto: v }))} autoFocus />

        <CuentaChips
          label="Sale de"
          cuentas={activas}
          value={estado.origenId}
          onChange={(id) => setEstado((e) => ({ ...e, origenId: id, destinoId: e.destinoId === id ? '' : e.destinoId }))}
          recientes={leerCuentasRecientes()}
        />

        <CuentaChips
          label="Entra en"
          cuentas={activas.filter((c) => c.id !== estado.origenId)}
          value={estado.destinoId}
          onChange={(id) => setEstado((e) => ({ ...e, destinoId: id }))}
          recientes={leerCuentasRecientes()}
        />

        {pista && <p className="text-sm text-[var(--ink-soft)]">{pista}</p>}

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
          {verFecha ? (
            <div>
              <AdminLabel htmlFor="caja-transf-fecha">Fecha</AdminLabel>
              <AdminInput id="caja-transf-fecha" type="date" value={estado.fecha || hoyART()} max={hoyART()} onChange={(e) => setEstado((s) => ({ ...s, fecha: e.target.value }))} />
            </div>
          ) : (
            <button type="button" onClick={() => setVerFecha(true)} className="self-start text-sm text-[var(--accent)] hover:underline">
              Cambiar la fecha (hoy)
            </button>
          )}
          {verNota ? (
            <div>
              <AdminLabel htmlFor="caja-transf-nota">Nota</AdminLabel>
              <AdminTextarea id="caja-transf-nota" rows={2} maxLength={300} value={estado.nota} onChange={(e) => setEstado((s) => ({ ...s, nota: e.target.value }))} placeholder="Ej: retiro de Mercado Pago" />
            </div>
          ) : (
            <button type="button" onClick={() => setVerNota(true)} className="self-start text-sm text-[var(--accent)] hover:underline">
              Agregar una nota
            </button>
          )}
        </div>
      </div>
    </AdminSheet>
  );
}

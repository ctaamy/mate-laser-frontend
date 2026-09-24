import { useState } from 'react';
import AdminSheet from '../ui/AdminSheet';
import AdminButton from '../ui/AdminButton';
import { CuentaChips, ErrorBanner, MontoInput } from './campos';
import { useCajaMutaciones } from '../../../hooks/useCaja';
import {
  formatearMonto,
  leerCuentasRecientes,
  mensajeError,
  nuevaClave,
  parsearMonto,
  type CuentaConSaldo,
  type ResultadoArqueo,
} from '../../../lib/caja';

interface Props {
  /** Solo se cuentan cuentas de efectivo. */
  cuentas: CuentaConSaldo[];
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

/**
 * "Contar la caja": 1) ¿cuánto hay?, con lo que dice el sistema debajo;
 * 2) el resultado (faltan / sobran / está justo) y recién ahí se anota la diferencia.
 */
export default function ArqueoSheet({ cuentas, onClose, onGuardado }: Props) {
  const { arqueo } = useCajaMutaciones();
  const efectivo = cuentas.filter((c) => c.tipo === 'efectivo' && !c.archivada);

  const [cuentaId, setCuentaId] = useState(() => (efectivo.length === 1 ? efectivo[0].id : ''));
  const [contado, setContado] = useState('');
  const [resultado, setResultado] = useState<ResultadoArqueo | null>(null);
  const [clave] = useState(nuevaClave);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cuenta = efectivo.find((c) => c.id === cuentaId) ?? null;
  const contadoN = parsearMonto(contado);
  const falta = !cuenta || !(contadoN >= 0);

  const ejecutar = async (dryRun: boolean) => {
    if (!cuenta || !(contadoN >= 0) || ocupado) return;
    setError(null);
    setOcupado(true);
    try {
      const r = await arqueo.mutateAsync({ cuenta_id: cuenta.id, contado: contadoN, clave_cliente: clave, dryRun });
      if (dryRun) {
        setResultado(r);
      } else {
        onGuardado(r.movimiento ? `Diferencia anotada: ${formatearMonto(r.diferencia)}` : 'La caja está justa');
        onClose();
      }
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const volverAContar = () => {
    setResultado(null);
    setError(null);
  };

  return (
    <AdminSheet
      open
      onClose={onClose}
      title="Contar la caja"
      footer={
        resultado ? (
          <>
            {error && <div className="mb-3"><ErrorBanner>{error}</ErrorBanner></div>}
            {resultado.resultado === 'justo' ? (
              <AdminButton variant="primary" className="w-full sm:ml-auto sm:flex sm:w-auto" onClick={onClose}>
                Listo
              </AdminButton>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <AdminButton variant="primary" className="w-full sm:w-auto" disabled={ocupado} onClick={() => ejecutar(false)}>
                  {ocupado ? 'Anotando…' : 'Anotar la diferencia'}
                </AdminButton>
                <AdminButton variant="secondary" className="w-full sm:w-auto" disabled={ocupado} onClick={volverAContar}>
                  Volver a contar
                </AdminButton>
              </div>
            )}
          </>
        ) : (
          <>
            {error && <div className="mb-3"><ErrorBanner>{error}</ErrorBanner></div>}
            <AdminButton variant="primary" className="w-full sm:ml-auto sm:flex sm:w-auto" disabled={falta || ocupado} onClick={() => ejecutar(true)}>
              {ocupado ? 'Calculando…' : 'Ver la diferencia'}
            </AdminButton>
          </>
        )
      }
    >
      {efectivo.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">
          No hay ninguna cuenta de efectivo. Agregá una desde “Mis cuentas” para poder contarla.
        </p>
      ) : resultado ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-2xl font-semibold text-[var(--ink)]">
            {resultado.resultado === 'justo' && 'Está justo'}
            {resultado.resultado === 'faltan' && `Faltan ${formatearMonto(Math.abs(resultado.diferencia))}`}
            {resultado.resultado === 'sobran' && `Sobran ${formatearMonto(resultado.diferencia)}`}
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            Contaste {formatearMonto(resultado.contado)} y el sistema decía {formatearMonto(resultado.saldo_sistema)}.
            {resultado.resultado === 'justo'
              ? ' No hay nada para anotar.'
              : ' Si querés, anotamos la diferencia para que la caja coincida con lo que hay.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {efectivo.length > 1 && (
            <CuentaChips label="¿Qué caja contás?" cuentas={efectivo} value={cuentaId} onChange={setCuentaId} recientes={leerCuentasRecientes()} />
          )}
          <MontoInput id="caja-contado" label="¿Cuánto hay?" value={contado} onChange={setContado} autoFocus />
          {cuenta && (
            <p className="text-sm text-[var(--ink-soft)]">
              El sistema dice <strong className="font-semibold text-[var(--ink)]">{formatearMonto(cuenta.saldo)}</strong> en {cuenta.nombre}.
            </p>
          )}
        </div>
      )}
    </AdminSheet>
  );
}

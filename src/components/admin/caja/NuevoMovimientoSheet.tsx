import { useEffect, useState } from 'react';
import AdminSheet from '../ui/AdminSheet';
import AdminButton from '../ui/AdminButton';
import { AdminInput, AdminLabel, AdminTextarea } from '../ui/AdminInput';
import { ChipGroup, CuentaChips, ErrorBanner, FraseConfirmacion, MontoInput } from './campos';
import { useDirtyGuard } from '../../../hooks/useDirtyGuard';
import { useCajaMutaciones } from '../../../hooks/useCaja';
import {
  CATEGORIAS_GASTO_CHIPS,
  CATEGORIAS_INGRESO_CHIPS,
  CATEGORIA_LABEL,
  formatearMonto,
  hoyART,
  leerCuentasRecientes,
  marcarCuentaReciente,
  mensajeError,
  nuevaClave,
  parsearMonto,
  type CuentaCaja,
  type MovimientoCaja,
} from '../../../lib/caja';

interface Props {
  tipo: 'gasto' | 'ingreso';
  cuentas: CuentaCaja[];
  /** Si viene, es una corrección: anula el original y carga este como nuevo. */
  movimiento?: MovimientoCaja | null;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

interface Estado {
  monto: string;
  categoria: string;
  cuentaId: string;
  devolver: 'si' | 'no' | '';
  fecha: string;
  nota: string;
}

// Se monta solo mientras está abierta (el padre la renderiza condicionalmente),
// así el estado arranca limpio cada vez y la clave de idempotencia es nueva.
export default function NuevoMovimientoSheet({ tipo, cuentas, movimiento, onClose, onGuardado }: Props) {
  const { crearMovimiento, corregirMovimiento } = useCajaMutaciones();
  const { marcarSnapshot, confirmarCierre } = useDirtyGuard<Estado>();
  const esGasto = tipo === 'gasto';

  // Un ingreso no se carga en un bolsillo (plata propia): para eso está "Pasar plata".
  const opcionesCuenta = cuentas.filter((c) => !c.archivada && (esGasto || c.tipo !== 'bolsillo'));

  const inicial = (): Estado => {
    const recientes = leerCuentasRecientes();
    const porDefecto =
      movimiento?.cuenta?.id ??
      recientes.find((id) => opcionesCuenta.some((c) => c.id === id)) ??
      (opcionesCuenta.length === 1 ? opcionesCuenta[0].id : '');
    return {
      monto: movimiento ? String(Math.abs(movimiento.monto)).replace('.', ',') : '',
      categoria: movimiento?.categoria ?? '',
      cuentaId: porDefecto,
      // Un gasto de bolsillo que quedó como fila suelta es uno que se devuelve.
      devolver: movimiento?.cuenta?.tipo === 'bolsillo' ? 'si' : '',
      fecha: movimiento && movimiento.fecha !== hoyART() ? movimiento.fecha : '',
      nota: movimiento?.nota ?? '',
    };
  };

  const [estado, setEstado] = useState<Estado>(inicial);
  const [clave, setClave] = useState(nuevaClave);
  const [verFecha, setVerFecha] = useState(!!estado.fecha);
  const [verNota, setVerNota] = useState(!!estado.nota);
  const [error, setError] = useState<string | null>(null);
  const [anotado, setAnotado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    marcarSnapshot(estado);
    // Solo el estado inicial cuenta como "sin cambios".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => {
    setEstado((e) => ({ ...e, [k]: v }));
    setAnotado(null);
  };

  const cuenta = opcionesCuenta.find((c) => c.id === estado.cuentaId) ?? null;
  const esBolsillo = cuenta?.tipo === 'bolsillo';
  const montoN = parsearMonto(estado.monto);
  const montoOk = Number.isFinite(montoN) && montoN > 0;

  const chips = esGasto
    ? CATEGORIAS_GASTO_CHIPS.filter((c) => !(esBolsillo && c.value === 'retiro_socio'))
    : CATEGORIAS_INGRESO_CHIPS;
  // Al corregir un movimiento con una categoría que no es un chip (ej. "reembolso"), se conserva.
  const opcionesCategoria: { value: string; label: string }[] = [...chips];
  if (movimiento && !opcionesCategoria.some((o) => o.value === movimiento.categoria)) {
    opcionesCategoria.push({ value: movimiento.categoria, label: CATEGORIA_LABEL[movimiento.categoria] ?? movimiento.categoria });
  }

  const falta = !montoOk || !estado.categoria || !cuenta || (esGasto && esBolsillo && !estado.devolver);
  const ocupado = guardando;

  const cerrar = () => {
    if (confirmarCierre(estado)) onClose();
  };

  const frase = (() => {
    if (!montoOk || !cuenta) return null;
    const monto = formatearMonto(montoN);
    if (esGasto && esBolsillo) {
      const quien = cuenta.titular ?? 'un socio';
      const destino = estado.devolver === 'si' ? ' y se lo devolvemos' : estado.devolver === 'no' ? ' como aporte, sin devolver' : '';
      return `Vas a anotar que ${quien} puso ${monto} de su bolsillo${destino}.`;
    }
    return esGasto
      ? `Vas a anotar que salieron ${monto} de ${cuenta.nombre}.`
      : `Vas a anotar que entraron ${monto} en ${cuenta.nombre}.`;
  })();

  const guardar = async (cargarOtro: boolean) => {
    if (falta || !cuenta || guardando) return;
    setError(null);
    setGuardando(true);
    const datos = {
      tipo,
      cuenta_id: cuenta.id,
      monto: montoN,
      categoria: estado.categoria,
      clave_cliente: clave,
      ...(estado.fecha && estado.fecha !== hoyART() ? { fecha: estado.fecha } : {}),
      ...(estado.nota.trim() ? { nota: estado.nota.trim() } : {}),
      ...(esGasto && esBolsillo ? { devolver: estado.devolver === 'si' } : {}),
    };
    try {
      if (movimiento) await corregirMovimiento.mutateAsync({ id: movimiento.id, ...datos });
      else await crearMovimiento.mutateAsync(datos);
      marcarCuentaReciente(cuenta.id);
      const resumen = `${esGasto ? 'Gasto' : 'Ingreso'} anotado: ${formatearMonto(montoN)}`;
      onGuardado(resumen);
      if (cargarOtro) {
        // Se deja la cuenta; monto, categoría y nota arrancan de cero, y una clave nueva.
        setEstado((e) => ({ ...e, monto: '', categoria: '', nota: '', fecha: '', devolver: e.devolver }));
        setVerFecha(false);
        setVerNota(false);
        setClave(nuevaClave());
        setAnotado(resumen);
      } else {
        onClose();
      }
    } catch (e) {
      // La clave NO cambia: reintentar el mismo envío no duplica el movimiento.
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const titulo = movimiento ? `Corregir ${esGasto ? 'gasto' : 'ingreso'}` : esGasto ? 'Nuevo gasto' : 'Nuevo ingreso';

  return (
    <AdminSheet
      open
      onClose={cerrar}
      title={titulo}
      footer={
        <>
          {frase && <FraseConfirmacion>{frase}</FraseConfirmacion>}
          {error && <div className="mb-3"><ErrorBanner>{error}</ErrorBanner></div>}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <AdminButton variant="primary" className="w-full sm:w-auto" disabled={falta || ocupado} onClick={() => guardar(false)}>
              {ocupado ? 'Guardando…' : movimiento ? 'Guardar corrección' : 'Guardar'}
            </AdminButton>
            {esGasto && !movimiento && (
              <AdminButton variant="secondary" className="w-full sm:w-auto" disabled={falta || ocupado} onClick={() => guardar(true)}>
                Guardar y cargar otro
              </AdminButton>
            )}
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {anotado && (
          <p role="status" className="rounded-[var(--radius-el)] bg-[var(--ok-soft)] px-3 py-2 text-sm text-[var(--ok)]">
            {anotado}. Cargá el siguiente.
          </p>
        )}

        {!esGasto && (
          <p className="text-xs text-[var(--ink-soft)]">
            Las ventas de la tienda y de Mercado Pago entran solas. Para Instagram o WhatsApp usá Órdenes → Venta manual.
          </p>
        )}

        <MontoInput id="caja-monto" label="Monto" value={estado.monto} onChange={(v) => set('monto', v)} autoFocus />

        <ChipGroup label="Categoría" opciones={opcionesCategoria} value={estado.categoria} onChange={(v) => set('categoria', v)} />

        <CuentaChips
          label={esGasto ? 'Pagado desde' : 'Entró en'}
          cuentas={opcionesCuenta}
          value={estado.cuentaId}
          onChange={(id) => {
            // "Retiro mío" no sale de un bolsillo: se limpia si quedó elegido.
            const c = opcionesCuenta.find((x) => x.id === id);
            setEstado((e) => ({ ...e, cuentaId: id, categoria: c?.tipo === 'bolsillo' && e.categoria === 'retiro_socio' ? '' : e.categoria }));
          }}
          recientes={leerCuentasRecientes()}
        />

        {esGasto && esBolsillo && (
          <ChipGroup
            label={`¿Se lo devolvemos a ${cuenta?.titular ?? 'quien puso la plata'}?`}
            opciones={[
              { value: 'si', label: 'Sí, se lo devolvemos' },
              { value: 'no', label: 'No, es un aporte' },
            ]}
            value={estado.devolver}
            onChange={(v) => set('devolver', v)}
          />
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
          {verFecha ? (
            <div>
              <AdminLabel htmlFor="caja-fecha">Fecha</AdminLabel>
              <AdminInput id="caja-fecha" type="date" value={estado.fecha || hoyART()} max={hoyART()} onChange={(e) => set('fecha', e.target.value)} />
            </div>
          ) : (
            <button type="button" onClick={() => setVerFecha(true)} className="self-start text-sm text-[var(--accent)] hover:underline">
              Cambiar la fecha (hoy)
            </button>
          )}
          {verNota ? (
            <div>
              <AdminLabel htmlFor="caja-nota">Nota</AdminLabel>
              <AdminTextarea id="caja-nota" rows={2} maxLength={300} value={estado.nota} onChange={(e) => set('nota', e.target.value)} placeholder="Ej: tinta para la impresora" />
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

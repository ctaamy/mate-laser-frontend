import { useEffect } from 'react';
import { AdminLabel, AdminSelect } from '../ui/AdminInput';
import { useCuentas } from '../../../hooks/useCaja';
import { cuentasParaMetodo } from '../../../lib/caja';

interface Props {
  id: string;
  /** Método de la venta manual: efectivo | transferencia | otro. */
  metodoPago: string;
  /** Id de la cuenta elegida, o '' = automática. */
  value: string;
  onChange: (cuentaId: string) => void;
}

/**
 * "¿En qué cuenta entró?" al cargar una venta manual o registrar un pago. Solo
 * ofrece las cuentas donde ese medio de pago puede entrar. No se muestra si la
 * caja todavía no está armada (o no hay una cuenta de ese tipo): ahí el cobro se
 * anota en la cuenta que recibe ese medio por defecto, o queda avisado en la caja.
 * Para "otro" no hay cuenta por defecto: hay que elegir (ver `useCuentaObligatoria`).
 */
export default function SelectorCuentaCobro({ id, metodoPago, value, onChange }: Props) {
  const { data: cuentas = [] } = useCuentas();
  const opciones = cuentasParaMetodo(cuentas, metodoPago);
  const valida = opciones.some((c) => c.id === value);

  // Si cambia el método y la cuenta elegida ya no sirve, se limpia.
  useEffect(() => {
    if (value && cuentas.length > 0 && !valida) onChange('');
  }, [value, cuentas.length, valida, onChange]);

  if (opciones.length === 0) return null;

  return (
    <div>
      <AdminLabel htmlFor={id}>¿En qué cuenta entró?</AdminLabel>
      <AdminSelect id={id} value={valida ? value : ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{metodoPago === 'otro' ? 'Elegí una cuenta' : 'La de siempre para este medio'}</option>
        {opciones.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </AdminSelect>
    </div>
  );
}

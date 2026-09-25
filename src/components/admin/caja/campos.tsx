import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { AdminLabel } from '../ui/AdminInput';
import { parsearMonto, type CuentaCaja } from '../../../lib/caja';

// Campos compartidos de las hojas de caja (gasto, ingreso, transferencia, contar).

const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/**
 * Monto en pesos: teclado numérico en el celu, "$" fijo y eco en vivo debajo
 * ("$ 1.500,00") — "1.500" se lee como mil quinientos, no como uno con cinco.
 */
export function MontoInput({
  id, label, value, onChange, autoFocus, reservarEco = true,
}: { id: string; label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; reservarEco?: boolean }) {
  const n = parsearMonto(value);
  const hayTexto = value.trim() !== '';
  const invalido = hayTexto && Number.isNaN(n);
  const muyAlto = !invalido && n >= 1_000_000;

  return (
    <div>
      <AdminLabel htmlFor={id}>{label}</AdminLabel>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-[var(--ink-soft)]">$</span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          aria-invalid={invalido}
          className="w-full rounded-[var(--radius-el)] border border-[var(--line)] bg-[var(--panel)] py-3 pl-7 pr-3 text-xl font-semibold tabular-nums text-[var(--ink)] placeholder:text-[var(--n-300)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
      </div>
      <div className={`mt-1 text-xs ${reservarEco ? 'min-h-5' : ''}`} aria-live="polite">
        {invalido ? (
          <span className="text-[var(--error)]">No entiendo ese monto. Probá con 1.500 o 1.500,50</span>
        ) : hayTexto && n > 0 ? (
          <span className="text-[var(--ink-soft)]">{ARS.format(n)}</span>
        ) : null}
        {muyAlto && <span className="ml-2 text-[var(--warn)]">Es un monto muy alto: revisá los ceros.</span>}
      </div>
    </div>
  );
}

export interface Opcion<T extends string> {
  value: T;
  label: string;
}

/** Selección única con botones grandes (mínimo 40 px de alto para el pulgar). */
export function ChipGroup<T extends string>({
  label, opciones, value, onChange,
}: { label: string; opciones: readonly Opcion<T>[]; value: T | ''; onChange: (v: T) => void }) {
  return (
    <div>
      <AdminLabel>{label}</AdminLabel>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(o.value)}
              className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                activo
                  ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-white'
                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--n-100)]'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Cuentas como chips: las usadas hace poco primero, así el default nunca queda escondido. */
export function CuentaChips({
  label = 'Cuenta', cuentas, value, onChange, recientes,
}: { label?: string; cuentas: CuentaCaja[]; value: string; onChange: (id: string) => void; recientes: string[] }) {
  const ordenadas = [...cuentas].sort((a, b) => {
    const ra = recientes.indexOf(a.id);
    const rb = recientes.indexOf(b.id);
    if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
    return a.orden - b.orden;
  });
  return (
    <ChipGroup
      label={label}
      opciones={ordenadas.map((c) => ({ value: c.id, label: c.nombre }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-el)] border-l-4 border-[var(--error)] bg-[var(--error-soft)] px-3 py-2.5 text-sm text-[var(--error)]">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Frase de confirmación antes de guardar: evita anotar una entrada como salida (y al revés). */
export function FraseConfirmacion({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm text-[var(--ink)]" aria-live="polite">{children}</p>;
}

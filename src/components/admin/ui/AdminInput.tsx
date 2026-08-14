import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

// Campos compartidos del admin — reemplazan el
// "border border-gray-200 rounded-lg px-3 py-2 text-sm ..." retipeado en
// cada formulario (Productos, CategoriasPanel, Configuracion, etc. — ver
// audit Fase 5 punto 1).
const fieldCls =
  'border border-[var(--line)] rounded-[var(--radius-el)] px-3 py-2 text-sm bg-[var(--panel)] text-[var(--ink)] ' +
  'placeholder:text-[var(--ink-soft)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// fullWidth por defecto true (el caso más común: campos de formulario en
// columna). false para usos sueltos como un <select> de filtro al lado de
// un título — NUNCA se agrega "w-full" fijo al fieldCls de base: Tailwind
// no garantiza qué clase de ancho gana en la cascada si el caller intenta
// pisarla con w-auto en className (dependía del orden de generación del
// CSS, no del orden en el string) — así fallaba mudo el filtro de estado
// de Ordenes.tsx, quedaba estirado a todo el ancho en vez de auto.
interface WidthProp { fullWidth?: boolean }

export function AdminLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs text-[var(--ink-soft)] mb-1 block font-medium">{children}</label>;
}

export function AdminInput({ className = '', fullWidth = true, ...rest }: InputHTMLAttributes<HTMLInputElement> & WidthProp) {
  return <input className={`${fieldCls} ${fullWidth ? 'w-full' : ''} ${className}`} {...rest} />;
}

export function AdminTextarea({ className = '', fullWidth = true, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & WidthProp) {
  return <textarea className={`${fieldCls} resize-none ${fullWidth ? 'w-full' : ''} ${className}`} {...rest} />;
}

export function AdminSelect({ className = '', fullWidth = true, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & WidthProp) {
  return (
    <select className={`${fieldCls} ${fullWidth ? 'w-full' : ''} ${className}`} {...rest}>
      {children}
    </select>
  );
}

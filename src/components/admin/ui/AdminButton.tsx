import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Botón compartido del admin — reemplaza los <button className="bg-[#1D9E75]...">
// / <button className="border border-gray-200...">  sueltos repetidos en cada
// pantalla (ver audit Fase 5, punto 1). Usa los tokens de Fase 5a
// (index.css .tema-admin), no colores hardcodeados.
//
// Variantes:
// - primary: acción principal de la pantalla (Guardar, Crear, Nuevo producto).
// - secondary: acción secundaria dentro de un flujo (Cancelar en un modal).
// - ghost: acción de baja jerarquía en una fila/tabla (editar, íconos sueltos).
// - danger: acciones destructivas (Eliminar, Desactivar).
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50',
  secondary:
    'bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--n-100)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--ink-soft)] hover:bg-[var(--n-100)] hover:text-[var(--ink)] disabled:opacity-40',
  danger:
    'bg-transparent text-[var(--ink-soft)] border border-[var(--line)] hover:text-[var(--error)] hover:border-[var(--error)] disabled:opacity-40',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

export default function AdminButton({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: AdminButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-[var(--radius-el)] transition-colors disabled:cursor-not-allowed ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

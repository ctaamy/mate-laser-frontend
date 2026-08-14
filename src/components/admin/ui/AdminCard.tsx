import type { HTMLAttributes, ReactNode } from 'react';

// Card compartida — reemplaza el "bg-white border border-gray-100 rounded-xl
// overflow-hidden" repetido a mano en Productos.tsx, Ordenes.tsx, Cupones.tsx
// (idéntico en las 3, ver audit Fase 5 punto 5) y le suma sombra real —
// hoy ninguna pantalla del admin usa shadow-*, solo un borde de 1px.
interface AdminCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean; // false para cards que envuelven una <table> (el padding lo maneja la tabla)
  hover?: boolean;  // eleva la sombra en hover — para cards clickeables (ej. grid de módulos)
}

export default function AdminCard({
  children,
  padded = true,
  hover = false,
  className = '',
  ...rest
}: AdminCardProps) {
  return (
    <div
      className={`bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-card)] overflow-hidden [box-shadow:var(--shadow-card)] ${
        hover ? 'transition-shadow hover:[box-shadow:var(--shadow-hover)]' : ''
      } ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// Header estándar de card (título + acción opcional a la derecha) — mismo
// patrón que el "<div className='px-5 py-4 border-b...'><h2>...</h2></div>"
// repetido en cada tabla del admin.
export function AdminCardHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--line)] flex justify-between items-center">
      <div>
        <h2 className="text-sm font-medium text-[var(--ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--ink-soft)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

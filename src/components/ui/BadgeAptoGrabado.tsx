// Badge "Apto grabado" (antes "Grabado láser") — mismo componente para
// ProductCard.tsx (Home productos_destacados + catálogo público) y
// ProductoDetalle.tsx, así el copy y el estilo se ajustan en un solo lugar.
// Color: var(--color-badge), resuelto desde el tema (tema.badge_color,
// useThemeGlobal.ts) — deliberadamente distinto del acento naranja de los
// CTAs, porque esto es una etiqueta informativa, no un llamado a la acción.
// Acepta un `color` fijo opcional para contextos que no heredan el tema
// (ej. el flujo de compra, que usa paleta neutra fija a propósito).
// `compact` — versión más chica (padding/ícono/texto reducidos) para cards
// angostas como productos_destacados (variant="overlay" en ProductCard),
// donde el tamaño default competía visualmente con título/precio. Default
// false reproduce exacto el tamaño histórico en el resto de los usos.
export default function BadgeAptoGrabado({ color, className = '', compact = false }: { color?: string; className?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center text-white ${compact ? 'gap-1 pl-1.5 pr-2 py-1' : 'gap-1.5 pl-2.5 pr-3 py-1.5'} ${className}`}
      style={{ backgroundColor: color || 'var(--color-badge)' }}>
      <svg width={compact ? 8 : 10} height={compact ? 8 : 10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-70">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span className={`font-bold uppercase tracking-[0.12em] ${compact ? 'text-[8px]' : 'text-[10px]'}`}>Apto grabado</span>
    </div>
  );
}

// Badge "Apto grabado" (antes "Grabado láser") — mismo componente para
// ProductCard.tsx (Home productos_destacados + catálogo público) y
// ProductoDetalle.tsx, así el copy y el estilo se ajustan en un solo lugar.
// Color: var(--color-badge), resuelto desde el tema (tema.badge_color,
// useThemeGlobal.ts) — deliberadamente distinto del acento naranja de los
// CTAs, porque esto es una etiqueta informativa, no un llamado a la acción.
// Acepta un `color` fijo opcional para contextos que no heredan el tema
// (ej. el flujo de compra, que usa paleta neutra fija a propósito).
export default function BadgeAptoGrabado({ color, className = '' }: { color?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-white pl-2.5 pr-3 py-1.5 ${className}`}
      style={{ backgroundColor: color || 'var(--color-badge)' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-70">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Apto grabado</span>
    </div>
  );
}

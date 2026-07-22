// Piezas visuales compartidas por las cards de grid con texto superpuesto
// sobre imagen (categorias_grid y productos_destacados, ambos en
// HomeSecciones.tsx, y ProductCard.tsx cuando renderiza en variante
// "overlay" para productos_destacados). Un solo lugar para ajustar el
// lenguaje visual de ambos bloques.
// Vive en su propio módulo (no en HomeSecciones.tsx) para evitar un import
// circular: HomeSecciones.tsx → ProductGrid.tsx → ProductCard.tsx.
import type { ReactNode } from 'react';

export const SIZE_REM: Record<string, string> = {
  xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem',
  '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
};

// Tamaño de fuente responsive para texto superpuesto dentro de una card de
// grid (nombre de categoría/producto, link de acción): clamp(min, vw, max)
// donde "max" es el tamaño elegido en el admin — se achica en pantallas/
// columnas angostas para no cortarse contra el overflow-hidden de la card,
// pero nunca supera el tamaño configurado en desktop.
export function fontSizeClampItem(sizeKey: string | undefined, sizeDefault: string): string {
  const rem = parseFloat(SIZE_REM[sizeKey || sizeDefault]);
  return `clamp(${(rem * 0.8).toFixed(3)}rem, ${(rem * 1.6).toFixed(2)}vw, ${rem}rem)`;
}

// Imagen con zoom leve al hover (scale 1.05) + degradé inferior para
// legibilidad del texto superpuesto. Requiere `group` en el ancestro.
export function ImagenConOverlay({ src, alt, gradiente = 'from-black/75 via-black/10 to-transparent' }: {
  src: string; alt: string; gradiente?: string;
}) {
  return (
    <>
      <img src={src} alt={alt}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
      <div className={`absolute inset-0 bg-gradient-to-t ${gradiente} pointer-events-none`} />
    </>
  );
}

// Link de acento con subrayado que se dibuja de izquierda a derecha al
// hover — CSS puro, reusa el color de acento ya usado en el link.
export function LinkAcentoConSubrayado({ children, color, fontSize }: {
  children: ReactNode; color: string; fontSize?: string;
}) {
  return (
    <span className="relative inline-flex items-center gap-1 font-medium transition-opacity group-hover:opacity-80"
      style={{ color, fontSize }}>
      {children}
      <span className="absolute left-0 right-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
        style={{ backgroundColor: color }} />
    </span>
  );
}

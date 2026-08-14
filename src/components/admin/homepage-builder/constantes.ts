import type { FiltroItem } from './types';

// ── helpers de UI ─────────────────────────────────────────────────────────────
export const inputCls = 'border border-[var(--line)] rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[var(--accent)]';
export const selectCls = inputCls;
export const labelCls = 'text-xs text-[var(--ink-soft)] mb-1 block';

export const SIZES = [
  { value: 'xs', label: 'XS — Muy pequeño' },
  { value: 'sm', label: 'SM — Pequeño' },
  { value: 'base', label: 'Base — Normal' },
  { value: 'lg', label: 'LG — Grande' },
  { value: 'xl', label: 'XL — Más grande' },
  { value: '2xl', label: '2XL — Muy grande' },
  { value: '3xl', label: '3XL — Enorme' },
  { value: '4xl', label: '4XL — Extra' },
];

export const PADDINGS = [
  { value: 'xs', label: 'XS — Mínimo' },
  { value: 'sm', label: 'SM — Chico' },
  { value: 'md', label: 'MD — Normal' },
  { value: 'lg', label: 'LG — Amplio' },
  { value: 'xl', label: 'XL — Muy amplio' },
];

export const ALINEACIONES = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
];

// Dos estilos para productos_destacados: "carrusel" (cards con texto
// superpuesto, deslizable en mobile) y "grid" (cards tipo catálogo, siempre
// 2 columnas fijas, sin scroll) — para poder combinar dos bloques, uno de
// cada estilo, en el mismo home.
export const LAYOUTS_PRODUCTOS = [
  { value: 'carrusel', label: 'Carrusel (desliza en mobile)' },
  { value: 'grid', label: 'Cuadrícula fija (2 columnas)' },
];

export const PESOS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medio' },
  { value: 'semibold', label: 'Semi negrita' },
  { value: 'bold', label: 'Negrita' },
];

export const IMAGE_POSITIONS = [
  { value: 'bleed', label: 'Bleed — sin marco, sangra al borde' },
  { value: 'contained', label: 'Contenida — bloque con borde definido' },
  { value: 'background', label: 'Fondo — foto completa con overlay' },
];

export const TRANSICIONES = [
  { value: 'ninguna', label: 'Ninguna (corte plano)' },
  { value: 'degradado', label: 'Degradado — fundido suave' },
  { value: 'curva', label: 'Curva' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'ondulada', label: 'Ondulada' },
];

export const OVERLAY_DIRECTIONS = [
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
  { value: 'top', label: 'Arriba' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'radial', label: 'Radial (desde el centro)' },
  { value: 'full', label: 'Completo (parejo)' },
  { value: 'none', label: 'Sin overlay' },
];

export const FUENTES = [
  { value: '', label: 'Predeterminada (Inter)' },
  // Sans-serif del sistema
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  // Serif del sistema
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  // Monoespaciada
  { value: 'Courier New, monospace', label: 'Courier New' },
  // Google Fonts
  { value: 'Poppins, sans-serif', label: 'Poppins (Google)' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat (Google)' },
  { value: 'Lato, sans-serif', label: 'Lato (Google)' },
  { value: 'Raleway, sans-serif', label: 'Raleway (Google)' },
  { value: 'Oswald, sans-serif', label: 'Oswald (Google)' },
  { value: 'Playfair Display, serif', label: 'Playfair Display (Google)' },
  { value: 'Merriweather, serif', label: 'Merriweather (Google)' },
  { value: 'Nunito, sans-serif', label: 'Nunito (Google)' },
];

// Google Fonts que requieren carga dinámica
export const GOOGLE_FONTS = ['Poppins', 'Montserrat', 'Lato', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Nunito'];

export const COLUMNAS = [
  { value: '2', label: '2 columnas' },
  { value: '3', label: '3 columnas' },
  { value: '4', label: '4 columnas' },
  { value: '5', label: '5 columnas' },
];

export const TIPOS_FILTRO: { value: FiltroItem['tipo']; label: string }[] = [
  { value: 'categoria', label: 'Categoría' },
  { value: 'apto_grabado', label: 'Apto para grabar' },
];

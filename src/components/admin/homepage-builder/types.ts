// ── tipos ────────────────────────────────────────────────────────────────────
export type TipoSeccion = 'hero' | 'banner_texto' | 'productos_destacados' | 'categorias_grid' | 'texto_libre' | 'banner_imagen' | 'stats_barra' | 'como_funciona' | 'cta_banner' | 'filtros_rapidos' | 'galeria_combos' | 'newsletter';

// El navbar y el footer se guardan como una sección más cada uno (tipo
// 'navbar' / 'footer'), aunque no son seleccionables desde "Agregar sección"
// ni aparecen en la lista reordenable del tab Inicio — tienen su propia card
// fija y colapsable (navbar al principio, footer al final), porque ambos son
// elementos globales que aparecen en todas las páginas, no solo el inicio.
export type SeccionTipo = TipoSeccion | 'navbar' | 'footer';

export interface Seccion {
  id: string;
  tipo: SeccionTipo;
  activo: boolean;
  orden: number;
  datos: Record<string, any>;
}

export interface CatItem { id: number; icono: string; imagen_url?: string }

export interface StatItemEditable { valor: string; label: string; icono?: string }

export interface FiltroItem { id: string; tipo: 'categoria' | 'apto_grabado'; label: string; config: Record<string, any> }

export interface Boton { texto: string; link: string; bg_color?: string; texto_color?: string }

export interface HeroSlide {
  titulo: string; subtitulo?: string; eyebrow?: string; imagen_url?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  botones?: Boton[];
  bg_color?: string; texto_color?: string;
}

export interface ImagenLibre { id: string; url: string; x: number; y: number; escala: number }

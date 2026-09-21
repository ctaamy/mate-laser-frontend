import { categoriaIdDeHref, type NodoCategoria } from './categoriasArbol';

// Analítica de visitas — Umami Cloud (cookie-less, sin banner de consentimiento
// necesario). Se inyecta el script SOLO en producción y solo si el ID está
// configurado — así el tráfico de dev/localhost y de otros entornos (staging,
// si algún día existe) nunca ensucia las métricas reales del sitio.
export function initAnalytics() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!import.meta.env.PROD || !websiteId) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://cloud.umami.is/script.js';
  script.setAttribute('data-website-id', websiteId);
  document.head.appendChild(script);
}

// ── Eventos ───────────────────────────────────────────────────────────────────
// `window.umami` solo existe en producción y una vez cargado el script (defer):
// en dev, con un bloqueador de anuncios o si un click llega antes de la carga,
// track() es un no-op. Nunca tira: la analítica no puede romper la UI.
// Sin datos personales: solo nombres/ids de categorías y el lugar de la UI.
type DatosEvento = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (evento: string, datos?: DatosEvento) => void };
  }
}

export function track(evento: string, datos?: DatosEvento) {
  try {
    window.umami?.track(evento, datos);
  } catch {
    /* la analítica nunca rompe la UI */
  }
}

// Dónde de la UI eligió la persona la categoría (ver docs/analitica.md).
export type OrigenCategoria =
  | 'navbar_link'     // link de la barra (ej. "Diseños")
  | 'navbar_panel'    // panel ancho de "Productos"
  | 'navbar_submenu'  // desplegable de una categoría raíz
  | 'menu_mobile'     // menú hamburguesa
  | 'sidebar'         // filtros de /productos en desktop
  | 'drawer'          // filtros de /productos en mobile
  | 'chips'           // chips sobre la grilla en mobile
  | 'migas';          // breadcrumb de la ficha de producto

export interface CategoriaTrack {
  id: number;
  nombre: string;
  padre_id?: number | null;
}

/** 'todos' = "Todos" / "Ver todos los productos" (sin categoría). */
export function trackCategoriaClick(origen: OrigenCategoria, cat: CategoriaTrack | 'todos', nivel?: 'raiz' | 'hija') {
  if (cat === 'todos') {
    track('nav_categoria_click', { origen, categoria: 'todos', nivel: 'todos' });
    return;
  }
  track('nav_categoria_click', {
    origen,
    categoria: cat.nombre,
    categoria_id: cat.id,
    nivel: nivel ?? (cat.padre_id ? 'hija' : 'raiz'),
  });
}

// Click en un link de navegación cualquiera (navbar/menú mobile): cuenta solo si
// apunta al catálogo — a una categoría conocida o a /productos ("todos").
export function trackEnlaceCatalogo(origen: OrigenCategoria, href: string, raices: NodoCategoria[]) {
  const [ruta] = href.split('?');
  if (ruta !== '/productos') return;
  const id = categoriaIdDeHref(href);
  if (id === null) {
    trackCategoriaClick(origen, 'todos');
    return;
  }
  const nodo = raices.find((r) => r.id === id) ?? raices.flatMap((r) => r.hijas).find((h) => h.id === id);
  if (nodo) trackCategoriaClick(origen, nodo);
}

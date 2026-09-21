import type { Categoria } from '../types';

export interface NodoCategoria extends Categoria {
  hijas: NodoCategoria[];
}

export interface ArbolCategorias {
  raices: NodoCategoria[];
  porId: Map<number, NodoCategoria>;
}

interface Opciones {
  // Oculta las categorías con cantidad_productos === 0. Estricto: si el campo
  // no viene (backend viejo, mocks de tests) la categoría se muestra.
  ocultarVacias?: boolean;
  // Categoría elegida por URL: nunca se oculta (ni su padre), para no dejar
  // una pantalla "0 productos" sin ningún lugar marcado en el menú.
  seleccionadaId?: number | null;
}

const comparar = (a: Categoria, b: Categoria) =>
  (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id;

// Convierte la lista plana de GET /categorias en árbol de 2 niveles. Orden
// estable (orden → nombre → id: `orden` tiene empates). Las hijas cuyo padre
// no está en la lista (padre borrado) se descartan: hoy no se renderizan en
// ningún lado y mostrarlas como raíz las sacaría de su contexto.
export function construirArbol(categorias: Categoria[] = [], opts: Opciones = {}): ArbolCategorias {
  const { ocultarVacias = false, seleccionadaId = null } = opts;
  const nodos = new Map<number, NodoCategoria>();
  for (const c of categorias) nodos.set(c.id, { ...c, hijas: [] });

  const raices: NodoCategoria[] = [];
  for (const n of nodos.values()) {
    if (!n.padre_id) raices.push(n);
    else nodos.get(n.padre_id)?.hijas.push(n);
  }

  const esVacia = (n: Categoria) => n.cantidad_productos === 0 && n.id !== seleccionadaId;
  const visibles = ocultarVacias
    ? raices
        .map((r) => ({ ...r, hijas: r.hijas.filter((h) => !esVacia(h)) }))
        .filter((r) => !esVacia(r) || r.hijas.length > 0)
    : raices;

  visibles.sort(comparar);
  visibles.forEach((r) => r.hijas.sort(comparar));

  const porId = new Map<number, NodoCategoria>();
  for (const r of visibles) {
    porId.set(r.id, r);
    r.hijas.forEach((h) => porId.set(h.id, h));
  }
  return { raices: visibles, porId };
}

/** categoria_id de un href a /productos?categoria_id=N (null si no es de categoría). */
export function categoriaIdDeHref(href: string | undefined): number | null {
  if (!href) return null;
  const [ruta, query = ''] = href.split('?');
  if (ruta !== '/productos') return null;
  const id = Number(new URLSearchParams(query).get('categoria_id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

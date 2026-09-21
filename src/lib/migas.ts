import type { Producto } from '../types';
import type { NodoCategoria } from './categoriasArbol';

/** Un nivel del breadcrumb. Sin `path` = la página actual (no es link). */
export interface Miga {
  nombre: string;
  path?: string;
}

// Migas de la ficha de producto: Inicio › Productos › [padre] › categoría ›
// producto. Cada nivel de categoría linkea a su listado (el del padre incluye
// las hijas). Si el padre no está en el árbol (padre inactivo/borrado) se omite
// en vez de mostrar un nivel roto; sin categoría, la trilla se acorta.
export function armarMigas(producto: Pick<Producto, 'nombre' | 'categorias'>, porId: Map<number, NodoCategoria>): Miga[] {
  const migas: Miga[] = [
    { nombre: 'Inicio', path: '/' },
    { nombre: 'Productos', path: '/productos' },
  ];
  const cat = producto.categorias;
  if (cat) {
    const padre = cat.padre_id ? porId.get(cat.padre_id) : undefined;
    if (padre) migas.push({ nombre: padre.nombre, path: `/productos?categoria_id=${padre.id}` });
    migas.push({ nombre: cat.nombre, path: `/productos?categoria_id=${cat.id}` });
  }
  migas.push({ nombre: producto.nombre });
  return migas;
}

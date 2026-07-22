import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SeleccionConfigurador {
  paso_slug: string;
  opcion_id?: string;
  variante_id?: string;
  nombre: string;
  precio: number;
  imagen_referencia_url?: string;
}

interface ItemCarrito {
  producto_id: string;
  variante_id?: string;
  variante_descripcion?: string;
  nombre_producto: string;
  color?: string;
  texto_grabado?: string;
  con_grabado?: boolean;
  precio_unitario: number;
  cantidad: number;
  imagen_url?: string;
  stock?: number;
  selecciones_configurador?: SeleccionConfigurador[];
  // Vincula items del mismo armado del configurador (mate + bombilla + grabado). Ausente en items sueltos.
  combo_id?: string;
}

interface CarritoState {
  items: ItemCarrito[];
  agregar: (item: ItemCarrito) => void;
  quitar: (producto_id: string, variante_id?: string, con_grabado?: boolean, texto_grabado?: string, color?: string, selecciones_configurador?: SeleccionConfigurador[]) => void;
  actualizarCantidad: (producto_id: string, cantidad: number, variante_id?: string, con_grabado?: boolean, texto_grabado?: string, color?: string, selecciones_configurador?: SeleccionConfigurador[]) => void;
  limpiar: () => void;
  total: () => number;
  subtotal: () => number;
  cantidadItems: () => number;
}

/** Hash estable de las selecciones del configurador, usado para no mezclar items con selecciones distintas. */
const hashSelecciones = (selecciones?: SeleccionConfigurador[]) =>
  selecciones && selecciones.length > 0
    ? selecciones
        .map(s => `${s.paso_slug}:${s.opcion_id ?? ''}:${s.variante_id ?? ''}`)
        .sort()
        .join('|')
    : undefined;

const mismoItem = (a: ItemCarrito, b: Partial<ItemCarrito>) =>
  a.producto_id === b.producto_id &&
  a.variante_id === b.variante_id &&
  a.con_grabado === b.con_grabado &&
  a.texto_grabado === b.texto_grabado &&
  a.color === b.color &&
  hashSelecciones(a.selecciones_configurador) === hashSelecciones(b.selecciones_configurador);

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],

      agregar: (item) => {
        const items = get().items;
        const existe = items.find(i => mismoItem(i, item));
        if (existe) {
          const nuevaCantidad = existe.cantidad + item.cantidad;
          const max = existe.stock ?? item.stock ?? Infinity;
          set({
            items: items.map(i =>
              mismoItem(i, item)
                ? { ...i, cantidad: Math.min(nuevaCantidad, max), stock: item.stock ?? i.stock }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      quitar: (producto_id, variante_id, con_grabado, texto_grabado, color, selecciones_configurador) => {
        set({
          items: get().items.filter(i => !mismoItem(i, { producto_id, variante_id, con_grabado, texto_grabado, color, selecciones_configurador })),
        });
      },

      actualizarCantidad: (producto_id, cantidad, variante_id, con_grabado, texto_grabado, color, selecciones_configurador) => {
        if (cantidad <= 0) {
          get().quitar(producto_id, variante_id, con_grabado, texto_grabado, color, selecciones_configurador);
          return;
        }
        set({
          items: get().items.map(i => {
            if (!mismoItem(i, { producto_id, variante_id, con_grabado, texto_grabado, color, selecciones_configurador })) return i;
            const max = i.stock ?? Infinity;
            return { ...i, cantidad: Math.min(cantidad, max) };
          }),
        });
      },

      limpiar: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0),

      total: () => get().subtotal(),

      cantidadItems: () =>
        get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    { name: 'carrito-storage' }
  )
);

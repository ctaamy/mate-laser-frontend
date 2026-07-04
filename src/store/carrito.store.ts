import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface CarritoState {
  items: ItemCarrito[];
  agregar: (item: ItemCarrito) => void;
  quitar: (producto_id: string, variante_id?: string, con_grabado?: boolean, texto_grabado?: string, color?: string) => void;
  actualizarCantidad: (producto_id: string, cantidad: number, variante_id?: string, con_grabado?: boolean, texto_grabado?: string, color?: string) => void;
  limpiar: () => void;
  total: () => number;
  subtotal: () => number;
  cantidadItems: () => number;
}

const mismoItem = (a: ItemCarrito, b: Partial<ItemCarrito>) =>
  a.producto_id === b.producto_id &&
  a.variante_id === b.variante_id &&
  a.con_grabado === b.con_grabado &&
  a.texto_grabado === b.texto_grabado &&
  a.color === b.color;

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

      quitar: (producto_id, variante_id, con_grabado, texto_grabado, color) => {
        set({
          items: get().items.filter(i => !mismoItem(i, { producto_id, variante_id, con_grabado, texto_grabado, color })),
        });
      },

      actualizarCantidad: (producto_id, cantidad, variante_id, con_grabado, texto_grabado, color) => {
        if (cantidad <= 0) {
          get().quitar(producto_id, variante_id, con_grabado, texto_grabado, color);
          return;
        }
        set({
          items: get().items.map(i => {
            if (!mismoItem(i, { producto_id, variante_id, con_grabado, texto_grabado, color })) return i;
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

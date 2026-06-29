import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ItemCarrito {
  producto_id: string;
  variante_id?: string;
  nombre_producto: string;
  color?: string;
  texto_grabado?: string;
  con_grabado?: boolean;
  precio_unitario: number;
  cantidad: number;
  imagen_url?: string;
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

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],

      agregar: (item) => {
        const items = get().items;
        const existe = items.find(
          (i) =>
            i.producto_id === item.producto_id &&
            i.variante_id === item.variante_id &&
            i.con_grabado === item.con_grabado &&
            i.texto_grabado === item.texto_grabado &&
            i.color === item.color
        );
        if (existe) {
          set({
            items: items.map((i) =>
              i.producto_id === item.producto_id &&
              i.variante_id === item.variante_id &&
              i.texto_grabado === item.texto_grabado &&
              i.color === item.color
                ? { ...i, cantidad: i.cantidad + item.cantidad }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      quitar: (producto_id, variante_id, con_grabado, texto_grabado, color) => {
        set({
          items: get().items.filter((i) => !(
            i.producto_id === producto_id &&
            i.variante_id === variante_id &&
            i.con_grabado === con_grabado &&
            i.texto_grabado === texto_grabado &&
            i.color === color
          )),
        });
      },

      actualizarCantidad: (producto_id, cantidad, variante_id, con_grabado, texto_grabado, color) => {
        if (cantidad <= 0) {
          get().quitar(producto_id, variante_id, con_grabado, texto_grabado, color);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.producto_id === producto_id &&
            i.variante_id === variante_id &&
            i.con_grabado === con_grabado &&
            i.texto_grabado === texto_grabado &&
            i.color === color
              ? { ...i, cantidad }
              : i
          ),
        });
      },

      limpiar: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0),

      total: () => get().subtotal(),

      cantidadItems: () =>
        get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    {
      name: 'carrito-storage',
    }
  )
);
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
  // "Bombilla como add-on": la línea lleva la bombilla opcional del producto.
  // `bombilla_nombre` es sólo para mostrar (la fuente de precio/stock es el backend).
  con_bombilla?: boolean;
  bombilla_nombre?: string;
  precio_unitario: number;
  cantidad: number;
  imagen_url?: string;
  stock?: number;
  // Fase 1 (auditoría carrito): resultado de la última revisión de stock
  // real contra el catálogo. `undefined` = todavía no se revisó en esta
  // sesión de carrito (recién agregado, o carrito viejo sin sincronizar).
  disponible?: boolean;
  selecciones_configurador?: SeleccionConfigurador[];
  // Vincula items del mismo armado del configurador (mate + bombilla + grabado). Ausente en items sueltos.
  combo_id?: string;
}

// Actualización de disponibilidad real de un producto/variante, tal como la
// devuelve GET /productos (vista pública: `disponible` + `cantidad_maxima`,
// nunca el stock exacto — ver hallazgo #8).
interface ActualizacionStock {
  producto_id: string;
  variante_id?: string;
  stock: number;
  disponible: boolean;
}

// Cupón aplicado, tal como lo devuelve POST /cupones/validar. Vive en el store
// (antes era estado local de Carrito.tsx) para que sobreviva a la navegación al
// checkout. `descuento` es el monto en pesos ya calculado server-side; se
// re-valida contra el backend al entrar al checkout y al crear la orden.
export interface CuponAplicado {
  codigo: string;
  cuponId: string;
  descuento: number;
  // Fase 1 (scope): si `aplicaATodo` es false, el descuento vale solo para
  // las líneas cuyo producto_id está en `itemsElegibles`.
  aplicaATodo: boolean;
  itemsElegibles: string[];
}

interface CarritoState {
  items: ItemCarrito[];
  // Fase 2 (auditoría carrito): timestamp (ms) de la última vez que el
  // usuario agregó/quitó/cambió cantidad de algo. No se toca por
  // `sincronizarDisponibilidad` (eso es una revisión automática, no una
  // acción del usuario) — sirve para avisar "este carrito es de hace
  // varios días" sin borrar nada solo.
  actualizadoEn: number;
  // Cupón aplicado en el carrito, o null. Cualquier cambio de items lo desaplica
  // (el descuento depende del contenido del carrito) pero su código pasa a
  // `cuponPendiente`, así el carrito ofrece "Tenés un cupón listo — Aplicar" en
  // vez de perderlo en silencio. `sincronizarDisponibilidad` no lo toca — el
  // re-chequeo del checkout es la red de seguridad para ese caso.
  cupon: CuponAplicado | null;
  // Código de cupón traído por la URL (?cupon=…) o por el flujo de bienvenida
  // del newsletter, todavía SIN aplicar. A diferencia de `cupon`, NO se limpia
  // al editar el carrito — sobrevive para que el usuario lo pueda aplicar
  // cuando tenga items. Se limpia al aplicarlo, al descartarlo o al vaciar.
  cuponPendiente: string | null;
  agregar: (item: ItemCarrito) => void;
  quitar: (producto_id: string, variante_id?: string, con_grabado?: boolean, con_bombilla?: boolean, texto_grabado?: string, color?: string, selecciones_configurador?: SeleccionConfigurador[]) => void;
  actualizarCantidad: (producto_id: string, cantidad: number, variante_id?: string, con_grabado?: boolean, con_bombilla?: boolean, texto_grabado?: string, color?: string, selecciones_configurador?: SeleccionConfigurador[]) => void;
  aplicarCupon: (cupon: CuponAplicado) => void;
  quitarCupon: () => void;
  setCuponPendiente: (codigo: string) => void;
  limpiarCuponPendiente: () => void;
  // Fase 1 (auditoría carrito): pisa `stock`/`disponible` de cada item con
  // datos frescos del catálogo (llamado al entrar a /carrito, ver Carrito.tsx).
  // Si un producto/variante ya no está en `actualizaciones` (desactivado o
  // eliminado), queda marcado sin stock. Si la cantidad en carrito supera el
  // stock disponible, se ajusta al máximo real.
  sincronizarDisponibilidad: (actualizaciones: ActualizacionStock[]) => void;
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
  !!a.con_bombilla === !!b.con_bombilla &&
  a.texto_grabado === b.texto_grabado &&
  a.color === b.color &&
  hashSelecciones(a.selecciones_configurador) === hashSelecciones(b.selecciones_configurador);

/**
 * Estado del cupón después de editar el carrito (agregar, quitar, cambiar
 * cantidad). El descuento ya calculado deja de valer — depende del contenido —
 * así que `cupon` se desaplica, pero el código NO se pierde: pasa a
 * `cuponPendiente` y Carrito.tsx lo ofrece con el botón "Aplicar". Antes, tocar
 * la cantidad borraba el cupón sin avisar y la persona veía subir el total sin
 * saber por qué. Si ya había un pendiente (todavía sin aplicar), se conserva.
 */
const cuponTrasEditar = (s: { cupon: CuponAplicado | null; cuponPendiente: string | null }) => ({
  cupon: null,
  cuponPendiente: s.cupon?.codigo ?? s.cuponPendiente,
});

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],
      actualizadoEn: Date.now(),
      cupon: null,
      cuponPendiente: null,

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
            actualizadoEn: Date.now(),
            ...cuponTrasEditar(get()),
          });
        } else {
          set({ items: [...items, item], actualizadoEn: Date.now(), ...cuponTrasEditar(get()) });
        }
      },

      quitar: (producto_id, variante_id, con_grabado, con_bombilla, texto_grabado, color, selecciones_configurador) => {
        set({
          items: get().items.filter(i => !mismoItem(i, { producto_id, variante_id, con_grabado, con_bombilla, texto_grabado, color, selecciones_configurador })),
          actualizadoEn: Date.now(),
          ...cuponTrasEditar(get()),
        });
      },

      actualizarCantidad: (producto_id, cantidad, variante_id, con_grabado, con_bombilla, texto_grabado, color, selecciones_configurador) => {
        if (cantidad <= 0) {
          get().quitar(producto_id, variante_id, con_grabado, con_bombilla, texto_grabado, color, selecciones_configurador);
          return;
        }
        set({
          items: get().items.map(i => {
            if (!mismoItem(i, { producto_id, variante_id, con_grabado, con_bombilla, texto_grabado, color, selecciones_configurador })) return i;
            const max = i.stock ?? Infinity;
            return { ...i, cantidad: Math.min(cantidad, max) };
          }),
          actualizadoEn: Date.now(),
          ...cuponTrasEditar(get()),
        });
      },

      aplicarCupon: (cupon) => set({ cupon, cuponPendiente: null }),
      quitarCupon: () => set({ cupon: null }),
      setCuponPendiente: (codigo) => set({ cuponPendiente: codigo.trim().toUpperCase() || null }),
      limpiarCuponPendiente: () => set({ cuponPendiente: null }),

      sincronizarDisponibilidad: (actualizaciones) => {
        set({
          items: get().items.map((i) => {
            const match = actualizaciones.find(
              (a) => a.producto_id === i.producto_id && (a.variante_id ?? undefined) === (i.variante_id ?? undefined)
            );
            if (!match) return { ...i, disponible: false, stock: 0 };
            const cantidad = match.disponible ? Math.min(i.cantidad, match.stock) : i.cantidad;
            return { ...i, stock: match.stock, disponible: match.disponible, cantidad };
          }),
        });
      },

      limpiar: () => set({ items: [], actualizadoEn: Date.now(), cupon: null, cuponPendiente: null }),

      subtotal: () =>
        get().items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0),

      total: () => get().subtotal(),

      cantidadItems: () =>
        get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    {
      name: 'carrito-storage',
      // v3: entró `con_bombilla` en la identidad de la línea (mismoItem). Los
      // items viejos sin el flag se leen como "sin bombilla", que es correcto —
      // no hace falta reparar nada.
      // v4: se descartan las líneas con grabado y sin texto (ver más abajo).
      version: 4,
      // Carritos persistidos antes de la Fase 2 no tienen `actualizadoEn`.
      // Se completa con "ahora" en vez de dejarlo undefined (que se leería
      // como "hace milenios" y dispararía el aviso de carrito viejo de
      // entrada, sin base real para afirmar la antigüedad).
      migrate: (persisted: any, fromVersion: number) => {
        let estado = {
          ...persisted,
          actualizadoEn: persisted?.actualizadoEn ?? Date.now(),
        };
        // v2: entró el precio por variante (precio_override). Una línea con
        // `variante_id` (o parte de un combo del configurador) guardada antes
        // puede tener un `precio_unitario` que ya no coincide con el catálogo,
        // y el checkout lo rechazaría. Se descartan solo esas líneas — las de
        // producto simple conservan su precio (sigue siendo el precio_base).
        if (fromVersion < 2) {
          const previos: ItemCarrito[] = Array.isArray(persisted?.items) ? persisted.items : [];
          const items = previos.filter((i) => !i.variante_id && !i.combo_id);
          estado = {
            ...estado,
            items,
            // el cupón depende del contenido; si algo se descartó, se re-aplica a mano.
            cupon: items.length === previos.length ? estado.cupon ?? null : null,
          };
        }
        // v4: la ficha de producto dejaba agregar "Grabado personalizado" con el
        // texto vacío y le sumaba el costo del grabado al precio; el servidor solo
        // cobra el grabado si hay texto, así que esa línea nunca podía comprarse
        // (el checkout la rechazaba con "el precio cambió" y no había cómo
        // corregirla desde el carrito). Se descartan esas líneas guardadas.
        if (fromVersion < 4) {
          const previos: ItemCarrito[] = Array.isArray(estado?.items) ? estado.items : [];
          const items = previos.filter((i) => !(i.con_grabado && !i.texto_grabado?.trim()));
          if (items.length !== previos.length) {
            estado = { ...estado, items, cupon: null };
          }
        }
        return estado;
      },
    }
  )
);

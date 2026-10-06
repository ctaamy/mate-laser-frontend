// Carga diferida de las pantallas (code splitting por ruta).
//
// Antes todo el sitio — incluido el panel admin entero (un tercio del JS) y el
// checkout — viajaba en un único bundle de 1,2 MB que bajaba cualquier visitante.
// Ahora cada pantalla es su propio chunk y solo la home + el layout van en el
// bundle inicial.
import { lazy, type ComponentType } from 'react';

// ── Recarga ante un chunk que no existe ──────────────────────────────────────
// Los archivos llevan hash en el nombre y cada deploy reemplaza los anteriores.
// Quien tiene la app abierta de antes del deploy pide un chunk que ya no está;
// `serve -s` le responde con index.html (200, text/html) y el import() falla.
// Lo que corresponde es recargar para traer el index.html nuevo — UNA sola vez:
// si el chunk falla de nuevo (red caída), recargar en loop no ayuda a nadie.
const CLAVE_RECARGA = 'mls-recarga-por-chunk';
const VENTANA_ANTI_LOOP_MS = 60_000;

/** Recarga la página si no se recargó ya por este motivo hace poco. Devuelve si recargó. */
export function recargarPorChunkFaltante(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
    if (Date.now() - ultima < VENTANA_ANTI_LOOP_MS) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    // Sin sessionStorage (modo privado estricto) no hay guarda anti-loop: mejor no recargar.
    return false;
  }
  window.location.reload();
  return true;
}

type Cargador<T extends ComponentType<any>> = () => Promise<{ default: T }>;

/**
 * `React.lazy` que, si el chunk no se puede traer, recarga la página una vez.
 * Mientras recarga la promesa queda pendiente (se sigue viendo el fallback de
 * Suspense); si ya se recargó hace poco, el error sigue su camino hasta el
 * ErrorBoundary de rutas.
 */
export function lazyConRecarga<T extends ComponentType<any>>(cargar: Cargador<T>) {
  return lazy(() =>
    cargar().catch((err) => {
      if (recargarPorChunkFaltante()) return new Promise<never>(() => {});
      throw err;
    }),
  );
}

// ── Cargadores (una sola definición: los usan lazy() y la precarga) ──────────
export const cargar = {
  productos: () => import('../pages/Productos'),
  productoDetalle: () => import('../pages/ProductoDetalle'),
  carrito: () => import('../pages/Carrito'),
  checkout: () => import('../pages/Checkout'),
  pago: () => import('../pages/Pago'),
  confirmacion: () => import('../pages/Confirmacion'),
};

// ── Precarga: bajar el chunk de la pantalla siguiente ANTES de que se pida ───
// Dividir tiene un costo: la primera navegación a cada pantalla espera su chunk.
// Se compensa trayéndolos en un momento ocioso, según dónde está la persona.
// Un chunk precargado queda en el caché de módulos: el import() posterior es
// instantáneo. Los errores se ignoran (la navegación real los vuelve a intentar).
const SIGUIENTES: [RegExp, (keyof typeof cargar)[]][] = [
  [/^\/$/, ['productos', 'productoDetalle']],
  [/^\/productos\/[^/]+/, ['carrito', 'checkout']],
  [/^\/productos\/?$/, ['productoDetalle', 'carrito']],
  [/^\/carrito/, ['checkout', 'pago', 'confirmacion']],
  [/^\/checkout/, ['pago', 'confirmacion']],
];

export function precargarSiguientes(pathname: string): void {
  const destino = SIGUIENTES.find(([patron]) => patron.test(pathname))?.[1];
  if (!destino) return;
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  const correr = () => destino.forEach((k) => void cargar[k]().catch(() => {}));
  // Safari no tiene requestIdleCallback: un timeout alcanza para no competir con el render.
  if (idle) idle(correr);
  else window.setTimeout(correr, 1500);
}

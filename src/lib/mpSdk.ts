// Carga del SDK de Mercado Pago (MercadoPago.js V2) para la pantalla de pago.
//
// Una sola carga compartida: todas las llamadas a `cargarSdkMp()` reciben la
// MISMA promesa. Eso resuelve dos cosas que el efecto de Pago.tsx hacía mal:
//  - Si el <script> ya estaba en el DOM pero todavía no había terminado de
//    cargar (segundo montaje del efecto en dev con StrictMode, o alguien que
//    entra a una segunda orden antes de que cargue), se lo daba por listo y
//    `new window.MercadoPago(...)` fallaba con "is not a constructor".
//  - Si el script no llegaba (sin conexión, un bloqueador de anuncios frenando
//    mercadopago.com) nadie se enteraba: no se escuchaba `onerror`.

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const SDK_ID = 'mp-sdk';

let carga: Promise<void> | null = null;

/** Resuelve cuando el script del SDK terminó de cargar; rechaza si falló. */
export function cargarSdkMp(): Promise<void> {
  if (carga) return carga;
  carga = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SDK_ID;
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      // Se saca el <script> y se suelta la promesa: un reintento arranca de cero.
      reiniciarCargaSdkMp();
      reject(new Error('El SDK de Mercado Pago no cargó'));
    };
    document.body.appendChild(script);
  });
  return carga;
}

/** Descarta la carga en curso (o fallida) para que el próximo `cargarSdkMp()` pida el script de nuevo. */
export function reiniciarCargaSdkMp(): void {
  document.getElementById(SDK_ID)?.remove();
  carga = null;
}

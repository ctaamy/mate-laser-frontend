// Limpieza de URLs antes de mandarlas a la analítica (Umami). Módulo puro, sin
// dependencias del browser: lo usa lib/analytics.ts y lo prueban los e2e.
//
// Umami manda la URL completa de cada página, con su query string. Varias
// pantallas llevan secretos en la URL: tokens de login con Google, de reset de
// contraseña, de verificación de email y de baja del newsletter, y el id de un
// pedido en /confirmacion/<uuid> (esa URL es la llave de acceso a la orden).

// Rutas cuyo query string lleva un secreto: no se manda nada de él.
const RUTAS_CON_QUERY_SECRETO = [
  '/auth/google/callback',
  '/resetear-password',
  '/verificar-email',
  '/baja-newsletter',
  '/confirmar-newsletter',
];

// Rutas con el id de un pedido en el path: ese UUID es la llave de acceso a la
// orden (dirección, teléfono, items). Se reemplaza por un comodín.
const RUTAS_CON_ID_DE_PEDIDO = /^(\/(?:confirmacion|pago)\/|\/mi-cuenta\/pedidos\/)[^/?#]+/i;

// Parámetros que nunca se mandan, en la ruta que sea.
const PARAMS_SECRETOS = ['token', 'refreshToken'];

/**
 * Deja una URL lista para la analítica: sin tokens ni ids de pedido, y conserva
 * el resto (por ejemplo `?utm_source=…`). Acepta una URL completa o un path;
 * devuelve lo mismo que recibió pero limpio. Si no se puede interpretar, la
 * devuelve igual (una URL rara no debe romper el envío).
 */
export function limpiarUrlParaAnalitica(url: string): string {
  if (!url) return url;
  try {
    const completa = /^https?:\/\//i.test(url);
    const u = new URL(url, 'https://base.invalid');
    u.pathname = u.pathname.replace(RUTAS_CON_ID_DE_PEDIDO, '$1:id');
    if (RUTAS_CON_QUERY_SECRETO.includes(u.pathname.replace(/\/+$/, ''))) {
      u.search = '';
    } else {
      for (const p of PARAMS_SECRETOS) u.searchParams.delete(p);
    }
    return completa ? u.toString() : `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

/** Hook de Umami (`data-before-send`): recibe (tipo, payload) y devuelve el payload a enviar. */
export function antesDeEnviarAUmami(_tipo: string, payload: { url?: string; [k: string]: unknown }) {
  if (payload && typeof payload.url === 'string') {
    payload.url = limpiarUrlParaAnalitica(payload.url);
  }
  return payload;
}

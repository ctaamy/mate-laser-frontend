// Errores del Payment Brick de Mercado Pago que Pago.tsx sabe interpretar
// (ver docs/propuesta-aviso-tarjeta-debito-brick.md en el monorepo mate-laser).

// El Brick emite esto cuando el tipo de la tarjeta (crédito / débito / prepaga)
// no corresponde a la sección abierta: por ejemplo, una Visa débito escrita en
// "Tarjeta de crédito" — o autocompletada por el navegador. Llega como
// onError({ type: 'non_critical', cause: 'missing_payment_information',
// message: 'payment_method_not_in_allowed_types' }).
//
// Es un identificador interno de MP, no un texto de UI documentado, y el SDK
// (sdk.mercadopago.com/js/v2) no tiene versión fija. Por eso se compara SOLO
// `message`, con igualdad estricta:
//   · no `cause`: es un bucket genérico que MP puede reutilizar para otros fallos;
//   · no includes/regex: hay "hermanos" (no_payment_method_for_provided_bin,
//     payment_method_not_in_allowed_methods, no_issuers_found_for_card) que NO
//     son este caso y mostrarían un aviso incorrecto.
// Si MP lo renombra, esto da `false` y queda el comportamiento de antes del
// aviso (el mensaje del propio Brick), sin romper nada.
export const MP_ERROR_TARJETA_EN_SECCION_EQUIVOCADA = 'payment_method_not_in_allowed_types';

export function esTarjetaEnSeccionEquivocada(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { message?: unknown }).message === MP_ERROR_TARJETA_EN_SECCION_EQUIVOCADA
  );
}

// Datos para medir los errores del Brick (Umami). Solo salen etiquetas con
// forma de identificador (minúsculas y guion bajo); cualquier otra cosa se
// reemplaza por 'otro'. Así no viaja texto libre ni nada que se parezca a un
// dato de la tarjeta — y el BIN nunca entra acá: ni se recibe ni se loguea.
const ETIQUETA = /^[a-z_]{1,64}$/;

function etiqueta(valor: unknown): string {
  return typeof valor === 'string' && ETIQUETA.test(valor) ? valor : 'otro';
}

export function datosParaMedirErrorDelBrick(
  err: unknown,
): { tipo: string; causa: string; mensaje: string } | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as Record<string, unknown>;
  return { tipo: etiqueta(e.type), causa: etiqueta(e.cause), mensaje: etiqueta(e.message) };
}

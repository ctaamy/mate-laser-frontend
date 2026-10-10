// Tokens que el backend entrega tras un login con Google (GET /auth/google/callback).
//
// Antes viajaban en la query (`?token=…&refreshToken=…`), y por eso quedaban en el historial
// del navegador y en cualquier log que guarde la URL. Ahora vienen en el FRAGMENTO (`#…`), que
// el navegador nunca manda a ningún servidor. Se sigue aceptando la query como respaldo para
// el momento del deploy en que el frontend nuevo ya está pero el backend todavía redirige
// como antes; se puede quitar después.
export function leerTokensDeGoogle(hash: string, search: string): { token: string; refreshToken: string } | null {
  for (const crudo of [hash, search]) {
    const params = new URLSearchParams(crudo.replace(/^[#?]/, ''));
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    if (token && refreshToken) return { token, refreshToken };
  }
  return null;
}

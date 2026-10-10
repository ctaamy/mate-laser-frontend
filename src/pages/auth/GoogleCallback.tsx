import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { leerTokensDeGoogle } from '../../lib/tokensGoogle';

// El backend redirige acá tras un login con Google exitoso, con el token y el
// refreshToken en el fragmento de la URL (GET /auth/google/callback en el backend).
export default function GoogleCallback() {
  const navigate = useNavigate();
  const { loginConToken } = useAuthStore();
  const yaProcesado = useRef(false);

  useEffect(() => {
    if (yaProcesado.current) return;
    yaProcesado.current = true;

    const tokens = leerTokensDeGoogle(window.location.hash, window.location.search);

    // Sacar los tokens de la barra de direcciones de inmediato: así no quedan en el historial
    // del navegador ni se copian si el usuario comparte o recarga la página.
    window.history.replaceState(null, '', window.location.pathname);

    if (!tokens) {
      navigate('/login?error=google_denied', { replace: true });
      return;
    }

    loginConToken(tokens.token, tokens.refreshToken)
      .then(() => navigate('/', { replace: true }))
      .catch(() => navigate('/login?error=google_denied', { replace: true }));
  }, [navigate, loginConToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <p className="text-sm text-black/40">Iniciando sesión con Google...</p>
    </div>
  );
}

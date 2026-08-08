import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

// El backend redirige acá tras un login con Google exitoso, con el token
// y el refreshToken en query params (GET /auth/google/callback en el backend).
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginConToken } = useAuthStore();
  const yaProcesado = useRef(false);

  useEffect(() => {
    if (yaProcesado.current) return;
    yaProcesado.current = true;

    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (!token || !refreshToken) {
      navigate('/login?error=google_denied', { replace: true });
      return;
    }

    loginConToken(token, refreshToken)
      .then(() => navigate('/', { replace: true }))
      .catch(() => navigate('/login?error=google_denied', { replace: true }));
  }, [searchParams, navigate, loginConToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <p className="text-sm text-black/40">Iniciando sesión con Google...</p>
    </div>
  );
}

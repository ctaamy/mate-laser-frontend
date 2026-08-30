import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

type Estado = 'verificando' | 'ok' | 'error';

export default function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  // StrictMode monta dos veces en dev: evitamos consumir el token dos veces.
  const yaLlamado = useRef(false);

  useEffect(() => {
    if (yaLlamado.current) return;
    yaLlamado.current = true;

    if (!token) {
      setEstado('error');
      setMensaje('El link de verificación no es válido. Pedí uno nuevo desde tu cuenta.');
      return;
    }

    api
      .get('/auth/verificar-email', { params: { token } })
      .then((res) => {
        setEstado('ok');
        setMensaje(res.data?.mensaje || 'Tu email quedó verificado.');
      })
      .catch((err) => {
        setEstado('error');
        setMensaje(
          err.response?.data?.message ||
            'No pudimos verificar tu email. El link puede haber vencido o ya haber sido usado.',
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">
            mate<span className="font-light">laser</span> studio
          </Link>
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Verificación de email</p>
        </div>

        {estado === 'verificando' && (
          <p className="text-sm text-black/70">Estamos verificando tu email…</p>
        )}

        {estado === 'ok' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70">{mensaje}</p>
            <Link
              to="/mi-cuenta"
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors"
            >
              Ir a mi cuenta
            </Link>
          </div>
        )}

        {estado === 'error' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70">{mensaje}</p>
            <Link
              to="/mi-cuenta"
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors"
            >
              Reenviar verificación
            </Link>
            <Link to="/login" className="text-xs text-black/40 hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

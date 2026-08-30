import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

type Estado = 'procesando' | 'ok' | 'error';

export default function BajaNewsletter() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [estado, setEstado] = useState<Estado>('procesando');
  const [mensaje, setMensaje] = useState('');
  const yaLlamado = useRef(false);

  useEffect(() => {
    if (yaLlamado.current) return;
    yaLlamado.current = true;

    if (!token || token === 'PRUEBA') {
      setEstado('error');
      setMensaje('Este link de baja no es válido.');
      return;
    }

    api
      .post('/newsletter/baja', { token })
      .then(() => {
        setEstado('ok');
        setMensaje('Listo, te diste de baja. No vas a recibir más correos de novedades.');
      })
      .catch((err) => {
        setEstado('error');
        setMensaje(err.response?.data?.message || 'No pudimos procesar la baja. Probá de nuevo más tarde.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">
            mate<span className="font-light">laser</span> studio
          </Link>
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Baja de novedades</p>
        </div>

        {estado === 'procesando' && <p className="text-sm text-black/70">Procesando tu baja…</p>}

        {estado !== 'procesando' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70">{mensaje}</p>
            <Link
              to="/"
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors"
            >
              Volver a la tienda
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

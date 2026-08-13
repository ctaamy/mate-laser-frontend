import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import FormError from '../components/ui/FormError';

const MENSAJE_GENERICO =
  'Si el email está registrado, vas a recibir un correo con instrucciones para recuperar tu contraseña';

export default function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/olvide-password', { email });
      // Mostramos siempre el mismo mensaje genérico, exista o no el email en el sistema.
      setEnviado(true);
    } catch (err: any) {
      // Solo distinguimos errores de red/backend genuinos (backend caído, timeout).
      // Un 4xx del backend igual no debería filtrar si el email existe.
      if (err.response) {
        setEnviado(true);
      } else {
        setError('No pudimos conectarnos. Probá de nuevo en unos minutos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm">
        <div className="text-center mb-7">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">
            mate<span className="font-light">laser</span> studio
          </Link>
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70 text-center">{MENSAJE_GENERICO}</p>
            <Link
              to="/login"
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors text-center"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-xs text-black/50">
              Ingresá tu email y te vamos a enviar un link para restablecer tu contraseña.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="off"
                className="border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/25"
              />
            </div>

            <FormError mensaje={error} />

            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors disabled:opacity-50 mt-1"
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperación'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-black/40 mt-5">
          <Link to="/login" className="text-black font-medium hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

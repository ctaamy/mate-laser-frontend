import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import FormError from '../components/ui/FormError';
import { validarPassword } from '../lib/validation';

export default function ResetearPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
        <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm text-center">
          <p className="text-sm text-black/70 mb-5">
            Este link no es válido. Pedí uno nuevo para restablecer tu contraseña.
          </p>
          <Link
            to="/olvide-password"
            className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors inline-block w-full"
          >
            Olvidé mi contraseña
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errorValidacion = validarPassword(password);
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/resetear-password', { token, password });
      setExito(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      // Errores puntuales del backend: token vencido, ya usado o inválido.
      setError(err.response?.data?.message || 'No pudimos restablecer tu contraseña');
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
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Restablecer contraseña</p>
        </div>

        {exito ? (
          <p className="text-sm text-black/70 text-center">
            Contraseña actualizada correctamente. Te vamos a redirigir para que inicies sesión...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/25"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/25"
              />
            </div>

            <FormError mensaje={error} />

            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors disabled:opacity-50 mt-1"
            >
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

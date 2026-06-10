import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  try {
    await login(email, password);
    navigate('/');
  } catch (err: any) {
    console.log('Error:', err);
    setError(err.response?.data?.message || 'Credenciales inválidas');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <Link to="/" className="text-lg font-medium">
            mate<span className="text-[#0F6E56]">laser</span> studio
          </Link>
          <p className="text-sm text-gray-500 mt-1">Iniciá sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="off"
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-medium">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors disabled:opacity-50"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-[#1D9E75] hover:underline">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
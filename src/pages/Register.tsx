import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export default function Register() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    telefono: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrarse');
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
          <p className="text-sm text-gray-500 mt-1">Creá tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600 font-medium">Nombre</label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="María"
                required
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600 font-medium">Apellido</label>
              <input
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                placeholder="González"
                required
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-medium">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-medium">Contraseña</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              required
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D9E75]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-medium">Teléfono (opcional)</label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="+54 11 XXXX-XXXX"
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
            className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-[#1D9E75] hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
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

  const inputClass = "border border-black/15 px-3 py-2.5 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/25 w-full";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm">
        <div className="text-center mb-7">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">
            mate<span className="font-light">laser</span> studio
          </Link>
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Creá tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Nombre</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="María" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Apellido</label>
              <input name="apellido" value={form.apellido} onChange={handleChange} placeholder="González" required className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@email.com" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" required className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">Teléfono <span className="normal-case font-normal">(opcional)</span></label>
            <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+54 11 XXXX-XXXX" className={inputClass} />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-black/40 mt-5">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-black font-medium hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

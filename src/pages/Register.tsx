import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import FormError from '../components/ui/FormError';
import GoogleButton from '../components/ui/GoogleButton';

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
  const [registrado, setRegistrado] = useState(false);
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
      // La cuenta ya quedó creada y logueada; el mail de verificación se manda
      // en el registro. Mostramos un acuse en vez de tirar directo a Home, así
      // el usuario sabe que tiene que revisar la casilla (verificar no bloquea).
      setRegistrado(true);
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
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">
            {registrado ? 'Cuenta creada' : 'Creá tu cuenta'}
          </p>
        </div>

        {registrado ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Mail size={18} className="text-amber-700" />
            </div>
            <p className="text-sm text-black/70">
              Tu cuenta ya está lista. Te mandamos un mail a{' '}
              <strong className="text-black">{form.email}</strong> para verificarla —
              podés hacerlo cuando quieras, no bloquea tu compra.
            </p>
            <p className="text-xs text-black/40">Revisá spam o la pestaña Promociones si no lo ves.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-black text-white py-2.5 px-6 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors mt-1"
            >
              Ir a la tienda
            </button>
          </div>
        ) : (
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

          <FormError mensaje={error} />

          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        )}

        {!registrado && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-black/10 flex-1" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-black/30">o</span>
              <div className="h-px bg-black/10 flex-1" />
            </div>

            <GoogleButton />

            <p className="text-center text-xs text-black/40 mt-5">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="text-black font-medium hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft, CreditCard, Banknote, Building2 } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useAuthStore } from '../store/auth.store';
import type { MetodoEnvio } from '../types';

const STEPS = ['Carrito', 'Datos de envío', 'Pago', 'Confirmación'];

const provincias = [
  'Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán',
  'Entre Ríos', 'Salta', 'Misiones', 'Chaco', 'Corrientes', 'Santiago del Estero',
  'San Juan', 'Jujuy', 'Río Negro', 'Neuquén', 'Formosa', 'Chubut',
  'San Luis', 'Catamarca', 'La Rioja', 'La Pampa', 'Santa Cruz', 'Tierra del Fuego',
];

const METODOS_PAGO = [
  { id: 'mercadopago', label: 'Mercado Pago', descripcion: 'Tarjeta de crédito, débito, cuotas, QR y más', Icon: CreditCard },
  { id: 'transferencia', label: 'Transferencia bancaria', descripcion: 'Te enviamos los datos por email tras confirmar', Icon: Building2 },
  { id: 'efectivo', label: 'Efectivo', descripcion: 'Coordinamos entrega y pago por WhatsApp', Icon: Banknote },
];

const ICONO_ENVIO: Record<string, string> = {
  retiro: '🏠',
  andreani: '📦',
  correo: '✉️',
};

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, limpiar } = useCarritoStore();
  const { usuario } = useAuthStore();

  const [step, setStep] = useState(2);

  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [apellido, setApellido] = useState(usuario?.apellido || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefono, setTelefono] = useState('');
  const [calle, setCalle] = useState('');
  const [piso, setPiso] = useState('');
  const [cp, setCp] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [metodoEnvioId, setMetodoEnvioId] = useState<number | null>(null);
  const [quienRecibe, setQuienRecibe] = useState('');
  const [especificaciones, setEspecificaciones] = useState('');
  const [metodoPago, setMetodoPago] = useState('mercadopago');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sub = subtotal();

  const { data: envios } = useQuery<MetodoEnvio[]>({
    queryKey: ['envios', cp, sub],
    queryFn: () => api.post('/envios/calcular', { codigo_postal: cp, subtotal: sub }).then(r => r.data),
    enabled: cp.length >= 4,
  });

  const envioSeleccionado = envios?.find(e => e.id === metodoEnvioId);
  const isRetiro = envioSeleccionado?.proveedor === 'retiro';
  const isPrivada = !!envioSeleccionado && !['retiro', 'andreani', 'correo'].includes(envioSeleccionado.proveedor);
  const costoEnvio = envioSeleccionado?.costo ?? 0;
  const total = sub + costoEnvio;

  const inputClass = (field: string) =>
    `border px-3 py-2.5 text-sm focus:outline-none w-full transition-colors bg-white ${
      errors[field]
        ? 'border-red-300 bg-red-50'
        : 'border-black/15 focus:border-black placeholder-black/25'
    }`;

  const validateDatos = () => {
    const e: Record<string, string> = {};
    if (!nombre) e.nombre = 'Requerido';
    if (!apellido) e.apellido = 'Requerido';
    if (!email) e.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
    if (!telefono) e.telefono = 'Requerido';
    if (metodoEnvioId === null) e.envio = 'Seleccioná un método de envío';
    if (!isRetiro) {
      if (!calle) e.calle = 'Requerido';
      if (!cp) e.cp = 'Requerido';
      if (!ciudad) e.ciudad = 'Requerido';
      if (!provincia) e.provincia = 'Requerido';
    }
    if (isPrivada && !quienRecibe) e.quienRecibe = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinuar = () => {
    if (validateDatos()) { setErrors({}); setStep(3); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const direccionEnvio = isRetiro
        ? { tipo: 'retiro' }
        : {
            calle, piso, cp, ciudad, provincia, pais: 'Argentina',
            ...(isPrivada && { quien_recibe: quienRecibe, especificaciones: especificaciones || undefined }),
          };

      const { data } = await api.post('/ordenes', {
        direccion_envio: direccionEnvio,
        metodo_envio_id: metodoEnvioId,
        metodo_envio_nombre: envioSeleccionado?.nombre,
        subtotal: sub,
        costo_envio: costoEnvio,
        descuento: 0,
        total,
        metodo_pago: metodoPago,
        nombre_cliente: nombre,
        apellido_cliente: apellido,
        email_cliente: email,
        telefono_cliente: telefono,
        items: items.map(item => ({
          producto_id: item.producto_id,
          variante_id: item.variante_id,
          nombre_producto: item.nombre_producto,
          color: item.color,
          texto_grabado: item.texto_grabado,
          precio_unitario: item.precio_unitario,
          cantidad: item.cantidad,
          subtotal: item.precio_unitario * item.cantidad,
        })),
      });

      if (metodoPago === 'mercadopago') {
        navigate(`/pago/${data.id}`);
      } else {
        limpiar();
        navigate(`/confirmacion/${data.id}`);
      }
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Error al procesar la orden' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* STEPPER */}
      <div className="flex items-center justify-center gap-2 mb-10 text-xs">
        {STEPS.map((label, i) => {
          const active = (i === 1 && step === 2) || (i === 2 && step === 3);
          const done = i === 0 || (i === 1 && step === 3);
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${active ? 'text-black font-medium' : done ? 'text-black/40' : 'text-black/20'}`}>
                <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-medium ${
                  active ? 'bg-black text-white' : done ? 'bg-black/10 text-black/50' : 'border border-black/15 text-black/20'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                {label}
              </div>
              {i < 3 && <div className={`w-8 h-px ${done ? 'bg-black/30' : 'bg-black/10'}`} />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 flex flex-col gap-5">

          {errors.general && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errors.general}
            </div>
          )}

          {/* ── PASO 2: DATOS + ENVÍO ── */}
          {step === 2 && (
            <>
              {/* Datos personales */}
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Datos personales</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Nombre *</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass('nombre')} placeholder="María" />
                    {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Apellido *</label>
                    <input value={apellido} onChange={e => setApellido(e.target.value)} className={inputClass('apellido')} placeholder="González" />
                    {errors.apellido && <p className="text-xs text-red-500 mt-1">{errors.apellido}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Email *</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass('email')} placeholder="tu@email.com" type="email" />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Teléfono *</label>
                    <input value={telefono} onChange={e => setTelefono(e.target.value)} className={inputClass('telefono')} placeholder="+54 11 XXXX-XXXX" />
                    {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
                  </div>
                </div>
              </div>

              {/* Método de envío */}
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Método de envío</h3>

                {!envios && cp.length < 4 && (
                  <p className="text-sm text-black/30 py-2">Ingresá tu código postal para ver las opciones disponibles.</p>
                )}
                {!envios && cp.length >= 4 && (
                  <div className="text-sm text-black/30 py-4 text-center">Cargando opciones…</div>
                )}
                {envios?.length === 0 && (
                  <div className="text-sm text-black/30 py-4 text-center">No hay métodos disponibles para tu zona.</div>
                )}
                {envios && envios.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {envios.map((envio) => {
                      const activo = metodoEnvioId === envio.id;
                      const icono = ICONO_ENVIO[envio.proveedor] ?? '🚚';
                      return (
                        <div
                          key={envio.id}
                          onClick={() => setMetodoEnvioId(envio.id)}
                          className={`flex items-center gap-3 border px-4 py-3.5 cursor-pointer transition-colors ${
                            activo ? 'border-black bg-black/[0.02]' : 'border-black/[0.07] hover:border-black/20'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? 'border-black' : 'border-black/20'}`}>
                            {activo && <div className="w-2 h-2 bg-black rounded-full" />}
                          </div>
                          <span className="text-base flex-shrink-0">{icono}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-black">{envio.nombre}</div>
                            <div className="text-xs text-black/40 mt-0.5">{envio.descripcion}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {(envio as any).envio_gratis && envio.proveedor !== 'retiro' ? (
                              <div>
                                <div className="text-xs text-black/30 line-through">${Number((envio as any).costo_original || 0).toLocaleString('es-AR')}</div>
                                <div className="text-sm font-bold text-black">Gratis</div>
                              </div>
                            ) : envio.costo === 0 ? (
                              <div className="text-sm font-bold text-black">Gratis</div>
                            ) : (
                              <div className="text-sm font-semibold text-black">${envio.costo.toLocaleString('es-AR')}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {errors.envio && <p className="text-xs text-red-500 mt-2">{errors.envio}</p>}

                {isRetiro && (
                  <div className="mt-3 border border-black/[0.07] bg-black/[0.02] px-4 py-3 text-xs text-black/60">
                    📍 Te contactaremos por WhatsApp para coordinar el retiro.
                  </div>
                )}
              </div>

              {/* Dirección (oculta si es retiro) */}
              {!isRetiro && (
                <div className="border border-black/[0.07] p-5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Dirección de envío</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Calle y número *</label>
                      <input value={calle} onChange={e => setCalle(e.target.value)} className={inputClass('calle')} placeholder="Av. Corrientes 1234" />
                      {errors.calle && <p className="text-xs text-red-500 mt-1">{errors.calle}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Piso / Depto</label>
                      <input value={piso} onChange={e => setPiso(e.target.value)} className={inputClass('piso')} placeholder="3° B" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Código postal *</label>
                      <input value={cp} onChange={e => setCp(e.target.value)} className={inputClass('cp')} placeholder="1043" />
                      {errors.cp && <p className="text-xs text-red-500 mt-1">{errors.cp}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Ciudad *</label>
                      <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputClass('ciudad')} placeholder="Buenos Aires" />
                      {errors.ciudad && <p className="text-xs text-red-500 mt-1">{errors.ciudad}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Provincia *</label>
                      <select value={provincia} onChange={e => setProvincia(e.target.value)} className={inputClass('provincia')}>
                        <option value="">Seleccioná</option>
                        {provincias.map(p => <option key={p}>{p}</option>)}
                      </select>
                      {errors.provincia && <p className="text-xs text-red-500 mt-1">{errors.provincia}</p>}
                    </div>

                    {/* Campos extra para logística privada */}
                    {isPrivada && (
                      <>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Quién recibe *</label>
                          <input
                            value={quienRecibe}
                            onChange={e => setQuienRecibe(e.target.value)}
                            className={inputClass('quienRecibe')}
                            placeholder="Nombre completo de quien recibe el paquete"
                          />
                          {errors.quienRecibe && <p className="text-xs text-red-500 mt-1">{errors.quienRecibe}</p>}
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Especificaciones de entrega</label>
                          <textarea
                            value={especificaciones}
                            onChange={e => setEspecificaciones(e.target.value)}
                            className={`${inputClass('especificaciones')} resize-none`}
                            rows={3}
                            placeholder="Ej: no tiene timbre, llamar al portero, dejar con el vecino del 2B, horario preferido…"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/carrito')}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium border border-black/15 hover:border-black/40 transition-colors text-black/60"
                >
                  <ArrowLeft size={13} /> Volver al carrito
                </button>
                <button
                  onClick={handleContinuar}
                  className="flex-1 bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors"
                >
                  Continuar al pago →
                </button>
              </div>
            </>
          )}

          {/* ── PASO 3: PAGO ── */}
          {step === 3 && (
            <>
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Método de pago</h3>
                <div className="flex flex-col gap-2">
                  {METODOS_PAGO.map(({ id, label, descripcion, Icon }) => {
                    const activo = metodoPago === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setMetodoPago(id)}
                        className={`flex items-center gap-4 border px-4 py-4 cursor-pointer transition-colors ${
                          activo ? 'border-black bg-black/[0.02]' : 'border-black/[0.07] hover:border-black/20'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? 'border-black' : 'border-black/20'}`}>
                          {activo && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                        <Icon size={16} className={activo ? 'text-black' : 'text-black/30'} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-black">{label}</div>
                          <div className="text-xs text-black/40 mt-0.5">{descripcion}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {metodoPago === 'mercadopago' && (
                  <div className="mt-4 bg-black/[0.02] border border-black/[0.06] px-4 py-3 text-sm text-black/50">
                    Al confirmar se abre el formulario de pago de <strong className="text-black/70">Mercado Pago</strong> directamente en esta página. Podés pagar con tarjeta de crédito, débito o en cuotas.
                  </div>
                )}
                {metodoPago === 'transferencia' && (
                  <div className="mt-4 bg-black/[0.02] border border-black/[0.06] px-4 py-3 text-sm text-black/50">
                    Al confirmar te enviamos los <strong className="text-black/70">datos bancarios por email</strong>. Tu pedido queda reservado por 48 hs mientras realizás la transferencia.
                  </div>
                )}
                {metodoPago === 'efectivo' && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    Al confirmar te contactamos por <strong>WhatsApp</strong> para coordinar la entrega y el pago. El pedido queda reservado por <strong>3 días hábiles</strong>.
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(2); setErrors({}); }}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium border border-black/15 hover:border-black/40 transition-colors text-black/60"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Shield size={13} />
                  {loading ? 'Procesando...' : 'Confirmar y pagar'}
                </button>
              </div>
            </>
          )}

        </div>

        {/* RESUMEN */}
        <div className="flex flex-col gap-4">
          <div className="border border-black/[0.07] p-5 sticky top-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Resumen</h3>
            <div className="flex flex-col gap-3 mb-4">
              {items.map((item) => (
                <div key={item.producto_id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/[0.04] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imagen_url
                      ? <img src={item.imagen_url} alt="" className="w-full h-full object-cover" />
                      : <span className="opacity-20 text-lg">☕</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-black truncate">{item.nombre_producto}</div>
                    {item.texto_grabado && <div className="text-xs text-black/40 truncate italic">"{item.texto_grabado}"</div>}
                    <div className="text-[10px] text-black/30">x{item.cantidad}</div>
                  </div>
                  <div className="text-xs font-semibold text-black">${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</div>
                </div>
              ))}
            </div>
            <div className="h-px bg-black/[0.07] mb-3" />
            <div className="flex flex-col gap-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-black/40">Subtotal</span>
                <span>${sub.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/40">Envío</span>
                <span className={metodoEnvioId !== null ? 'font-medium text-black' : 'text-black/30 text-xs'}>
                  {metodoEnvioId === null
                    ? 'A calcular'
                    : costoEnvio === 0 ? 'Gratis'
                    : `$${costoEnvio.toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>
            <div className="h-px bg-black/[0.07] mb-3" />
            <div className="flex justify-between font-semibold text-black">
              <span>Total</span>
              <span className="text-lg">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

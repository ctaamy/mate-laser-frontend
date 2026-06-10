import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useAuthStore } from '../store/auth.store';
import type { MetodoEnvio } from '../types';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, limpiar } = useCarritoStore();
  const { usuario } = useAuthStore();

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
  const [metodoPago, setMetodoPago] = useState('mercadopago');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

    const { data: envios } = useQuery<MetodoEnvio[]>({
    queryKey: ['envios'],
    queryFn: () => api.post('/envios/calcular', { codigo_postal: cp || '1000' }).then(r => r.data),
  });
  const isRetiro = metodoEnvioId !== null &&
    envios?.find(e => e.id === metodoEnvioId)?.proveedor === 'retiro';

  const sub = subtotal();
  const envioSeleccionado = envios?.find(e => e.id === metodoEnvioId);
  const costoEnvio = envioSeleccionado?.costo || 0;
  const total = sub + costoEnvio;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nombre) e.nombre = 'Requerido';
    if (!apellido) e.apellido = 'Requerido';
    if (!email) e.email = 'Requerido';
    if (!telefono) e.telefono = 'Requerido';
    if (metodoEnvioId === null) e.envio = 'Seleccioná un método de envío';
    if (!isRetiro) {
      if (!calle) e.calle = 'Requerido';
      if (!cp) e.cp = 'Requerido';
      if (!ciudad) e.ciudad = 'Requerido';
      if (!provincia) e.provincia = 'Requerido';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const direccionEnvio = isRetiro
        ? { tipo: 'retiro' }
        : { calle, piso, cp, ciudad, provincia, pais: 'Argentina' };

      const { data } = await api.post('/ordenes', {
        direccion_envio: direccionEnvio,
        metodo_envio_id: metodoEnvioId,
        metodo_envio_nombre: envioSeleccionado?.nombre,
        subtotal: sub,
        costo_envio: costoEnvio,
        descuento: 0,
        total,
        metodo_pago: metodoPago,
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

      limpiar();
      navigate(`/confirmacion/${data.id}`);
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Error al procesar la orden' });
    } finally {
      setLoading(false);
    }
  };

  const provincias = [
    'Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán',
    'Entre Ríos', 'Salta', 'Misiones', 'Chaco', 'Corrientes', 'Santiago del Estero',
    'San Juan', 'Jujuy', 'Río Negro', 'Neuquén', 'Formosa', 'Chubut',
    'San Luis', 'Catamarca', 'La Rioja', 'La Pampa', 'Santa Cruz', 'Tierra del Fuego',
  ];

  const inputClass = (field: string) =>
    `border rounded-lg px-3 py-2.5 text-sm focus:outline-none w-full ${errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[#1D9E75]'}`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* STEPS */}
      <div className="flex items-center justify-center gap-2 mb-8 text-xs">
        {['Carrito', 'Datos de envío', 'Pago', 'Confirmación'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 1 ? 'text-[#0F6E56] font-medium' : i < 1 ? 'text-gray-400' : 'text-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${i === 1 ? 'bg-[#1D9E75] text-white' : i < 1 ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'border border-gray-200 text-gray-300'}`}>
                {i < 1 ? '✓' : i + 1}
              </div>
              {step}
            </div>
            {i < 3 && <div className={`w-8 h-px ${i < 1 ? 'bg-[#1D9E75]' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-5">

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {errors.general}
            </div>
          )}

          {/* DATOS PERSONALES */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Datos personales</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass('nombre')} placeholder="María" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Apellido *</label>
                <input value={apellido} onChange={e => setApellido(e.target.value)} className={inputClass('apellido')} placeholder="González" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass('email')} placeholder="tu@email.com" type="email" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Teléfono *</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} className={inputClass('telefono')} placeholder="+54 11 XXXX-XXXX" />
              </div>
            </div>
          </div>

          {/* MÉTODO DE ENVÍO */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Método de envío</h3>
            <div className="flex flex-col gap-2">
              {envios?.map((envio) => (
                <div
                  key={envio.id}
                  onClick={() => setMetodoEnvioId(envio.id)}
                  className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${metodoEnvioId === envio.id ? 'border-[#1D9E75] bg-[#E1F5EE]' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${metodoEnvioId === envio.id ? 'border-[#1D9E75]' : 'border-gray-300'}`}>
                    {metodoEnvioId === envio.id && <div className="w-2 h-2 bg-[#1D9E75] rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{envio.nombre}</div>
                    <div className="text-xs text-gray-400">{envio.descripcion}</div>
                  </div>
                  <div className="text-sm font-medium text-[#0F6E56]">
                    {envio.costo === 0 ? 'Gratis' : `$${envio.costo.toLocaleString('es-AR')}`}
                  </div>
                </div>
              ))}
            </div>
            {errors.envio && <div className="text-xs text-red-500 mt-2">{errors.envio}</div>}
            {isRetiro && (
              <div className="mt-3 bg-[#E1F5EE] rounded-lg px-4 py-3 text-xs text-[#0F6E56]">
                📍 Te contactaremos por WhatsApp para coordinar el retiro.
              </div>
            )}
          </div>

          {/* DIRECCIÓN */}
          {!isRetiro && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-sm font-medium mb-4">Dirección de envío</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Calle y número *</label>
                  <input value={calle} onChange={e => setCalle(e.target.value)} className={inputClass('calle')} placeholder="Av. Corrientes 1234" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Piso / Depto</label>
                  <input value={piso} onChange={e => setPiso(e.target.value)} className={inputClass('piso')} placeholder="3° B" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Código postal *</label>
                  <input value={cp} onChange={e => setCp(e.target.value)} className={inputClass('cp')} placeholder="1043" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ciudad *</label>
                  <input value={ciudad} onChange={e => setCiudad(e.target.value)} className={inputClass('ciudad')} placeholder="Buenos Aires" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Provincia *</label>
                  <select value={provincia} onChange={e => setProvincia(e.target.value)} className={inputClass('provincia')}>
                    <option value="">Seleccioná</option>
                    {provincias.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* MÉTODO DE PAGO */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Método de pago</h3>
            <div className="flex gap-2 border border-gray-200 rounded-lg overflow-hidden mb-4">
              {[
                { id: 'mercadopago', label: 'Mercado Pago' },
                { id: 'tarjeta', label: 'Tarjeta' },
                { id: 'transferencia', label: 'Transferencia' },
                { id: 'efectivo', label: 'Efectivo' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetodoPago(m.id)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${metodoPago === m.id ? 'bg-[#1D9E75] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {metodoPago === 'mercadopago' && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 text-center">
                Al confirmar serás redirigido a <strong className="text-gray-700">Mercado Pago</strong> para completar el pago.
              </div>
            )}
            {metodoPago === 'transferencia' && (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 text-center">
                Te enviamos los datos bancarios por email tras confirmar.
              </div>
            )}
            {metodoPago === 'efectivo' && (
              <div className="bg-[#FAEEDA] rounded-lg p-4 text-sm text-[#854F0B]">
                Tu pedido quedará reservado por <strong>3 días hábiles</strong>. Te contactaremos para coordinar el pago.
              </div>
            )}
          </div>

        </div>

        {/* RESUMEN */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5 sticky top-4">
            <h3 className="text-sm font-medium mb-4">Resumen</h3>
            <div className="flex flex-col gap-3 mb-4">
              {items.map((item) => (
                <div key={item.producto_id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E1F5EE] rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                    {item.imagen_url ? <img src={item.imagen_url} alt="" className="w-full h-full object-cover rounded-lg" /> : '☕'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.nombre_producto}</div>
                    {item.texto_grabado && <div className="text-xs text-gray-400 truncate">"{item.texto_grabado}"</div>}
                  </div>
                  <div className="text-xs font-medium">${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</div>
                </div>
              ))}
            </div>
            <hr className="border-gray-100 mb-3" />
            <div className="flex flex-col gap-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span>${sub.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Envío</span>
                <span className={costoEnvio === 0 && metodoEnvioId !== null ? 'text-[#0F6E56]' : ''}>
                  {metodoEnvioId === null ? '—' : costoEnvio === 0 ? 'Gratis' : `$${costoEnvio.toLocaleString('es-AR')}`}
                </span>
              </div>
            </div>
            <hr className="border-gray-100 mb-3" />
            <div className="flex justify-between font-medium mb-4">
              <span>Total</span>
              <span className="text-[#0F6E56] text-lg">${total.toLocaleString('es-AR')}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#0F6E56] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shield size={14} />
              {loading ? 'Procesando...' : 'Confirmar y pagar'}
            </button>
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-gray-400">
              <Shield size={12} className="text-[#1D9E75]" /> Pago 100% seguro
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useCarritoStore } from '../store/carrito.store';
import api from '../lib/api';

export default function Carrito() {
  const { items, quitar, actualizarCantidad, subtotal, limpiar } = useCarritoStore();
  const [cupon, setCupon] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [cuponId, setCuponId] = useState('');
  const [cuponError, setCuponError] = useState('');
  const [cuponOk, setCuponOk] = useState('');
  const navigate = useNavigate();

  const ENVIO_GRATIS = 15000;
  const sub = subtotal();
  const total = sub - descuento;
  const faltaParaGratis = Math.max(0, ENVIO_GRATIS - sub);

  const handleCupon = async () => {
    setCuponError('');
    setCuponOk('');
    try {
      const { data } = await api.post('/cupones/validar', { codigo: cupon, subtotal: sub });
      setDescuento(data.descuento);
      setCuponId(data.cupon_id);
      setCuponOk(`Cupón aplicado — ${data.tipo === 'porcentaje' ? `${data.valor}% de descuento` : `$${data.valor} de descuento`}`);
    } catch (err: any) {
      setCuponError(err.response?.data?.message || 'Cupón no válido');
    }
  };

  if (items.length === 0) return (
    <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center gap-4">
      <ShoppingBag size={48} className="text-gray-200" />
      <h2 className="text-lg font-medium text-gray-400">Tu carrito está vacío</h2>
      <Link to="/productos" className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors">
        Ver productos
      </Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* STEPS */}
      <div className="flex items-center justify-center gap-2 mb-8 text-xs">
        {['Carrito', 'Datos de envío', 'Pago', 'Confirmación'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-[#0F6E56] font-medium' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${i === 0 ? 'bg-[#1D9E75] text-white' : 'border border-gray-300 text-gray-400'}`}>
                {i + 1}
              </div>
              {step}
            </div>
            {i < 3 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ITEMS */}
        <div className="col-span-2 flex flex-col gap-3">
          <h2 className="text-base font-medium mb-2">Tu carrito ({items.length} {items.length === 1 ? 'producto' : 'productos'})</h2>
          {items.map((item) => (
            <div key={`${item.producto_id}-${item.variante_id}`} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4">
              <div className="w-16 h-16 bg-[#E1F5EE] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.imagen_url ? (
                  <img src={item.imagen_url} alt={item.nombre_producto} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl opacity-40">☕</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{item.nombre_producto}</div>
                {item.color && <div className="text-xs text-gray-400">Color: {item.color}</div>}
                {item.texto_grabado && (
                  <div className="text-xs text-[#0F6E56] mt-0.5">✏ "{item.texto_grabado}"</div>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1, item.variante_id)}
                      className="px-2 py-1 hover:bg-gray-50"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-3 py-1 text-sm border-x border-gray-200">{item.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1, item.variante_id)}
                      className="px-2 py-1 hover:bg-gray-50"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => quitar(item.producto_id, item.variante_id)}
                    className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-[#0F6E56]">
                  ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                </div>
                <div className="text-xs text-gray-400">c/u ${item.precio_unitario.toLocaleString('es-AR')}</div>
              </div>
            </div>
          ))}
        </div>

        {/* RESUMEN */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-medium">Resumen del pedido</h3>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span>${sub.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Envío</span>
                <span className={sub >= ENVIO_GRATIS ? 'text-[#0F6E56] font-medium' : ''}>
                  {sub >= ENVIO_GRATIS ? 'Gratis' : 'A calcular'}
                </span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-[#0F6E56]">
                  <span>Descuento</span>
                  <span>−${descuento.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="text-[#0F6E56] text-lg">${total.toLocaleString('es-AR')}</span>
            </div>

            {/* CUPÓN */}
            <div className="flex gap-2">
              <input
                type="text"
                value={cupon}
                onChange={(e) => setCupon(e.target.value.toUpperCase())}
                placeholder="Código de descuento"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75]"
              />
              <button
                onClick={handleCupon}
                className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                Aplicar
              </button>
            </div>
            {cuponError && <div className="text-xs text-red-500">{cuponError}</div>}
            {cuponOk && <div className="text-xs text-[#0F6E56]">{cuponOk}</div>}

            {/* ENVÍO GRATIS */}
            {faltaParaGratis > 0 && (
              <div className="bg-[#E1F5EE] rounded-lg p-3 text-xs text-[#0F6E56] flex items-center gap-2">
                🚚 Te faltan <strong>${faltaParaGratis.toLocaleString('es-AR')}</strong> para envío gratis
              </div>
            )}
            {sub >= ENVIO_GRATIS && (
              <div className="bg-[#E1F5EE] rounded-lg p-3 text-xs text-[#0F6E56]">
                🎉 ¡Tenés envío gratis!
              </div>
            )}

            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-[#1D9E75] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#0F6E56] transition-colors"
            >
              Continuar con el envío →
            </button>
            <Link to="/productos" className="text-center text-xs text-gray-400 hover:text-gray-600">
              ← Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center gap-5">
      <ShoppingBag size={40} className="text-black/10" />
      <h2 className="text-base font-medium text-black/40">Tu carrito está vacío</h2>
      <Link
        to="/productos"
        className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors"
      >
        Ver productos
      </Link>
    </div>
  );

  const STEPS = ['Carrito', 'Datos de envío', 'Pago', 'Confirmación'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">

      {/* STEPS */}
      <div className="flex items-center justify-center gap-2 mb-10 text-xs">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-black font-medium' : 'text-black/25'}`}>
              <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-medium ${i === 0 ? 'bg-black text-white' : 'border border-black/20 text-black/25'}`}>
                {i + 1}
              </div>
              {step}
            </div>
            {i < 3 && <div className="w-8 h-px bg-black/10" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">

        {/* ITEMS */}
        <div className="col-span-2 flex flex-col gap-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-3">
            Tu carrito · {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </h2>
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={`${item.producto_id}-${item.variante_id}-${item.texto_grabado}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="border border-black/[0.07] p-4 flex gap-4"
              >
                {/* Imagen */}
                <div className="w-20 h-20 bg-black/[0.03] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt={item.nombre_producto} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl opacity-20">☕</span>
                  )}
                </div>

                {/* Info + controles */}
                <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
                  <div>
                    <div className="text-sm font-semibold text-black leading-tight">{item.nombre_producto}</div>
                    {item.color && (
                      <div className="text-[11px] text-black/40 mt-0.5">Color: {item.color}</div>
                    )}
                    {item.con_grabado && (
                      <div className="mt-2 flex items-center gap-1.5 bg-black text-white px-2.5 py-1 self-start w-fit">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-70">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Grabado láser</span>
                        {item.texto_grabado && (
                          <>
                            <span className="text-[10px] text-white/60 mx-0.5">·</span>
                            <span className="text-[11px] italic text-white/80">"{item.texto_grabado}"</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-black/15">
                      <button
                        onClick={() => actualizarCantidad(item.producto_id, item.cantidad - 1, item.variante_id, item.con_grabado, item.texto_grabado, item.color)}
                        className="w-7 h-7 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-black select-none">{item.cantidad}</span>
                      <button
                        onClick={() => actualizarCantidad(item.producto_id, item.cantidad + 1, item.variante_id, item.con_grabado, item.texto_grabado, item.color)}
                        disabled={item.stock !== undefined && item.cantidad >= item.stock}
                        className="w-7 h-7 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <button
                      onClick={() => quitar(item.producto_id, item.variante_id, item.con_grabado, item.texto_grabado, item.color)}
                      className="text-xs text-black/30 hover:text-black flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={11} /> Eliminar
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-black">
                    ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                  </div>
                  <div className="text-xs text-black/30 mt-0.5">c/u ${item.precio_unitario.toLocaleString('es-AR')}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* RESUMEN */}
        <div className="flex flex-col gap-4">
          <div className="border border-black/[0.07] p-5 flex flex-col gap-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35">Resumen del pedido</h3>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-black/45">Subtotal</span>
                <span className="font-medium">${sub.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/45">Envío</span>
                <span className={sub >= ENVIO_GRATIS ? 'font-medium text-black' : 'text-black/45'}>
                  {sub >= ENVIO_GRATIS ? 'Gratis' : 'A calcular'}
                </span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-black">
                  <span>Descuento</span>
                  <span className="font-medium">−${descuento.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>

            <div className="h-px bg-black/[0.07]" />
            <div className="flex justify-between font-semibold text-black">
              <span>Total</span>
              <span className="text-lg">${total.toLocaleString('es-AR')}</span>
            </div>

            {/* CUPÓN */}
            <div className="flex gap-2">
              <input
                type="text"
                value={cupon}
                onChange={(e) => setCupon(e.target.value.toUpperCase())}
                placeholder="Código de descuento"
                className="flex-1 border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/25"
              />
              <button
                onClick={handleCupon}
                className="border border-black/15 hover:border-black px-3 py-2 text-sm transition-colors"
              >
                Aplicar
              </button>
            </div>
            {cuponError && <div className="text-xs text-red-500">{cuponError}</div>}
            {cuponOk && <div className="text-xs text-black/60">{cuponOk}</div>}

            {/* ENVÍO GRATIS */}
            {faltaParaGratis > 0 && (
              <div className="border border-black/[0.07] bg-black/[0.02] p-3 text-xs text-black/60">
                Te faltan <strong className="text-black">${faltaParaGratis.toLocaleString('es-AR')}</strong> para envío gratis
              </div>
            )}
            {sub >= ENVIO_GRATIS && (
              <div className="border border-black/[0.07] bg-black/[0.02] p-3 text-xs text-black/60">
                ¡Tenés envío gratis!
              </div>
            )}

            <button
              onClick={() => navigate('/checkout')}
              className="w-full bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors"
            >
              Continuar con el envío →
            </button>
            <Link to="/productos" className="text-center text-xs text-black/35 hover:text-black transition-colors">
              ← Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

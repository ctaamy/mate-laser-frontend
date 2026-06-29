import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Truck, Shield, MessageCircle, ChevronRight, Minus, Plus, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';
import type { Producto } from '../types';

const T = { duration: 0.4, ease: 'easeOut' as const };

export default function ProductoDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const [colorSeleccionado, setColorSeleccionado] = useState('');
  const [quierePersonalizar, setQuierePersonalizar] = useState(false);
  const [textoGrabado, setTextoGrabado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [imagenActiva, setImagenActiva] = useState(0);
  const [agregado, setAgregado] = useState(false);
  const agregar = useCarritoStore((s) => s.agregar);
  const mostrarToast = useToastStore((s) => s.agregar);

  const { data: producto, isLoading } = useQuery<Producto>({
    queryKey: ['producto', slug],
    queryFn: () => api.get(`/productos/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });

  if (isLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        className="w-5 h-5 border border-black border-t-transparent rounded-full" />
    </div>
  );

  if (!producto) return (
    <div className="min-h-[60vh] flex items-center justify-center text-sm text-black/40">
      Producto no encontrado
    </div>
  );

  const costoGrabado = Number((producto as any).costo_grabado || 0);
  const precioFinal = Number(producto.precio_base) + (quierePersonalizar ? costoGrabado : 0);
  const tieneDescuento = !!producto.precio_tachado && Number(producto.precio_tachado) > Number(producto.precio_base);
  const descuentoPct = tieneDescuento
    ? Math.round((1 - Number(producto.precio_base) / Number(producto.precio_tachado!)) * 100)
    : 0;

  const handleAgregar = () => {
    agregar({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      precio_unitario: precioFinal,
      cantidad,
      con_grabado: quierePersonalizar || undefined,
      color: quierePersonalizar ? (colorSeleccionado || undefined) : undefined,
      texto_grabado: quierePersonalizar ? (textoGrabado || undefined) : undefined,
      imagen_url: producto.imagenes_producto?.[0]?.url,
    });
    setAgregado(true);
    setTimeout(() => setAgregado(false), 2000);
    mostrarToast(producto.nombre, producto.imagenes_producto?.[0]?.url);
  };

  const colores = Array.isArray(producto.colores_disponibles) ? producto.colores_disponibles : [];
  const imagenes = producto.imagenes_producto ?? [];

  return (
    <div className="min-h-screen bg-white">
      {/* BREADCRUMB */}
      <div className="border-b border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-8 py-3 flex items-center gap-2 text-[11px] text-black/35 font-medium">
          <Link to="/" className="hover:text-black transition-colors">Inicio</Link>
          <ChevronRight size={10} />
          <Link to="/productos" className="hover:text-black transition-colors">Productos</Link>
          <ChevronRight size={10} />
          <span className="text-black/70">{producto.nombre}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">

          {/* ── GALERÍA ── */}
          <div className="flex flex-col gap-3">
            {/* Imagen principal */}
            <div className="relative bg-[#f5f5f5] overflow-hidden" style={{ aspectRatio: '4/5' }}>
              <AnimatePresence mode="wait">
                {imagenes[imagenActiva] ? (
                  <motion.img
                    key={imagenes[imagenActiva].id}
                    src={imagenes[imagenActiva].url}
                    alt={producto.nombre}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={T}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-black/10 text-7xl">☕</div>
                )}
              </AnimatePresence>

              {/* Badge grabado — sobre la imagen */}
              {producto.apto_grabado && (
                <div className="absolute top-0 left-0 flex items-center gap-1.5 bg-black text-white px-3 py-1.5">
                  <Zap size={10} className="opacity-70" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Grabado láser</span>
                </div>
              )}

              {/* Badge descuento */}
              {tieneDescuento && (
                <div className="absolute top-0 right-0 bg-white text-black text-[10px] font-bold px-2.5 py-1.5 border-l border-b border-black/10">
                  -{descuentoPct}%
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {imagenes.length > 1 && (
              <div className="flex gap-2">
                {imagenes.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setImagenActiva(i)}
                    className="relative flex-shrink-0 overflow-hidden transition-opacity"
                    style={{ width: 64, height: 64, opacity: i === imagenActiva ? 1 : 0.45 }}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {i === imagenActiva && (
                      <motion.div layoutId="thumb-border"
                        className="absolute inset-0 border-2 border-black pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── INFO ── */}
          <motion.div className="flex flex-col gap-7"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...T, delay: 0.1 }}>

            {/* Nombre */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black leading-tight mb-2">
                {producto.nombre}
              </h1>
              {producto.descripcion && (
                <p className="text-sm text-black/50 leading-relaxed">{producto.descripcion}</p>
              )}
            </div>

            {/* Precio */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tracking-tight text-black">
                ${precioFinal.toLocaleString('es-AR')}
              </span>
              {tieneDescuento && !quierePersonalizar && (
                <span className="text-base text-black/30 line-through font-medium">
                  ${Number(producto.precio_tachado).toLocaleString('es-AR')}
                </span>
              )}
              {quierePersonalizar && costoGrabado > 0 && (
                <span className="text-xs text-black/35">
                  ${Number(producto.precio_base).toLocaleString('es-AR')} + ${costoGrabado.toLocaleString('es-AR')} grabado
                </span>
              )}
            </div>

            <div className="h-px bg-black/[0.07]" />

            {/* Material */}
            {producto.material && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 mb-2">Material</p>
                <p className="text-sm font-medium text-black">{producto.material}</p>
              </div>
            )}

            {/* Toggle personalización */}
            {producto.apto_grabado && producto.personalizado_habilitado && (
              <div className={`border transition-colors ${quierePersonalizar ? 'border-black' : 'border-black/10'}`}>
                <button
                  onClick={() => setQuierePersonalizar(!quierePersonalizar)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={13} className={quierePersonalizar ? 'text-black' : 'text-black/30'} />
                      <span className="text-sm font-semibold text-black">Grabado personalizado</span>
                    </div>
                    <p className="text-[11px] text-black/40 mt-0.5 pl-5">
                      {costoGrabado > 0 ? `+$${costoGrabado.toLocaleString('es-AR')} adicional` : 'Sin costo adicional'}
                    </p>
                  </div>
                  {/* Toggle switch b&w */}
                  <div className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${quierePersonalizar ? 'bg-black' : 'bg-black/15'}`}>
                    <motion.div
                      className="w-4 h-4 bg-white rounded-full absolute top-0.5"
                      animate={{ left: quierePersonalizar ? '22px' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {quierePersonalizar && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden border-t border-black/[0.07]"
                    >
                      <div className="px-4 py-4 flex flex-col gap-4">
                        {/* Colores */}
                        {colores.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 mb-2">
                              Color de grabado {colorSeleccionado && <span className="text-black">· {colorSeleccionado}</span>}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {colores.map((color: string) => (
                                <button key={color} onClick={() => setColorSeleccionado(color)}
                                  className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                                    colorSeleccionado === color
                                      ? 'border-black bg-black text-white'
                                      : 'border-black/15 text-black/60 hover:border-black/40'
                                  }`}>
                                  {color}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Texto */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 mb-2">Texto a grabar</p>
                          <div className="border border-black/15 focus-within:border-black transition-colors">
                            <input
                              type="text"
                              value={textoGrabado}
                              onChange={(e) => setTextoGrabado(e.target.value.slice(0, producto.personalizado_max_chars))}
                              placeholder={producto.personalizado_placeholder || 'Ej: Nombre, frase, fecha...'}
                              className="w-full px-3 py-2.5 text-sm bg-transparent focus:outline-none text-black placeholder-black/25"
                            />
                            <div className="px-3 pb-2 text-[10px] text-black/25 text-right">
                              {textoGrabado.length}/{producto.personalizado_max_chars}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${producto.stock > 0 ? 'bg-black' : 'bg-black/20'}`} />
              <span className={producto.stock > 0 ? 'text-black/60' : 'text-black/25'}>
                {producto.stock > 0 ? 'Stock disponible · Entrega en 3–5 días hábiles' : 'Sin stock disponible'}
              </span>
            </div>

            {/* Cantidad + agregar */}
            <div className="flex items-stretch gap-3">
              {/* Selector cantidad */}
              <div className="flex items-center border border-black/15">
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="w-9 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors h-full">
                  <Minus size={12} />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-black select-none">{cantidad}</span>
                <button onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                  className="w-9 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors h-full">
                  <Plus size={12} />
                </button>
              </div>

              {/* Botón agregar */}
              <motion.button
                onClick={handleAgregar}
                disabled={producto.stock === 0}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-30"
                style={{ backgroundColor: agregado ? '#111' : '#111', color: '#fff' }}
                whileTap={{ scale: 0.98 }}
              >
                <AnimatePresence mode="wait">
                  {agregado ? (
                    <motion.span key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      ✓ Agregado
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      <ShoppingCart size={14} /> Agregar al carrito
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            <div className="h-px bg-black/[0.07]" />

            {/* Info extra */}
            <div className="flex flex-col gap-3">
              {[
                { Icon: Truck, bold: 'Envío gratis', rest: 'en compras mayores a $15.000' },
                { Icon: Shield, bold: 'Garantía de calidad', rest: 'o te devolvemos el dinero' },
                { Icon: MessageCircle, bold: 'Consultas por WhatsApp', rest: 'antes y después de tu compra' },
              ].map(({ Icon, bold, rest }) => (
                <div key={bold} className="flex items-center gap-3 text-sm">
                  <Icon size={14} className="text-black/30 flex-shrink-0" />
                  <span className="text-black/70">
                    <strong className="font-semibold text-black">{bold}</strong> {rest}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

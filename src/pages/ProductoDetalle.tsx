import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ShoppingCart, Heart, Truck, Shield, MessageCircle, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import type { Producto } from '../types';

export default function ProductoDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const [colorSeleccionado, setColorSeleccionado] = useState('');
  const [quierePersonalizar, setQuierePersonalizar] = useState(false);
  const [textoGrabado, setTextoGrabado] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [imagenActiva, setImagenActiva] = useState(0);
  const agregar = useCarritoStore((s) => s.agregar);

  const { data: producto, isLoading } = useQuery<Producto>({
    queryKey: ['producto', slug],
    queryFn: () => api.get(`/productos/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-64 text-gray-400 text-sm">
      Cargando...
    </div>
  );

  if (!producto) return (
    <div className="flex items-center justify-center min-h-64 text-gray-400 text-sm">
      Producto no encontrado
    </div>
  );

  const costoGrabado = Number((producto as any).costo_grabado || 0);
  const precioFinal = Number(producto.precio_base) + (quierePersonalizar ? costoGrabado : 0);

  const handleAgregar = () => {
    agregar({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      precio_unitario: precioFinal,
      cantidad,
      color: quierePersonalizar ? (colorSeleccionado || undefined) : undefined,
      texto_grabado: quierePersonalizar ? (textoGrabado || undefined) : undefined,
      imagen_url: producto.imagenes_producto?.[0]?.url,
    });
  };

  const colores = Array.isArray(producto.colores_disponibles)
    ? producto.colores_disponibles
    : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <Link to="/" className="hover:text-gray-600">Inicio</Link>
        <ChevronRight size={12} />
        <Link to="/productos" className="hover:text-gray-600">Productos</Link>
        <ChevronRight size={12} />
        <span className="text-gray-600">{producto.nombre}</span>
      </div>

      <div className="grid grid-cols-2 gap-10">

        {/* GALERÍA */}
        <div className="flex flex-col gap-3">
          <div className="h-80 bg-[#E1F5EE] rounded-2xl flex items-center justify-center overflow-hidden">
            {producto.imagenes_producto?.[imagenActiva] ? (
              <img
                src={producto.imagenes_producto[imagenActiva].url}
                alt={producto.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-8xl opacity-30">☕</span>
            )}
          </div>
          {producto.imagenes_producto && producto.imagenes_producto.length > 1 && (
            <div className="flex gap-2">
              {producto.imagenes_producto.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImagenActiva(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imagenActiva ? 'border-[#1D9E75]' : 'border-gray-200'}`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {producto.apto_grabado && (
                <span className="text-xs bg-[#E1F5EE] text-[#0F6E56] rounded-full px-2.5 py-1 font-medium inline-flex items-center gap-1">
                  <Check size={11} /> Apto grabado láser
                </span>
              )}
            </div>
            <h1 className="text-2xl font-medium mb-1">{producto.nombre}</h1>
            {producto.descripcion && (
              <p className="text-sm text-gray-500 leading-relaxed">{producto.descripcion}</p>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-medium text-[#0F6E56]">
              ${precioFinal.toLocaleString('es-AR')}
            </span>
            {producto.precio_tachado && !quierePersonalizar && (
              <span className="text-base text-gray-400 line-through">
                ${Number(producto.precio_tachado).toLocaleString('es-AR')}
              </span>
            )}
            {quierePersonalizar && costoGrabado > 0 && (
              <span className="text-xs text-gray-400">
                (${Number(producto.precio_base).toLocaleString('es-AR')} + ${costoGrabado.toLocaleString('es-AR')} grabado)
              </span>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* MATERIAL */}
          {producto.material && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Material</div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-sm">
                {producto.material}
              </div>
            </div>
          )}

          {/* TOGGLE PERSONALIZACIÓN */}
          {producto.apto_grabado && producto.personalizado_habilitado && (
            <div className={`rounded-xl border p-4 transition-colors ${quierePersonalizar ? 'border-[#1D9E75] bg-[#E1F5EE]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Quiero grabado personalizado</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {costoGrabado > 0 ? (
                      <span className={quierePersonalizar ? 'text-[#0F6E56] font-medium' : ''}>+${costoGrabado.toLocaleString('es-AR')}</span>
                    ) : (
                      'Sin costo adicional'
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setQuierePersonalizar(!quierePersonalizar)}
                  className={`w-10 h-5.5 rounded-full relative transition-colors flex-shrink-0 ${quierePersonalizar ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.75 transition-all ${quierePersonalizar ? 'left-5' : 'left-0.75'}`} />
                </button>
              </div>

              {quierePersonalizar && (
                <div className="mt-4 flex flex-col gap-4">
                  {/* COLORES */}
                  {colores.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-2">
                        Color de grabado
                        {colorSeleccionado && <span className="text-[#0F6E56] ml-1">· {colorSeleccionado}</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {colores.map((color: string) => (
                          <button
                            key={color}
                            onClick={() => setColorSeleccionado(color)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                              colorSeleccionado === color
                                ? 'border-[#1D9E75] bg-white text-[#0F6E56] font-medium'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TEXTO GRABADO */}
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">Texto a grabar</div>
                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                      <input
                        type="text"
                        value={textoGrabado}
                        onChange={(e) => setTextoGrabado(e.target.value.slice(0, producto.personalizado_max_chars))}
                        placeholder={producto.personalizado_placeholder || 'Ej: Nombre, frase, fecha...'}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        {textoGrabado.length}/{producto.personalizado_max_chars} caracteres
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STOCK */}
          <div className="flex items-center gap-2 text-xs text-[#0F6E56]">
            <div className="w-2 h-2 bg-[#1D9E75] rounded-full"></div>
            {producto.stock > 0 ? `Stock disponible · Entrega en 3–5 días hábiles` : 'Sin stock'}
          </div>

          {/* CANTIDAD + BOTÓN */}
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm"
              >
                −
              </button>
              <span className="px-4 py-2 text-sm font-medium border-x border-gray-200">{cantidad}</span>
              <button
                onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                className="px-3 py-2 text-gray-600 hover:bg-gray-50 text-sm"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAgregar}
              disabled={producto.stock === 0}
              className="flex-1 bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingCart size={15} /> Agregar al carrito
            </button>
            <button className="w-10 h-10 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50">
              <Heart size={16} />
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* INFO ENVÍO */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Truck size={16} className="text-[#1D9E75]" />
              <span><strong>Envío gratis</strong> <span className="text-gray-400">en compras mayores a $15.000</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield size={16} className="text-[#1D9E75]" />
              <span><strong>Garantía de calidad</strong> <span className="text-gray-400">o te devolvemos el dinero</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MessageCircle size={16} className="text-[#1D9E75]" />
              <span><strong>Consultas por WhatsApp</strong> <span className="text-gray-400">antes y después de tu compra</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
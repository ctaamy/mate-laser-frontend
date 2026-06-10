import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingCart, Check, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import type { Producto, Categoria } from '../types';

export default function Home() {
  const agregar = useCarritoStore((s) => s.agregar);

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['productos-destacados'],
    queryFn: () => api.get('/productos?destacado=true').then((r) => r.data),
  });

  const handleAgregar = (producto: Producto) => {
    agregar({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      precio_unitario: Number(producto.precio_base),
      cantidad: 1,
      imagen_url: producto.imagenes_producto?.[0]?.url,
    });
  };

  return (
    <div className="flex flex-col">

      {/* HERO */}
      <section className="px-6 py-12 flex gap-8 items-center max-w-6xl mx-auto w-full">
        <div className="flex-1">
          <div className="text-xs font-medium text-[#1D9E75] uppercase tracking-wider mb-3">
            Grabado láser personalizado
          </div>
          <h1 className="text-3xl font-medium leading-tight mb-4">
            Mates únicos,<br />
            <span className="text-[#1D9E75]">hechos a tu medida</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-md">
            Personalizamos mates, bombillas y accesorios con tu diseño. Cada pieza es única, hecha con grabado láser de precisión.
          </p>
          <div className="flex gap-3">
            <Link
              to="/productos"
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors"
            >
              Ver productos
            </Link>
            <Link
              to="/#como-funciona"
              className="border border-gray-200 text-gray-700 rounded-lg px-5 py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              ¿Cómo funciona?
            </Link>
          </div>
        </div>
        <div className="w-56 h-48 bg-[#E1F5EE] rounded-2xl flex items-center justify-center flex-shrink-0">
          <span className="text-7xl">☕</span>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="px-6 py-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-medium mb-5">Categorías</h2>
          <div className="grid grid-cols-4 gap-3">
            {(categorias?.filter(c => !c.padre_id) ?? [
              { id: 1, nombre: 'Mates', slug: 'mates' },
              { id: 2, nombre: 'Bombillas', slug: 'bombillas' },
              { id: 3, nombre: 'Accesorios', slug: 'accesorios' },
              { id: 4, nombre: 'Carteles LED', slug: 'carteles-led' },
            ]).map((cat) => (
              <Link
                key={cat.id}
                to={`/productos?categoria_id=${cat.id}`}
                className="bg-white border border-gray-100 rounded-xl p-4 text-center hover:border-[#1D9E75] transition-colors"
              >
                <div className="text-2xl mb-2">☕</div>
                <span className="text-sm text-gray-600">{cat.nombre}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      <section className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-baseline mb-5">
            <h2 className="text-lg font-medium">Más vendidos</h2>
            <Link to="/productos" className="text-sm text-[#1D9E75] hover:underline">
              Ver todos →
            </Link>
          </div>
          {productos && productos.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {productos.slice(0, 3).map((producto) => (
                <div key={producto.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
                  <Link to={`/productos/${producto.slug}`}>
                    <div className="h-36 bg-[#E1F5EE] flex items-center justify-center">
                      {producto.imagenes_producto?.[0] ? (
                        <img src={producto.imagenes_producto[0].url} alt={producto.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-5xl opacity-40">☕</span>
                      )}
                    </div>
                  </Link>
                  <div className="p-3">
                    {producto.apto_grabado && (
                      <span className="text-[10px] bg-[#E1F5EE] text-[#0F6E56] rounded-full px-2 py-0.5 font-medium inline-flex items-center gap-1 mb-2">
                        <Check size={10} /> Apto láser
                      </span>
                    )}
                    <Link to={`/productos/${producto.slug}`}>
                      <div className="text-sm font-medium mb-1">{producto.nombre}</div>
                    </Link>
                    <div className="text-xs text-gray-400 mb-2">{producto.material}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#0F6E56]">
                        ${Number(producto.precio_base).toLocaleString('es-AR')}
                      </span>
                      <button
                        onClick={() => handleAgregar(producto)}
                        className="w-7 h-7 bg-[#1D9E75] text-white rounded-full flex items-center justify-center hover:bg-[#0F6E56] transition-colors"
                      >
                        <ShoppingCart size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              Cargando productos...
            </div>
          )}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="px-6 py-10 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-medium mb-6">¿Cómo funciona el grabado?</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { num: '1', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp' },
              { num: '2', titulo: 'Confirmamos el arte', desc: 'Te enviamos una previsualización del grabado para tu aprobación' },
              { num: '3', titulo: 'Grabamos tu pieza', desc: 'Usamos láser de precisión sobre acero, madera o acrílico' },
              { num: '4', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real' },
            ].map((paso) => (
              <div key={paso.num} className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="w-7 h-7 bg-[#1D9E75] text-white rounded-full flex items-center justify-center text-xs font-medium mb-3">
                  {paso.num}
                </div>
                <h3 className="text-sm font-medium mb-2">{paso.titulo}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{paso.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANNER CARTELES LED */}
      <section className="px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#085041] rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-[#9FE1CB] font-medium mb-1">¿Querés un cartel LED para tu negocio?</h3>
              <p className="text-[#5DCAA5] text-sm">Hacemos señalética personalizada para comercios y eventos</p>
            </div>
            <Link
              to="/productos?categoria_id=4"
              className="bg-[#9FE1CB] text-[#085041] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#E1F5EE] transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              Cotizar ahora <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="px-6 py-10 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-medium mb-6">Contacto</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                Respondemos por WhatsApp en menos de 2 horas en días hábiles.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'WhatsApp', value: '+54 11 XXXX-XXXX' },
                  { label: 'Instagram', value: '@matelaserstudio' },
                  { label: 'Email', value: 'hola@matelaserstudio.com' },
                  { label: 'Horario', value: 'Lunes a viernes, 9 a 18 hs' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3 text-sm">
                    <span className="text-gray-400 w-20 flex-shrink-0">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex flex-col gap-3">
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="Nombre" />
                <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="Email o teléfono" />
                <textarea className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] resize-none h-20" placeholder="¿En qué te podemos ayudar?" />
                <button className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0F6E56] transition-colors">
                  Enviar mensaje
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
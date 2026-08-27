import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronRight, ChevronDown, Search } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';
import type { Producto, Categoria } from '../types';
import ProductGrid from '../components/ui/ProductGrid';

export default function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  // <md: la sidebar de filtros se muestra como drawer lateral en vez de
  // ocupar espacio fijo al lado de la grilla (que en mobile la dejaba en
  // ~150px de ancho).
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const agregar = useCarritoStore((s) => s.agregar);
  const mostrarToast = useToastStore((s) => s.agregar);

  const categoria_id = searchParams.get('categoria_id') || '';
  const apto_grabado = searchParams.get('apto_grabado') || '';

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });

  const { data: productos, isLoading } = useQuery<Producto[]>({
    queryKey: ['productos', categoria_id, apto_grabado, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoria_id) params.append('categoria_id', categoria_id);
      if (apto_grabado) params.append('apto_grabado', apto_grabado);
      if (search) params.append('search', search);
      return api.get(`/productos?${params.toString()}`).then((r) => r.data.data);
    },
  });

  const handleAgregar = (producto: Producto) => {
    agregar({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      precio_unitario: Number(producto.precio_base),
      cantidad: 1,
      imagen_url: producto.imagenes_producto?.[0]?.url,
      stock: producto.stock,
    });
    mostrarToast(producto.nombre, producto.imagenes_producto?.[0]?.url);
  };

  const setFiltro = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  const hayFiltros = !!(categoria_id || apto_grabado);
  const cantidadFiltros = [categoria_id, apto_grabado].filter(Boolean).length;
  const cantidadProductos = productos?.length ?? 0;

  // Cuerpo de los filtros — compartido entre la sidebar de desktop y el
  // drawer de mobile, así no hay dos copias que mantener en sync.
  const filtrosBody = (
    <>
      <div className="mb-7">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30 mb-3">Categoría</div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setFiltro('categoria_id', '')}
            className={`text-left text-sm px-2.5 py-2 transition-colors ${!categoria_id ? 'bg-black text-white font-medium' : 'text-black/60 hover:text-black hover:bg-black/[0.04]'}`}
          >
            Todos
          </button>
          {categorias?.filter(c => !c.padre_id).map((cat) => {
            const hijos = categorias.filter(c => c.padre_id === cat.id);
            return (
              <div key={cat.id}>
                <button
                  onClick={() => setFiltro('categoria_id', cat.id.toString())}
                  className={`w-full text-left text-sm px-2.5 py-2 transition-colors flex items-center justify-between ${categoria_id === cat.id.toString() ? 'bg-black text-white font-medium' : 'text-black/60 hover:text-black hover:bg-black/[0.04]'}`}
                >
                  {cat.nombre}
                  {hijos.length > 0 && (
                    <ChevronRight size={12} className={`flex-shrink-0 transition-transform ${hijos.some(h => h.id.toString() === categoria_id) ? 'rotate-90' : ''}`} />
                  )}
                </button>
                {hijos.map((hijo) => (
                  <button
                    key={hijo.id}
                    onClick={() => setFiltro('categoria_id', hijo.id.toString())}
                    className={`w-full text-left text-sm pl-6 pr-2.5 py-1.5 transition-colors ${categoria_id === hijo.id.toString() ? 'bg-black text-white font-medium' : 'text-black/45 hover:text-black hover:bg-black/[0.04]'}`}
                  >
                    {hijo.nombre}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30 mb-3">Grabado láser</div>
        <label className={`flex items-center gap-2.5 text-sm cursor-pointer group ${apto_grabado === 'true' ? 'text-black' : 'text-black/50'}`}>
          <div
            onClick={() => setFiltro('apto_grabado', apto_grabado === 'true' ? '' : 'true')}
            className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${apto_grabado === 'true' ? 'bg-black border-black' : 'border-black/25 group-hover:border-black/50'}`}
          >
            {apto_grabado === 'true' && (
              <svg width="8" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          Solo aptos para grabar
        </label>
      </div>

      {hayFiltros && (
        <button
          onClick={() => setSearchParams({})}
          className="flex items-center gap-1.5 text-[11px] text-black/35 hover:text-black transition-colors"
        >
          <X size={11} /> Limpiar filtros
        </button>
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex gap-8">

      {/* SIDEBAR FILTROS — solo desde md; en mobile va en el drawer */}
      <aside className="hidden md:block w-48 flex-shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <SlidersHorizontal size={14} className="text-black/30" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Filtros</span>
        </div>
        {filtrosBody}
      </aside>

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Buscar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-black/12 bg-white pl-9 pr-3 py-2.5 text-sm placeholder-black/30 focus:outline-none focus:border-black/40 transition-colors"
            />
          </div>

          {/* Filtrar + Ordenar — dos pills parejas en mobile/tablet; en md+
              el filtro vive en la sidebar y sólo queda "ordenar". */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <button
              onClick={() => setFiltrosAbiertos(true)}
              className="md:hidden flex items-center justify-center gap-2 rounded-lg border border-black/12 px-4 py-2.5 text-sm text-black/70 hover:border-black/40 transition-colors"
            >
              <SlidersHorizontal size={14} /> Filtrar
              {hayFiltros && (
                <span className="ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
                  {cantidadFiltros}
                </span>
              )}
            </button>
            <div className="relative md:w-auto">
              <select className="w-full md:w-auto cursor-pointer appearance-none rounded-lg border border-black/12 bg-white pl-4 pr-9 py-2.5 text-sm text-black/70 focus:outline-none focus:border-black/40 transition-colors">
                <option>Más vendidos</option>
                <option>Menor precio</option>
                <option>Mayor precio</option>
                <option>Más nuevos</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/30" />
            </div>
          </div>
        </div>

        <p className="mb-5 text-[11px] font-medium text-black/35">{cantidadProductos} productos</p>

        {isLoading ? (
          <div className="text-center py-20 text-black/25 text-sm">Cargando...</div>
        ) : productos?.length === 0 ? (
          <div className="text-center py-20 text-black/25 text-sm">No hay productos</div>
        ) : (
          <ProductGrid
            productos={productos ?? []}
            onAgregar={handleAgregar}
            cols={3}
            colClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          />
        )}
      </div>

      {/* DRAWER DE FILTROS (mobile / tablet portrait) — siempre montado,
          transición por CSS. Los valores dinámicos (opacity / transform) van
          en `style` inline, no en clases toggle: con Tailwind v4 + HMR las
          utilidades condicionales (opacity-100 / translate-x-0) a veces no
          se generaban y el panel quedaba trabado fuera de pantalla. */}
      <div
        className="fixed inset-0 z-50 md:hidden transition-opacity duration-200"
        style={{
          opacity: filtrosAbiertos ? 1 : 0,
          pointerEvents: filtrosAbiertos ? 'auto' : 'none',
        }}
        aria-hidden={!filtrosAbiertos}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setFiltrosAbiertos(false)} />
        <div
          className="absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white shadow-xl flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: filtrosAbiertos ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
              <SlidersHorizontal size={14} className="text-black/30" /> Filtros
            </span>
            <button
              onClick={() => setFiltrosAbiertos(false)}
              aria-label="Cerrar filtros"
              className="w-9 h-9 -mr-2 flex items-center justify-center text-black/40 hover:text-black transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {filtrosBody}
          </div>
          <div className="border-t border-black/10 p-4">
            <button
              onClick={() => setFiltrosAbiertos(false)}
              className="w-full bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors"
            >
              Ver {cantidadProductos} productos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';
import type { Producto, Categoria } from '../types';
import ProductGrid from '../components/ui/ProductGrid';

export default function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 flex gap-8">

      {/* SIDEBAR FILTROS */}
      <aside className="w-48 flex-shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <SlidersHorizontal size={14} className="text-black/30" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Filtros</span>
        </div>

        <div className="mb-7">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/30 mb-3">Categoría</div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setFiltro('categoria_id', '')}
              className={`text-left text-sm px-2.5 py-2 transition-colors ${!categoria_id ? 'bg-black text-white font-medium' : 'text-black/60 hover:text-black hover:bg-black/[0.04]'}`}
            >
              Todos
            </button>
            {categorias?.filter(c => !c.padre_id).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFiltro('categoria_id', cat.id.toString())}
                className={`text-left text-sm px-2.5 py-2 transition-colors ${categoria_id === cat.id.toString() ? 'bg-black text-white font-medium' : 'text-black/60 hover:text-black hover:bg-black/[0.04]'}`}
              >
                {cat.nombre}
              </button>
            ))}
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
      </aside>

      {/* MAIN */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors w-64 bg-white placeholder-black/25"
              />
            </div>
            <span className="text-[11px] text-black/35 font-medium">
              {productos?.length ?? 0} productos
            </span>
          </div>
          <select className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white text-black/70">
            <option>Más vendidos</option>
            <option>Menor precio</option>
            <option>Mayor precio</option>
            <option>Más nuevos</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-black/25 text-sm">Cargando...</div>
        ) : productos?.length === 0 ? (
          <div className="text-center py-20 text-black/25 text-sm">No hay productos</div>
        ) : (
          <ProductGrid productos={productos ?? []} onAgregar={handleAgregar} cols={3} />
        )}
      </div>
    </div>
  );
}

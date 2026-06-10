import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Check, SlidersHorizontal } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import type { Producto, Categoria } from '../types';

export default function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const agregar = useCarritoStore((s) => s.agregar);

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
      return api.get(`/productos?${params.toString()}`).then((r) => r.data);
    },
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

  const setFiltro = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex gap-6">

      {/* SIDEBAR FILTROS */}
      <aside className="w-52 flex-shrink-0">
        <div className="flex items-center gap-2 mb-5">
          <SlidersHorizontal size={16} className="text-gray-400" />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="mb-6">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Categoría</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setFiltro('categoria_id', '')}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${!categoria_id ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            {categorias?.filter(c => !c.padre_id).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFiltro('categoria_id', cat.id.toString())}
                className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${categoria_id === cat.id.toString() ? 'bg-[#E1F5EE] text-[#0F6E56] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Grabado láser</div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={apto_grabado === 'true'}
              onChange={(e) => setFiltro('apto_grabado', e.target.checked ? 'true' : '')}
              className="accent-[#1D9E75]"
            />
            Solo aptos para grabar
          </label>
        </div>

        {(categoria_id || apto_grabado) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs text-gray-400 underline"
          >
            Limpiar filtros
          </button>
        )}
      </aside>

      {/* MAIN */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-64"
            />
            <span className="text-sm text-gray-400">
              {productos?.length ?? 0} productos
            </span>
          </div>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option>Más vendidos</option>
            <option>Menor precio</option>
            <option>Mayor precio</option>
            <option>Más nuevos</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Cargando...</div>
        ) : productos?.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">No hay productos</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {productos?.map((producto) => (
              <div key={producto.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
                <Link to={`/productos/${producto.slug}`}>
                  <div className="h-36 bg-[#E1F5EE] flex items-center justify-center relative">
                    {producto.imagenes_producto?.[0] ? (
                      <img src={producto.imagenes_producto[0].url} alt={producto.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-5xl opacity-40">☕</span>
                    )}
                    {producto.apto_grabado && (
                      <span className="absolute top-2 right-2 text-[10px] bg-[#E1F5EE] text-[#0F6E56] rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                        <Check size={10} /> Apto láser
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <Link to={`/productos/${producto.slug}`}>
                    <div className="text-sm font-medium mb-1 hover:text-[#1D9E75] transition-colors">{producto.nombre}</div>
                  </Link>
                  <div className="text-xs text-gray-400 mb-2">{producto.material}</div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-[#0F6E56]">
                        ${Number(producto.precio_base).toLocaleString('es-AR')}
                      </span>
                      {producto.precio_tachado && (
                        <span className="text-xs text-gray-400 line-through ml-2">
                          ${Number(producto.precio_tachado).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
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
        )}
      </div>
    </div>
  );
}
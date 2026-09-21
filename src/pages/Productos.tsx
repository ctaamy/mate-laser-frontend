import { useEffect, useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigationType, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import BuscadorConSugerencias from '../components/ui/BuscadorConSugerencias';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';
import type { Producto, Categoria } from '../types';
import ProductGrid from '../components/ui/ProductGrid';
import { CategoriasFiltro, CategoriasChips } from '../components/catalogo/CategoriasFiltro';
import { useCategoriasArbol } from '../hooks/useCategoriasArbol';
import { track, trackCategoriaClick, type OrigenCategoria } from '../lib/analytics';
import { usePageMeta } from '../hooks/usePageMeta';
import { metaBusqueda, metaCatalogo, metaCategoria, type PageMeta } from '../lib/seo';

export default function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navType = useNavigationType();
  // El término vive en la URL (?q=) para que el buscador del navbar, el link
  // compartido y el botón "atrás" funcionen. El input escribe local y sincroniza
  // con la URL con debounce; la URL escribe de vuelta al input (navegación externa).
  const qUrl = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(qUrl);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const orden = searchParams.get('orden') || '';

  // URL -> input: si la URL cambió por fuera (buscador del navbar, link
  // compartido, botón "atrás"), reflejarlo en el input. Ajuste de estado en
  // render (patrón recomendado de React) en vez de useEffect.
  //
  // El REPLACE se ignora: son las escrituras del efecto de abajo (input -> URL)
  // volviendo por el router, no navegación externa (navbar = PUSH, atrás/adelante
  // = POP). Ese eco llega tarde — el router lo commitea con prioridad baja y se
  // reinicia si entra otra tecla — y si el usuario ya tipeó algo más, tratarlo
  // como externo le pisaba el input con el valor viejo (comía letras y podía
  // entrar en ping-pong con la escritura siguiente).
  const [qUrlPrevio, setQUrlPrevio] = useState(qUrl);
  if (qUrl !== qUrlPrevio) {
    setQUrlPrevio(qUrl);
    if (navType !== 'REPLACE' && search.trim() !== qUrl) setSearch(qUrl);
  }
  // <md: la sidebar de filtros se muestra como drawer lateral en vez de
  // ocupar espacio fijo al lado de la grilla (que en mobile la dejaba en
  // ~150px de ancho).
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const agregar = useCarritoStore((s) => s.agregar);
  const mostrarToast = useToastStore((s) => s.agregar);

  const categoria_id = searchParams.get('categoria_id') || '';
  const apto_grabado = searchParams.get('apto_grabado') || '';

  // input -> URL (debounced). replace: true para no llenar el historial con
  // una entrada por tecla. Se decide contra la URL real y no contra `qUrl`:
  // como el eco de nuestra propia escritura ya no se refleja en el input, este
  // render puede ir atrasado respecto de una escritura que todavía no volvió
  // (history.replaceState es síncrono; el commit del router, no).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedSearch === (params.get('q') ?? '')) return;
    if (debouncedSearch) params.set('q', debouncedSearch);
    else params.delete('q');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const seleccionadaId = categoria_id ? Number(categoria_id) : null;
  // Árbol para la navegación: sin categorías vacías (salvo la elegida por URL).
  const { raices, porId } = useCategoriasArbol({ ocultarVacias: true, seleccionadaId });

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });

  // Paginado incremental: el endpoint devuelve de a `limit` (20) productos.
  // Antes esto era un useQuery que se quedaba sólo con la primera página —
  // con el catálogo > 20, todo lo que caía fuera de esos 20 no aparecía nunca
  // en "Todos" (y sólo se veía al filtrar por una subcategoría chica). Ahora
  // acumulamos páginas y el botón "Ver más" trae la siguiente.
  const {
    data: paginas,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['productos', categoria_id, apto_grabado, debouncedSearch, orden],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (categoria_id) params.append('categoria_id', categoria_id);
      if (apto_grabado) params.append('apto_grabado', apto_grabado);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (orden) params.append('orden', orden);
      params.append('page', String(pageParam));
      return api.get(`/productos?${params.toString()}`).then(
        (r) =>
          r.data as { data: Producto[]; total: number; page: number; totalPages: number },
      );
    },
    getNextPageParam: (ultima) =>
      ultima.page < ultima.totalPages ? ultima.page + 1 : undefined,
  });

  const productos = paginas?.pages.flatMap((p) => p.data);
  const totalProductos = paginas?.pages[0]?.total ?? 0;

  // SEO: cada categoría es una URL propia (?categoria_id=N) con su title/
  // description/canonical; ?orden= y ?apto_grabado= comparten el canonical de
  // la categoría, y la búsqueda interna (?q=) no se indexa.
  const categoriaActual = categorias?.find((c) => String(c.id) === categoria_id);
  const metaListado = (): PageMeta | null => {
    if (qUrl) return metaBusqueda();
    if (!categoria_id) return metaCatalogo();
    if (categorias && !categoriaActual) return metaCatalogo(); // categoria_id inexistente
    if (!categoriaActual || !productos) return null; // todavía cargando
    return metaCategoria(categoriaActual.nombre, categoriaActual.id, productos.some((p) => p.apto_grabado));
  };
  usePageMeta(metaListado());

  // Métrica: se llegó a una categoría sin productos (callejón sin salida). Solo
  // con la categoría como único filtro: con búsqueda o "aptos para grabar" el 0
  // puede ser de la combinación, no de la categoría.
  useEffect(() => {
    if (isLoading || !categorias || !categoria_id || debouncedSearch || apto_grabado || totalProductos !== 0) return;
    track('categoria_vacia_vista', { categoria: categoriaActual?.nombre ?? 'desconocida', categoria_id: Number(categoria_id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, categoria_id, debouncedSearch, apto_grabado, totalProductos, !!categorias]);

  const handleAgregar = (producto: Producto) => {
    // Defensa extra: la card ya no muestra el botón para productos sin stock,
    // pero cortamos acá también para que ninguna ruta futura re-cuele el
    // "add silencioso" (te dejaba sumar algo no vendible y recién te frenaba
    // el carrito).
    if (producto.disponible === false) return;
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

  // Elegir categoría: filtra, vuelve al inicio de la grilla (con la sidebar
  // sticky se puede estar scrolleado) y cierra el drawer mobile — la categoría
  // es single-select, no tiene sentido dejarlo abierto esperando "Ver N".
  const seleccionarCategoria = (id: number | null, origen: OrigenCategoria) => {
    const nodo = id === null ? undefined : porId.get(id);
    if (id === null) trackCategoriaClick(origen, 'todos');
    else if (nodo) trackCategoriaClick(origen, nodo);
    setFiltro('categoria_id', id === null ? '' : String(id));
    window.scrollTo({ top: 0 });
    setFiltrosAbiertos(false);
  };

  const hayFiltros = !!(categoria_id || apto_grabado);
  const cantidadFiltros = [categoria_id, apto_grabado].filter(Boolean).length;
  // Total de coincidencias (todas las páginas), no sólo lo ya cargado.
  const cantidadProductos = totalProductos;

  // Cuerpo de los filtros — compartido entre la sidebar de desktop y el
  // drawer de mobile, así no hay dos copias que mantener en sync.
  const renderFiltros = (origen: 'sidebar' | 'drawer') => (
    <>
      <div className="mb-7">
        <div className="text-sm font-medium text-black/70 mb-2">Categorías</div>
        <CategoriasFiltro raices={raices} seleccionadaId={seleccionadaId} onSelect={(id) => seleccionarCategoria(id, origen)} />
      </div>

      <div className="mb-6">
        <div className="text-sm font-medium text-black/70 mb-2">Grabado láser</div>
        <label className={`flex items-center gap-2.5 text-sm cursor-pointer group ${apto_grabado === 'true' ? 'text-black' : 'text-black/60'}`}>
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
          onClick={() => {
            // Conserva el término de búsqueda y el orden — solo limpia
            // categoría / grabado.
            const p = new URLSearchParams();
            if (qUrl) p.set('q', qUrl);
            if (orden) p.set('orden', orden);
            setSearchParams(p);
          }}
          className="flex items-center gap-1.5 text-xs text-black/60 hover:text-black transition-colors"
        >
          <X size={11} /> Limpiar filtros
        </button>
      )}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex gap-8">

      {/* SIDEBAR FILTROS — solo desde md; en mobile va en el drawer */}
      <aside className="hidden md:block w-56 flex-shrink-0 sticky top-28 self-start max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain pr-1">
        <div className="flex items-center gap-2 mb-5">
          <SlidersHorizontal size={14} className="text-black/50" />
          <span className="text-sm font-medium text-black/70">Filtros</span>
        </div>
        {renderFiltros('sidebar')}
      </aside>

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Buscar */}
          <BuscadorConSugerencias
            value={search}
            onChange={setSearch}
            onSubmitLibre={() => { /* el efecto debounced ya sincroniza ?q= */ }}
            placeholder="Buscar producto..."
            className="flex-1 sm:max-w-xs"
            inputClassName="w-full rounded-lg border border-black/12 bg-white pl-9 pr-8 py-2.5 text-sm placeholder-black/30 focus:outline-none focus:border-black/40 transition-colors"
            iconColor="rgba(0,0,0,0.25)"
            clearable
          />

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
              <select
                value={orden}
                onChange={(e) => setFiltro('orden', e.target.value)}
                className="w-full md:w-auto cursor-pointer appearance-none rounded-lg border border-black/12 bg-white pl-4 pr-9 py-2.5 text-sm text-black/70 focus:outline-none focus:border-black/40 transition-colors"
              >
                <option value="">Destacados</option>
                <option value="precio_asc">Menor precio</option>
                <option value="precio_desc">Mayor precio</option>
                <option value="nuevos">Más nuevos</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/30" />
            </div>
          </div>
        </div>

        <CategoriasChips raices={raices} seleccionadaId={seleccionadaId} onSelect={(id) => seleccionarCategoria(id, 'chips')} />

        <p className="mb-5 text-xs font-medium text-black/55">{cantidadProductos} productos</p>

        {isLoading ? (
          <div className="text-center py-20 text-black/50 text-sm">Cargando...</div>
        ) : productos?.length === 0 ? (
          <div className="text-center py-20 text-black/50 text-sm">
            {debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay productos'}
          </div>
        ) : (
          <>
            <ProductGrid
              productos={productos ?? []}
              onAgregar={handleAgregar}
              cols={3}
              colClassName="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
            />
            {hasNextPage && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="border border-black/15 px-7 py-2.5 text-sm text-black/70 hover:border-black/40 transition-colors disabled:opacity-40"
                >
                  {isFetchingNextPage ? 'Cargando...' : 'Ver más'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* DRAWER DE FILTROS (mobile / tablet portrait) — siempre montado,
          transición por CSS. Los valores dinámicos (opacity / transform) van
          en `style` inline, no en clases toggle: con Tailwind v4 + HMR las
          utilidades condicionales (opacity-100 / translate-x-0) a veces no
          se generaban y el panel quedaba trabado fuera de pantalla. */}
      <div
        data-testid="filtros-drawer"
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
            <span className="flex items-center gap-2 text-sm font-medium text-black/70">
              <SlidersHorizontal size={14} className="text-black/50" /> Filtros
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
            {renderFiltros('drawer')}
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

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, MessageCircle, ShoppingCart } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';

interface Anclaje {
  anclaje_x: number;
  anclaje_y: number;
  rotacion: number;
  escala: number;
}

interface Sugerencia {
  id: string;
  variante_id: string;
  producto_id: string;
  nombre_producto: string;
  etiqueta?: string | null;
  imagen_url?: string | null;
  precio: number;
  sinStock: boolean;
}

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  imagen_configurador_url?: string | null;
  other_categorias: Categoria[];
}

interface ImagenProducto {
  id: string;
  url: string;
  es_principal: boolean;
}

interface ValorOpcion {
  id: string;
  valor: string;
}

interface VarianteValor {
  valores_opcion: ValorOpcion;
}

interface VarianteProducto {
  id: string;
  sku?: string | null;
  precio_override?: number | null;
  stock: number;
  activo: boolean;
  variante_valores?: VarianteValor[];
  imagenes_producto?: ImagenProducto | null;
}

interface Producto {
  id: string;
  nombre: string;
  slug: string;
  precio_base: number;
  apto_grabado: boolean;
  costo_grabado?: number | null;
  imagenes_producto: ImagenProducto[];
  variantes_producto: VarianteProducto[];
}

interface DisenoPredeterminado {
  id: string;
  nombre: string;
  imagen_url: string;
}

// Elección del Paso 4: un diseño predeterminado, o una idea en texto libre (dispara el aviso de contacto).
type SeleccionGrabado =
  | { tipo: 'predeterminado'; diseno: DisenoPredeterminado }
  | { tipo: 'texto'; texto: string };

// Selección persistida en memoria mientras el cliente sigue en la página (no sobrevive a cerrar el navegador).
interface SeleccionMate {
  producto: Producto;
  variante: VarianteProducto | null;
}

interface SeleccionBombilla {
  producto: Producto;
  variante: VarianteProducto;
}

const PASOS = ['Tipo de mate', 'Mate y variante', 'Bombilla', 'Grabado', 'Resumen'] as const;

export default function DisenaTuMateV2() {
  const [pasoActivo, setPasoActivo] = useState(0);
  const [categoriaElegida, setCategoriaElegida] = useState<Categoria | null>(null);
  const [noPersonalizar, setNoPersonalizar] = useState(false);
  const [seleccionMate, setSeleccionMate] = useState<SeleccionMate | null>(null);
  // undefined = todavía no decidido; 'saltado' = el cliente saltó el paso; objeto = bombilla elegida.
  const [seleccionBombilla, setSeleccionBombilla] = useState<SeleccionBombilla | 'saltado' | undefined>(undefined);
  const [seleccionGrabado, setSeleccionGrabado] = useState<SeleccionGrabado | 'saltado' | undefined>(undefined);

  const { data: categorias, isLoading: cargandoCategorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });

  const raizMates = useMemo(
    () => categorias?.find((c) => c.padre_id === null && c.nombre.toLowerCase() === 'mates') ?? null,
    [categorias],
  );
  const subcategorias = raizMates?.other_categorias ?? [];

  const raizBombillas = useMemo(
    () => categorias?.find((c) => c.padre_id === null && c.nombre.toLowerCase() === 'bombillas') ?? null,
    [categorias],
  );

  const { data: mates, isLoading: cargandoMates } = useQuery<{ data: Producto[] }>({
    queryKey: ['productos-configurador', categoriaElegida?.id, noPersonalizar],
    queryFn: () =>
      api
        .get('/productos', {
          params: {
            categoria_id: categoriaElegida?.id,
            ...(noPersonalizar ? {} : { apto_grabado: true }),
          },
        })
        .then((r) => r.data),
    enabled: !!categoriaElegida,
  });

  const elegirCategoria = (cat: Categoria) => {
    setCategoriaElegida(cat);
    setSeleccionMate(null);
    setPasoActivo(1);
  };

  const noQuieroPersonalizar = () => {
    setNoPersonalizar(true);
    if (categoriaElegida) setPasoActivo(1);
  };

  const irAtras = () => {
    if (pasoActivo === 4) {
      setPasoActivo(3);
      return;
    }
    if (pasoActivo === 3) {
      setSeleccionGrabado(undefined);
      setPasoActivo(2);
      return;
    }
    if (pasoActivo === 2) {
      setSeleccionBombilla(undefined);
      setPasoActivo(1);
      return;
    }
    if (pasoActivo === 1) {
      setSeleccionMate(null);
      setCategoriaElegida(null);
      setPasoActivo(0);
      return;
    }
    setPasoActivo((i) => Math.max(i - 1, 0));
  };

  const irAPaso3 = () => setPasoActivo(2);
  const irAPaso4 = () => setPasoActivo(3);
  const irAPaso5 = () => setPasoActivo(4);

  const mateImg = seleccionMate?.variante?.imagenes_producto?.url ?? seleccionMate?.producto.imagenes_producto[0]?.url ?? null;
  const bombillaImg =
    seleccionBombilla && seleccionBombilla !== 'saltado'
      ? seleccionBombilla.variante.imagenes_producto?.url ?? seleccionBombilla.producto.imagenes_producto[0]?.url ?? null
      : null;

  // Punto de anclaje configurado por el admin para la variante de mate elegida (Fase 3, enhancement opcional).
  const { data: anclaje } = useQuery<Anclaje | null>({
    queryKey: ['configurador-anclaje', seleccionMate?.variante?.id],
    queryFn: () => api.get('/configurador/anclaje', { params: { variante_id: seleccionMate!.variante!.id } }).then((r) => r.data ?? null),
    enabled: !!seleccionMate?.variante?.id,
  });

  // precio_override/precio_base viajan como Decimal serializado (string) desde el backend.
  const precioMate = seleccionMate
    ? Number(seleccionMate.variante?.precio_override ?? seleccionMate.producto.precio_base)
    : 0;
  const precioBombilla =
    seleccionBombilla && seleccionBombilla !== 'saltado'
      ? Number(seleccionBombilla.variante.precio_override ?? seleccionBombilla.producto.precio_base)
      : 0;
  // El costo de personalización es propio de cada mate (productos.costo_grabado), no de la bombilla.
  const precioGrabado =
    seleccionGrabado && seleccionGrabado !== 'saltado' ? Number(seleccionMate?.producto.costo_grabado ?? 0) : 0;
  const precioActual = precioMate + precioBombilla + precioGrabado;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 pb-32 md:pb-10 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-10">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Diseñá tu mate</h1>
        <p className="text-sm text-black/50 mb-8">Armá tu mate a medida paso a paso.</p>

        {/* STEPPER */}
        <div className="mb-10">
          <div className="flex md:hidden items-center justify-between text-sm font-medium mb-2">
            <span>Paso {pasoActivo + 1} de {PASOS.length}</span>
            <span className="text-black/60">{PASOS[pasoActivo]}</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2 overflow-x-auto">
            {PASOS.map((nombre, i) => {
              const activo = i === pasoActivo;
              const hecho = i < pasoActivo;
              return (
                <div key={nombre} className="flex items-center gap-1 md:gap-2 shrink-0">
                  <div
                    className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-[11px] font-medium rounded-full shrink-0 ${
                      activo ? 'bg-black text-white' : hecho ? 'bg-black/10 text-black/60' : 'border border-black/15 text-black/30'
                    }`}
                  >
                    {hecho ? <Check size={13} /> : i + 1}
                  </div>
                  <span className={`hidden md:inline text-xs ${activo ? 'font-medium text-black' : 'text-black/40'}`}>
                    {nombre}
                  </span>
                  {i < PASOS.length - 1 && <div className="w-4 md:w-8 h-px bg-black/10" />}
                </div>
              );
            })}
          </div>
        </div>

        {pasoActivo === 0 && (
          <Paso1TipoMate
            cargando={cargandoCategorias}
            subcategorias={subcategorias}
            onElegir={elegirCategoria}
          />
        )}

        {pasoActivo === 1 && categoriaElegida && (
          <Paso2MateVariante
            categoria={categoriaElegida}
            cargando={cargandoMates}
            mates={mates?.data ?? []}
            noPersonalizar={noPersonalizar}
            seleccion={seleccionMate}
            onSeleccionar={setSeleccionMate}
            onNoPersonalizar={noQuieroPersonalizar}
            onAtras={irAtras}
            onContinuar={irAPaso3}
          />
        )}

        {pasoActivo === 2 && seleccionMate?.variante && (
          <Paso3Bombilla
            varianteMateId={seleccionMate.variante.id}
            categoriaBombillasId={raizBombillas?.id}
            seleccion={seleccionBombilla}
            onSeleccionar={setSeleccionBombilla}
            onAtras={irAtras}
            onContinuar={irAPaso4}
          />
        )}

        {pasoActivo === 3 && (
          <Paso4Grabado
            costoGrabado={Number(seleccionMate?.producto.costo_grabado ?? 0)}
            seleccion={seleccionGrabado}
            onSeleccionar={setSeleccionGrabado}
            onAtras={irAtras}
            onContinuar={irAPaso5}
          />
        )}

        {pasoActivo === 4 && seleccionMate?.variante && (
          <Paso5Resumen
            seleccionMate={seleccionMate as Required<SeleccionMate>}
            seleccionBombilla={seleccionBombilla}
            seleccionGrabado={seleccionGrabado}
            precioMate={precioMate}
            precioBombilla={precioBombilla}
            precioGrabado={precioGrabado}
            precioTotal={precioActual}
            onAtras={irAtras}
          />
        )}
      </div>

      {/* RESUMEN LATERAL (desktop persistente / mobile sticky abajo) */}
      <aside className="hidden md:block sticky top-6 h-fit border border-black/10 p-5">
        <h3 className="text-sm font-semibold mb-4">Tu mate</h3>
        {mateImg && <ComboPreview mateImg={mateImg} bombillaImg={bombillaImg} anclaje={anclaje ?? null} />}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-black/50">Tipo</span>
            <span className="font-medium">{categoriaElegida?.nombre ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-black/50">Mate</span>
            <span className="font-medium">{seleccionMate?.producto.nombre ?? '—'}</span>
          </div>
          {seleccionMate?.variante && (
            <div className="flex items-center justify-between">
              <span className="text-black/50">Variante</span>
              <span className="font-medium">
                {seleccionMate.variante.variante_valores?.map((v) => v.valores_opcion.valor).join(' / ') || seleccionMate.variante.sku || '—'}
              </span>
            </div>
          )}
          {pasoActivo >= 2 && (
            <div className="flex items-center justify-between">
              <span className="text-black/50">Bombilla</span>
              <span className="font-medium">
                {seleccionBombilla === 'saltado' || !seleccionBombilla
                  ? 'Sin bombilla'
                  : `${seleccionBombilla.producto.nombre}${precioBombilla > 0 ? ` (+$${precioBombilla.toLocaleString('es-AR')})` : ''}`}
              </span>
            </div>
          )}
          {pasoActivo >= 3 && (
            <div className="flex items-center justify-between">
              <span className="text-black/50">Grabado</span>
              <span className="font-medium">
                {!seleccionGrabado || seleccionGrabado === 'saltado'
                  ? 'Sin grabado'
                  : seleccionGrabado.tipo === 'predeterminado'
                    ? seleccionGrabado.diseno.nombre
                    : 'Idea a definir'}
                {precioGrabado > 0 && ` (+$${precioGrabado.toLocaleString('es-AR')})`}
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-black/10 mt-4 pt-4 flex items-center justify-between">
          <span className="text-black/50 text-sm">Total</span>
          <span className="text-lg font-semibold">${precioActual.toLocaleString('es-AR')}</span>
        </div>
      </aside>

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-black/10 p-4 flex items-center justify-between gap-4 z-40">
        <div>
          <p className="text-xs text-black/50">Total</p>
          <p className="text-lg font-semibold">${precioActual.toLocaleString('es-AR')}</p>
        </div>
        <p className="text-xs text-black/50 text-right">
          {categoriaElegida?.nombre ?? 'Elegí un tipo de mate'}
          {seleccionMate ? ` · ${seleccionMate.producto.nombre}` : ''}
        </p>
      </div>
    </div>
  );
}

function Paso1TipoMate({
  cargando,
  subcategorias,
  onElegir,
}: {
  cargando: boolean;
  subcategorias: Categoria[];
  onElegir: (c: Categoria) => void;
}) {
  if (cargando) {
    return <div className="text-sm text-black/40 py-10">Cargando tipos de mate...</div>;
  }

  if (subcategorias.length === 0) {
    return (
      <div className="text-sm text-black/40 py-10">
        Todavía no hay tipos de mate configurados.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">Elegí el tipo de mate</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subcategorias.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onElegir(cat)}
            className="text-left border border-black/15 hover:border-black/40 p-4 min-h-[44px] transition-colors"
          >
            {cat.imagen_configurador_url && (
              <img
                src={cat.imagen_configurador_url}
                alt={cat.nombre}
                className="w-full h-32 object-cover mb-3"
              />
            )}
            <span className="font-medium text-sm">{cat.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Paso2MateVariante({
  categoria,
  cargando,
  mates,
  noPersonalizar,
  seleccion,
  onSeleccionar,
  onNoPersonalizar,
  onAtras,
  onContinuar,
}: {
  categoria: Categoria;
  cargando: boolean;
  mates: Producto[];
  noPersonalizar: boolean;
  seleccion: SeleccionMate | null;
  onSeleccionar: (s: SeleccionMate | null) => void;
  onNoPersonalizar: () => void;
  onAtras: () => void;
  onContinuar: () => void;
}) {
  const producto = seleccion?.producto ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-medium">Elegí tu mate — {categoria.nombre}</h2>
        {!noPersonalizar && (
          <button
            type="button"
            onClick={onNoPersonalizar}
            className="text-xs underline text-black/50 hover:text-black min-h-[44px]"
          >
            No quiero personalizar
          </button>
        )}
      </div>

      {cargando && <div className="text-sm text-black/40 py-10">Cargando mates...</div>}

      {!cargando && mates.length === 0 && (
        <div className="text-sm text-black/40 py-10">
          No hay mates {noPersonalizar ? '' : 'aptos para grabado '}disponibles en esta categoría.
        </div>
      )}

      {!cargando && !producto && mates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {mates.map((p) => {
            const imgPrincipal = p.imagenes_producto.find((i) => i.es_principal) ?? p.imagenes_producto[0];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSeleccionar({ producto: p, variante: null })}
                className="text-left border border-black/15 hover:border-black/40 p-4 min-h-[44px] transition-colors"
              >
                {imgPrincipal && (
                  <img src={imgPrincipal.url} alt={p.nombre} className="w-full h-40 object-cover mb-3" />
                )}
                <span className="font-medium text-sm block">{p.nombre}</span>
                <span className="text-xs text-black/50">${Number(p.precio_base).toLocaleString('es-AR')}</span>
              </button>
            );
          })}
        </div>
      )}

      {producto && (
        <SelectorVariante
          producto={producto}
          varianteSeleccionada={seleccion?.variante ?? null}
          onCambiarVariante={(v) => onSeleccionar({ producto, variante: v })}
          onCambiarMate={() => onSeleccionar(null)}
        />
      )}

      <div className="flex flex-col md:flex-row gap-3 md:justify-between mt-6">
        <button
          type="button"
          onClick={onAtras}
          className="min-h-[44px] px-5 border border-black/15 text-sm font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
        <button
          type="button"
          disabled={!seleccion?.variante}
          onClick={onContinuar}
          className="min-h-[44px] px-6 bg-black text-white text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-2"
        >
          Continuar <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Paso3Bombilla({
  varianteMateId,
  categoriaBombillasId,
  seleccion,
  onSeleccionar,
  onAtras,
  onContinuar,
}: {
  varianteMateId: string;
  categoriaBombillasId?: number;
  seleccion: SeleccionBombilla | 'saltado' | undefined;
  onSeleccionar: (s: SeleccionBombilla | 'saltado' | undefined) => void;
  onAtras: () => void;
  onContinuar: () => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  // Bombilla elegida en la grilla de "ver todas" que tiene más de una variante y todavía necesita color/talle.
  const [productoParaVariante, setProductoParaVariante] = useState<Producto | null>(null);

  const { data: sugerencias, isLoading: cargandoSugerencias } = useQuery<Sugerencia[]>({
    queryKey: ['configurador-sugerencias', varianteMateId],
    queryFn: () => api.get('/configurador/sugerencias', { params: { variante_id: varianteMateId } }).then((r) => r.data),
    enabled: !verTodas,
  });

  const { data: bombillas, isLoading: cargandoBombillas } = useQuery<{ data: Producto[] }>({
    queryKey: ['productos-bombillas', categoriaBombillasId],
    queryFn: () => api.get('/productos', { params: { categoria_id: categoriaBombillasId } }).then((r) => r.data),
    enabled: verTodas && !!categoriaBombillasId,
  });

  const bombillaElegida = seleccion !== 'saltado' ? seleccion ?? null : null;

  const elegirDeGrilla = (p: Producto) => {
    if (p.variantes_producto.length <= 1) {
      onSeleccionar({ producto: p, variante: p.variantes_producto[0] });
      return;
    }
    setProductoParaVariante(p);
  };

  const elegirSugerencia = (s: Sugerencia) => {
    onSeleccionar({
      producto: {
        id: s.producto_id,
        nombre: s.nombre_producto,
        slug: '',
        precio_base: s.precio,
        apto_grabado: false,
        imagenes_producto: s.imagen_url ? [{ id: '', url: s.imagen_url, es_principal: true }] : [],
        variantes_producto: [],
      },
      variante: { id: s.variante_id, precio_override: s.precio, stock: 1, activo: true },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-medium">Elegí una bombilla (opcional)</h2>
        {!verTodas && (
          <button
            type="button"
            onClick={() => { setVerTodas(true); setProductoParaVariante(null); onSeleccionar(undefined); }}
            className="text-xs underline text-black/50 hover:text-black min-h-[44px]"
          >
            Ver todas las bombillas
          </button>
        )}
      </div>

      {!verTodas && !bombillaElegida && (
        <>
          {cargandoSugerencias && <div className="text-sm text-black/40 py-10">Buscando bombillas sugeridas...</div>}
          {!cargandoSugerencias && (sugerencias?.length ?? 0) === 0 && (
            <div className="text-sm text-black/40 py-6">
              No hay bombillas sugeridas para este mate.{' '}
              <button type="button" onClick={() => setVerTodas(true)} className="underline">
                Ver todas las bombillas
              </button>
            </div>
          )}
          {!cargandoSugerencias && (sugerencias?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {sugerencias!.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={s.sinStock}
                  onClick={() => elegirSugerencia(s)}
                  className={`text-left border p-4 min-h-[44px] transition-colors ${
                    s.sinStock ? 'opacity-40 cursor-not-allowed border-black/10' : 'border-black/15 hover:border-black/40'
                  }`}
                >
                  {s.imagen_url && <img src={s.imagen_url} alt={s.nombre_producto} className="w-full h-32 object-cover mb-3" />}
                  <span className="font-medium text-sm block">{s.nombre_producto}</span>
                  {s.etiqueta && <span className="text-xs text-black/50">{s.etiqueta}</span>}
                  <p className="text-xs mt-2 font-medium">
                    {s.sinStock ? 'Sin stock' : `+$${s.precio.toLocaleString('es-AR')}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {verTodas && !bombillaElegida && !productoParaVariante && (
        <>
          {cargandoBombillas && <div className="text-sm text-black/40 py-10">Cargando bombillas...</div>}
          {!cargandoBombillas && (bombillas?.data?.length ?? 0) === 0 && (
            <div className="text-sm text-black/40 py-10">No hay bombillas disponibles.</div>
          )}
          {!cargandoBombillas && (bombillas?.data?.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {bombillas!.data.map((p) => {
                const imgPrincipal = p.imagenes_producto.find((i) => i.es_principal) ?? p.imagenes_producto[0];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegirDeGrilla(p)}
                    className="text-left border border-black/15 hover:border-black/40 p-4 min-h-[44px] transition-colors"
                  >
                    {imgPrincipal && <img src={imgPrincipal.url} alt={p.nombre} className="w-full h-32 object-cover mb-3" />}
                    <span className="font-medium text-sm block">{p.nombre}</span>
                    <span className="text-xs text-black/50">${Number(p.precio_base).toLocaleString('es-AR')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {productoParaVariante && (
        <SelectorVariante
          producto={productoParaVariante}
          varianteSeleccionada={null}
          onCambiarVariante={(v) => {
            onSeleccionar({ producto: productoParaVariante, variante: v });
            setProductoParaVariante(null);
          }}
          onCambiarMate={() => setProductoParaVariante(null)}
        />
      )}

      {bombillaElegida && (
        <div className="border border-black/10 p-4 mb-6 flex items-center justify-between">
          <div>
            <span className="font-medium text-sm block">{bombillaElegida.producto.nombre}</span>
            {bombillaElegida.variante.variante_valores && bombillaElegida.variante.variante_valores.length > 0 && (
              <span className="text-xs text-black/50">
                {bombillaElegida.variante.variante_valores.map((v) => v.valores_opcion.valor).join(' / ')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSeleccionar(undefined)}
            className="text-xs underline text-black/50 hover:text-black"
          >
            Cambiar bombilla
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:justify-between mt-6">
        <button
          type="button"
          onClick={onAtras}
          className="min-h-[44px] px-5 border border-black/15 text-sm font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={() => onSeleccionar('saltado')}
            className="min-h-[44px] px-5 border border-black/15 text-sm font-medium"
          >
            Saltear paso
          </button>
          <button
            type="button"
            disabled={!seleccion}
            onClick={onContinuar}
            className="min-h-[44px] px-6 bg-black text-white text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-2"
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectorVariante({
  producto,
  varianteSeleccionada,
  onCambiarVariante,
  onCambiarMate,
}: {
  producto: Producto;
  varianteSeleccionada: VarianteProducto | null;
  onCambiarVariante: (v: VarianteProducto) => void;
  onCambiarMate: () => void;
}) {
  // El detalle completo (variantes con variante_valores/imagen) se resuelve con la ficha del producto,
  // igual que en ProductoDetalle, para reusar el mismo shape de datos.
  const { data: detalle, isLoading } = useQuery<Producto>({
    queryKey: ['producto-detalle-configurador', producto.slug],
    queryFn: () => api.get(`/productos/${producto.slug}`).then((r) => r.data),
  });

  const variantes = detalle?.variantes_producto ?? producto.variantes_producto ?? [];

  return (
    <div className="border border-black/10 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-sm">{producto.nombre}</span>
        <button type="button" onClick={onCambiarMate} className="text-xs underline text-black/50 hover:text-black">
          Cambiar mate
        </button>
      </div>

      {isLoading && <div className="text-sm text-black/40 py-4">Cargando variantes...</div>}

      {!isLoading && variantes.length === 0 && (
        <div className="text-sm text-black/40 py-4">Este mate no tiene variantes configuradas.</div>
      )}

      {!isLoading && variantes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {variantes.map((v) => {
            const sinStock = !v.activo || v.stock <= 0;
            const seleccionada = varianteSeleccionada?.id === v.id;
            const etiqueta = v.variante_valores?.map((vv) => vv.valores_opcion.valor).join(' / ') || v.sku || 'Variante';
            return (
              <button
                key={v.id}
                type="button"
                disabled={sinStock}
                onClick={() => onCambiarVariante(v)}
                className={`text-left border p-3 min-h-[44px] transition-colors ${
                  sinStock
                    ? 'opacity-40 cursor-not-allowed border-black/10'
                    : seleccionada
                      ? 'border-black bg-black/[0.03]'
                      : 'border-black/15 hover:border-black/40'
                }`}
              >
                <span className="text-sm font-medium block">{etiqueta}</span>
                <span className="text-xs text-black/50">{sinStock ? 'Sin stock' : `Stock: ${v.stock}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Preview del combo mate + bombilla. Si hay imagen de bombilla Y un punto de anclaje
 * configurado por el admin para esta variante de mate, compone la bombilla sobre el
 * mate vía CSS (transform, sin foto real). Si falta cualquiera de los dos, cae al
 * fallback de mostrar las imágenes por separado — no es obligatorio, es un enhancement.
 */
function ComboPreview({
  mateImg,
  bombillaImg,
  anclaje,
}: {
  mateImg: string;
  bombillaImg: string | null;
  anclaje: Anclaje | null;
}) {
  const puedeComponer = !!bombillaImg && !!anclaje;

  if (puedeComponer) {
    return (
      <div className="relative w-full aspect-square mb-4 bg-black/[0.02] overflow-hidden">
        <img src={mateImg} alt="Mate" className="absolute inset-0 w-full h-full object-contain" />
        <img
          src={bombillaImg!}
          alt="Bombilla"
          className="absolute w-1/3"
          style={{
            left: `${anclaje!.anclaje_x}%`,
            top: `${anclaje!.anclaje_y}%`,
            transform: `translate(-50%, -50%) rotate(${anclaje!.rotacion}deg) scale(${anclaje!.escala})`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-4">
      <img src={mateImg} alt="Mate" className="w-full aspect-square object-contain bg-black/[0.02]" />
      {bombillaImg && <img src={bombillaImg} alt="Bombilla" className="w-full aspect-square object-contain bg-black/[0.02]" />}
    </div>
  );
}

function Paso4Grabado({
  costoGrabado,
  seleccion,
  onSeleccionar,
  onAtras,
  onContinuar,
}: {
  costoGrabado: number;
  seleccion: SeleccionGrabado | 'saltado' | undefined;
  onSeleccionar: (s: SeleccionGrabado | 'saltado' | undefined) => void;
  onAtras: () => void;
  onContinuar: () => void;
}) {
  const [texto, setTexto] = useState(seleccion !== 'saltado' && seleccion?.tipo === 'texto' ? seleccion.texto : '');

  const { data: disenos, isLoading } = useQuery<DisenoPredeterminado[]>({
    queryKey: ['configurador-disenos-predeterminados'],
    queryFn: () => api.get('/configurador/disenos-predeterminados').then((r) => r.data),
  });

  const disenoElegido = seleccion !== 'saltado' && seleccion?.tipo === 'predeterminado' ? seleccion.diseno : null;

  const elegirDiseno = (d: DisenoPredeterminado) => {
    setTexto('');
    onSeleccionar({ tipo: 'predeterminado', diseno: d });
  };

  const cambiarTexto = (value: string) => {
    setTexto(value);
    onSeleccionar(value.trim() ? { tipo: 'texto', texto: value } : undefined);
  };

  const usandoTextoLibre = !disenoElegido && texto.trim().length > 0;

  return (
    <div>
      <h2 className="text-lg font-medium mb-1">Elegí un grabado (opcional)</h2>
      {costoGrabado > 0 && (
        <p className="text-xs text-black/50 mb-4">Personalización: +${costoGrabado.toLocaleString('es-AR')}</p>
      )}

      {isLoading && <div className="text-sm text-black/40 py-6">Cargando diseños...</div>}

      {!isLoading && (disenos?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {disenos!.map((d) => {
            const seleccionado = disenoElegido?.id === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => elegirDiseno(d)}
                className={`text-left border p-3 min-h-[44px] transition-colors ${
                  seleccionado ? 'border-black bg-black/[0.03]' : 'border-black/15 hover:border-black/40'
                }`}
              >
                <img src={d.imagen_url} alt={d.nombre} className="w-full h-24 object-cover mb-2" />
                <span className="text-xs font-medium flex items-center gap-1">
                  {seleccionado && <Check size={12} />} {d.nombre}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs text-black/50 mb-1 block font-medium">
          O contanos tu idea (si no elegís un diseño predeterminado)
        </label>
        <textarea
          value={texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          placeholder="Ej: quiero mi nombre con un mate y unas iniciales..."
          className="w-full border border-black/15 p-3 text-sm resize-none h-24 focus:outline-none focus:border-black/40"
        />
      </div>

      {usandoTextoLibre && (
        <div className="bg-[#E1F5EE] border border-[#5DCAA5] text-[#085041] p-4 mb-6 flex items-start gap-3">
          <MessageCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed font-medium">
            No elegiste un diseño predeterminado — nuestro equipo te va a contactar para definir el diseño final antes de producir tu mate.
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 md:justify-between mt-6">
        <button
          type="button"
          onClick={onAtras}
          className="min-h-[44px] px-5 border border-black/15 text-sm font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={() => { setTexto(''); onSeleccionar('saltado'); }}
            className="min-h-[44px] px-5 border border-black/15 text-sm font-medium"
          >
            Saltear paso
          </button>
          <button
            type="button"
            disabled={!seleccion}
            onClick={onContinuar}
            className="min-h-[44px] px-6 bg-black text-white text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-2"
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Paso5Resumen({
  seleccionMate,
  seleccionBombilla,
  seleccionGrabado,
  precioMate,
  precioBombilla,
  precioGrabado,
  precioTotal,
  onAtras,
}: {
  seleccionMate: SeleccionMate;
  seleccionBombilla: SeleccionBombilla | 'saltado' | undefined;
  seleccionGrabado: SeleccionGrabado | 'saltado' | undefined;
  precioMate: number;
  precioBombilla: number;
  precioGrabado: number;
  precioTotal: number;
  onAtras: () => void;
}) {
  const navigate = useNavigate();
  const agregar = useCarritoStore((s) => s.agregar);
  const mostrarToast = useToastStore((s) => s.agregar);

  const bombillaElegida = seleccionBombilla !== 'saltado' ? seleccionBombilla : null;
  const grabadoElegido = seleccionGrabado !== 'saltado' ? seleccionGrabado : null;

  const varianteIds = [
    seleccionMate.variante!.id,
    ...(bombillaElegida ? [bombillaElegida.variante.id] : []),
  ];

  // Validación de stock en tiempo real justo antes de agregar al carrito: si algo se
  // agotó mientras el cliente decidía, se refleja acá antes de que llegue al carrito.
  const { data: stockActual, isLoading: validandoStock } = useQuery<{ variante_id: string; stock: number; activo: boolean }[]>({
    queryKey: ['configurador-stock-variantes', varianteIds.join(',')],
    queryFn: () => api.get('/configurador/stock-variantes', { params: { ids: varianteIds.join(',') } }).then((r) => r.data),
  });

  const stockMate = stockActual?.find((s) => s.variante_id === seleccionMate.variante!.id);
  const stockBombilla = bombillaElegida ? stockActual?.find((s) => s.variante_id === bombillaElegida.variante.id) : undefined;
  const mateSinStock = stockMate && (!stockMate.activo || stockMate.stock <= 0);
  const bombillaSinStock = bombillaElegida && stockBombilla && (!stockBombilla.activo || stockBombilla.stock <= 0);

  const agregarAlCarrito = () => {
    const combo_id = crypto.randomUUID();

    agregar({
      producto_id: seleccionMate.producto.id,
      variante_id: seleccionMate.variante!.id,
      variante_descripcion: seleccionMate.variante!.variante_valores?.map((v) => v.valores_opcion.valor).join(' / '),
      nombre_producto: seleccionMate.producto.nombre,
      precio_unitario: precioMate,
      cantidad: 1,
      imagen_url: seleccionMate.variante!.imagenes_producto?.url ?? seleccionMate.producto.imagenes_producto[0]?.url,
      stock: stockMate?.stock,
      combo_id,
    });

    if (bombillaElegida) {
      agregar({
        producto_id: bombillaElegida.producto.id,
        variante_id: bombillaElegida.variante.id,
        variante_descripcion: bombillaElegida.variante.variante_valores?.map((v) => v.valores_opcion.valor).join(' / '),
        nombre_producto: bombillaElegida.producto.nombre,
        precio_unitario: precioBombilla,
        cantidad: 1,
        imagen_url: bombillaElegida.variante.imagenes_producto?.url ?? bombillaElegida.producto.imagenes_producto[0]?.url,
        stock: stockBombilla?.stock,
        combo_id,
      });
    }

    if (grabadoElegido) {
      agregar({
        // El grabado no es un producto propio: se factura sobre el mate elegido (mismo producto_id).
        producto_id: seleccionMate.producto.id,
        nombre_producto: 'Grabado personalizado',
        texto_grabado: grabadoElegido.tipo === 'texto' ? grabadoElegido.texto : grabadoElegido.diseno.nombre,
        precio_unitario: precioGrabado,
        cantidad: 1,
        imagen_url: grabadoElegido.tipo === 'predeterminado' ? grabadoElegido.diseno.imagen_url : undefined,
        combo_id,
      });
    }

    mostrarToast('Tu mate diseñado se agregó al carrito');
    navigate('/carrito');
  };

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">Revisá tu mate antes de agregarlo al carrito</h2>

      <div className="border border-black/10 divide-y divide-black/10 mb-6">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-black/50">Mate</span>
          <span className={`font-medium ${mateSinStock ? 'text-red-500' : ''}`}>
            {seleccionMate.producto.nombre}
            {mateSinStock ? ' — se quedó sin stock' : ` — $${precioMate.toLocaleString('es-AR')}`}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-black/50">Bombilla</span>
          <span className={`font-medium ${bombillaSinStock ? 'text-red-500' : ''}`}>
            {!bombillaElegida
              ? 'Sin bombilla'
              : bombillaSinStock
                ? `${bombillaElegida.producto.nombre} — se quedó sin stock`
                : `${bombillaElegida.producto.nombre} — +$${precioBombilla.toLocaleString('es-AR')}`}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-black/50">Grabado</span>
          <span className="font-medium">
            {!grabadoElegido
              ? 'Sin grabado'
              : grabadoElegido.tipo === 'predeterminado'
                ? `${grabadoElegido.diseno.nombre}${precioGrabado > 0 ? ` — +$${precioGrabado.toLocaleString('es-AR')}` : ''}`
                : `Idea a definir${precioGrabado > 0 ? ` — +$${precioGrabado.toLocaleString('es-AR')}` : ''}`}
          </span>
        </div>
      </div>

      {grabadoElegido?.tipo === 'texto' && (
        <div className="bg-[#E1F5EE] border border-[#5DCAA5] text-[#085041] p-4 mb-6 flex items-start gap-3">
          <MessageCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            Nuestro equipo te va a contactar para definir el diseño final antes de producir tu mate.
          </p>
        </div>
      )}

      {(mateSinStock || bombillaSinStock) && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 text-sm">
          Algo de tu combo se quedó sin stock mientras decidías. Volvé atrás para elegir otra opción.
        </div>
      )}

      <div className="flex justify-start mb-4">
        <button
          type="button"
          onClick={onAtras}
          className="min-h-[44px] px-5 border border-black/15 text-sm font-medium flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:static bg-white border-t md:border border-black/10 p-4 flex items-center justify-between gap-4 z-40">
        <div>
          <p className="text-xs text-black/50">Total</p>
          <p className="text-xl font-semibold">${precioTotal.toLocaleString('es-AR')}</p>
        </div>
        <button
          type="button"
          onClick={agregarAlCarrito}
          disabled={validandoStock || !!mateSinStock || !!bombillaSinStock}
          className="min-h-[44px] px-6 bg-black text-white text-sm font-medium flex items-center gap-2 disabled:opacity-30"
        >
          <ShoppingCart size={16} /> Agregar al carrito
        </button>
      </div>
    </div>
  );
}

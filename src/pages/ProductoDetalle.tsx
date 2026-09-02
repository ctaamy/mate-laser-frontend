import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Truck, Shield, MessageCircle, ChevronRight, Minus, Plus, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';
import type { Producto } from '../types';
import BadgeAptoGrabado from '../components/ui/BadgeAptoGrabado';
import CuotasBanner from '../components/ui/CuotasBanner';

const T = { duration: 0.4, ease: 'easeOut' as const };

export default function ProductoDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const [valoresSeleccionados, setValoresSeleccionados] = useState<Record<string, string>>({});
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

  // Config real de envío gratis (GET /configuracion, público, lee 'publicado').
  // El cartel "Envío gratis en compras mayores a $X" solo se muestra si esto
  // confirma que está activo y con un monto válido — nunca un texto fijo.
  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then((r) => r.data),
  });
  const montoEnvioGratis = Number(config?.envio_gratis_monto);
  const envioGratisConfirmado =
    config?.envio_gratis_activo === 'true' && Number.isFinite(montoEnvioGratis) && montoEnvioGratis > 0;

  // Tipos de opción con un único valor: no son una elección real. Se
  // autoseleccionan al cargar para no bloquear precio/stock/CTA sin motivo
  // (caso típico: "Bombilla" con una sola variante).
  useEffect(() => {
    const tipos = producto?.tipos_opcion;
    if (!tipos?.length) return;
    const faltan = tipos.filter((t) => t.valores.length === 1 && !valoresSeleccionados[t.id]);
    if (!faltan.length) return;
    setValoresSeleccionados((prev) => {
      const next = { ...prev };
      for (const t of faltan) next[t.id] = t.valores[0].id;
      return next;
    });
  }, [producto, valoresSeleccionados]);


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
  const precioBaseProducto = Number(producto.precio_base);

  const imagenes = producto.imagenes_producto ?? [];
  // El backend ya devuelve tipos y valores ordenados por `orden` (findOne en
  // productos.service.ts). Este sort es defensivo: que el componente no dependa
  // en silencio del orden de la API.
  const tiposOpcion = [...(producto.tipos_opcion ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((t) => ({ ...t, valores: [...t.valores].sort((x, y) => x.orden - y.orden) }));
  const variantes = producto.variantes_producto ?? [];
  const tieneVariantes = tiposOpcion.length > 0;

  const combinacionCompleta = tieneVariantes && tiposOpcion.every((t) => valoresSeleccionados[t.id]);
  const varianteSeleccionada = combinacionCompleta
    ? variantes.find((v) => {
        const idsVariante = new Set((v.variante_valores ?? []).map((vv) => vv.valor_opcion_id));
        const idsElegidos = Object.values(valoresSeleccionados);
        return idsElegidos.length === idsVariante.size && idsElegidos.every((id) => idsVariante.has(id));
      })
    : undefined;

  // Hallazgo #8 (Fase 2): el público ya no recibe el stock exacto, solo
  // disponible/pocas_unidades/cantidad_maxima (ver types/index.ts).
  const fuenteStock = varianteSeleccionada ?? producto;
  const disponible = fuenteStock.disponible ?? false;
  const pocasUnidades = fuenteStock.pocas_unidades ?? false;
  const cantidadMaxima = fuenteStock.cantidad_maxima ?? 0;
  const puedeAgregar = disponible && (!tieneVariantes || !!varianteSeleccionada);

  // Imagen a mostrar: la de la variante resuelta; y si todavía es una selección
  // parcial, la de la primera variante compatible que tenga imagen (preferimos
  // una con stock). Da feedback visual antes de completar la combinación.
  const seleccionParcial = !varianteSeleccionada && Object.keys(valoresSeleccionados).length > 0;
  const matchImagenParcial = (soloConStock: boolean) =>
    variantes.find((v) => {
      if (!v.imagenes_producto) return false;
      if (soloConStock && !(v.disponible ?? false)) return false;
      const ids = new Set((v.variante_valores ?? []).map((vv) => vv.valor_opcion_id));
      return Object.values(valoresSeleccionados).every((id) => ids.has(id));
    });
  const imagenVariante =
    varianteSeleccionada?.imagenes_producto ??
    (seleccionParcial
      ? (matchImagenParcial(true) ?? matchImagenParcial(false))?.imagenes_producto
      : undefined);

  const varianteDescripcion = varianteSeleccionada
    ? tiposOpcion
        .map((t) => `${t.nombre}: ${t.valores.find((v) => v.id === valoresSeleccionados[t.id])?.valor}`)
        .join(' / ')
    : undefined;

  // Tipos que todavía no tienen un valor elegido, para mensajes accionables
  // ("Elegí color y bombilla") en vez de un genérico "seleccioná una opción".
  const tiposFaltantes = tiposOpcion.filter((t) => !valoresSeleccionados[t.id]);
  const listarNombres = (xs: string[]) =>
    xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
  const faltanNombres = listarNombres(tiposFaltantes.map((t) => t.nombre.toLowerCase()));
  // Único caso que no tiene ya su propia línea visible: falta elegir opciones.
  // Los otros ("sin stock", "combinación no disponible") los cubre la línea de
  // stock / el texto bajo el selector.
  const motivoNoAgregar =
    tieneVariantes && !varianteSeleccionada && tiposFaltantes.length > 0
      ? `Elegí ${faltanNombres} para continuar`
      : '';

  // ── Disponibilidad por valor (Fase 2) ──
  // Para cada valor de cada tipo, decidir si combinándolo con lo ya elegido en
  // los OTROS tipos existe al menos una variante con stock. Los que no, se
  // marcan y deshabilitan. Salvaguarda: si TODOS los valores de un tipo
  // quedarían deshabilitados, no se marca ninguno (así el tipo nunca queda sin
  // opción clickeable y no se llega a un callejón sin salida, dado que en Fase 1
  // el selector dejó de permitir deseleccionar).
  const idsDeVariante = (v: (typeof variantes)[number]) =>
    new Set((v.variante_valores ?? []).map((vv) => vv.valor_opcion_id));
  const variantesConStock = variantes.filter((v) => v.disponible ?? false);
  const valorAlcanzable = (tipoId: string, valorId: string) => {
    const requeridos = Object.values({ ...valoresSeleccionados, [tipoId]: valorId });
    return variantesConStock.some((v) => {
      const ids = idsDeVariante(v);
      return requeridos.every((id) => ids.has(id));
    });
  };
  const valoresSinStock = new Set<string>();
  for (const tipo of tiposOpcion) {
    const sin = tipo.valores.filter((val) => !valorAlcanzable(tipo.id, val.id));
    if (sin.length < tipo.valores.length) sin.forEach((val) => valoresSinStock.add(val.id));
  }

  // Precio efectivo de una variante: su precio_override si tiene uno, si no el
  // precio_base del producto (mismo criterio que el backend).
  const precioDeVariante = (v: { precio_override?: number | null }) =>
    v.precio_override != null ? Number(v.precio_override) : precioBaseProducto;

  const precioVariante = varianteSeleccionada ? precioDeVariante(varianteSeleccionada) : precioBaseProducto;
  const esPrecioOverride =
    varianteSeleccionada?.precio_override != null &&
    Number(varianteSeleccionada.precio_override) !== precioBaseProducto;
  const deltaVsBase = precioVariante - precioBaseProducto;

  // "Desde $X": solo si las variantes comprables (con stock) no cuestan todas
  // lo mismo. X = el más barato de esos precios efectivos (no apuntar el
  // "Desde" a una combinación sin stock).
  const preciosComprables = variantes.filter((v) => v.disponible ?? false).map(precioDeVariante);
  const hayDispersionPrecio = new Set(preciosComprables).size > 1;
  const precioDesde = preciosComprables.length ? Math.min(...preciosComprables) : precioBaseProducto;
  const mostrarDesde = tieneVariantes && !varianteSeleccionada && hayDispersionPrecio;

  // Delta de precio por valor (solo si hay dispersión): si TODAS las variantes
  // con stock que combinan ese valor con lo ya elegido comparten un mismo
  // precio efectivo distinto del base, se muestra "+$X" / "−$X" junto al valor.
  // Si es ambiguo (varios precios posibles), no se muestra nada.
  const deltaPrecioValor = (tipoId: string, valorId: string): number | null => {
    if (!hayDispersionPrecio) return null;
    const requeridos = Object.values({ ...valoresSeleccionados, [tipoId]: valorId });
    const precios = new Set(
      variantesConStock
        .filter((v) => {
          const ids = idsDeVariante(v);
          return requeridos.every((id) => ids.has(id));
        })
        .map(precioDeVariante),
    );
    if (precios.size !== 1) return null;
    const delta = [...precios][0] - precioBaseProducto;
    return delta !== 0 ? delta : null;
  };

  const precioFinal =
    (mostrarDesde ? precioDesde : precioVariante) + (quierePersonalizar ? costoGrabado : 0);

  // precio_tachado se calcula contra precio_base. Si el precio que se muestra
  // no es el base (variante con precio propio, o "Desde" con variantes de
  // precio propio en juego), un "-X%" sobre otro número es engañoso → se oculta.
  const algunaVarianteConPrecioPropio = variantes.some((v) => v.precio_override != null);
  const ocultarDescuento =
    esPrecioOverride || (tieneVariantes && !varianteSeleccionada && algunaVarianteConPrecioPropio);
  const tieneDescuento =
    !ocultarDescuento &&
    !!producto.precio_tachado &&
    Number(producto.precio_tachado) > precioBaseProducto;
  const descuentoPct = tieneDescuento
    ? Math.round((1 - precioBaseProducto / Number(producto.precio_tachado!)) * 100)
    : 0;

  const handleAgregar = () => {
    if (!puedeAgregar) return;
    agregar({
      producto_id: producto.id,
      variante_id: varianteSeleccionada?.id,
      variante_descripcion: varianteDescripcion,
      nombre_producto: producto.nombre,
      precio_unitario: precioFinal,
      cantidad,
      con_grabado: quierePersonalizar || undefined,
      texto_grabado: quierePersonalizar ? (textoGrabado || undefined) : undefined,
      imagen_url: imagenVariante?.url ?? producto.imagenes_producto?.[0]?.url,
      stock: cantidadMaxima,
    });
    setAgregado(true);
    setTimeout(() => setAgregado(false), 2000);
    mostrarToast(producto.nombre, imagenVariante?.url ?? producto.imagenes_producto?.[0]?.url);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* BREADCRUMB */}
      <div className="border-b border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-[11px] text-black/35 font-medium overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link to="/" className="hover:text-black transition-colors">Inicio</Link>
          <ChevronRight size={10} />
          <Link to="/productos" className="hover:text-black transition-colors">Productos</Link>
          <ChevronRight size={10} />
          <span className="text-black/70">{producto.nombre}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-20">

          {/* ── GALERÍA ── */}
          <div className="flex flex-col gap-3">
            {/* Imagen principal */}
            <div className="relative bg-[#f5f5f5] overflow-hidden" style={{ aspectRatio: '4/5' }}>
              <AnimatePresence mode="wait">
                {imagenVariante || imagenes[imagenActiva] ? (
                  <motion.img
                    key={imagenVariante?.id ?? imagenes[imagenActiva].id}
                    src={imagenVariante?.url ?? imagenes[imagenActiva].url}
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
                <div className="absolute top-0 left-0">
                  <BadgeAptoGrabado />
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
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {imagenes.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setImagenActiva(i)}
                    className="relative flex-shrink-0 overflow-hidden transition-opacity"
                    style={{ width: 64, height: 64, opacity: i === imagenActiva ? 1 : 0.45 }}
                  >
                    <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
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
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                {mostrarDesde && <span className="text-sm font-medium text-black/40">Desde</span>}
                <motion.span
                  key={precioFinal}
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl font-bold tracking-tight text-black"
                >
                  ${precioFinal.toLocaleString('es-AR')}
                </motion.span>
                {tieneDescuento && !quierePersonalizar && (
                  <span className="text-base text-black/30 line-through font-medium">
                    ${Number(producto.precio_tachado).toLocaleString('es-AR')}
                  </span>
                )}
              </div>

              {mostrarDesde && (
                <p className="text-[11px] text-black/40">El precio final depende de las opciones que elijas.</p>
              )}

              {varianteSeleccionada && esPrecioOverride && (
                <p className="text-[11px] text-black/45">
                  Precio para <span className="text-black/70 font-medium">{varianteDescripcion}</span>
                  {' · '}
                  {deltaVsBase > 0
                    ? `$${Math.abs(deltaVsBase).toLocaleString('es-AR')} más que el precio base`
                    : `$${Math.abs(deltaVsBase).toLocaleString('es-AR')} menos que el precio base`}
                </p>
              )}

              {!mostrarDesde && quierePersonalizar && costoGrabado > 0 && (
                <p className="text-[11px] text-black/35">
                  ${precioVariante.toLocaleString('es-AR')} + ${costoGrabado.toLocaleString('es-AR')} grabado
                </p>
              )}
            </div>

            <CuotasBanner productoId={producto.id} />

            <div className="h-px bg-black/[0.07]" />

            {/* Material */}
            {producto.material && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 mb-2">Material</p>
                <p className="text-sm font-medium text-black">{producto.material}</p>
              </div>
            )}

            {/* Selector de opciones (variantes) */}
            {tieneVariantes && (
              <div className="flex flex-col gap-4">
                {tiposOpcion.map((tipo) => (
                  <div key={tipo.id} role="group" aria-labelledby={`opt-${tipo.id}`}>
                    <p id={`opt-${tipo.id}`} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 mb-2">
                      {tipo.nombre}
                      {valoresSeleccionados[tipo.id] && (
                        <span className="text-black">
                          {' '}
                          · {tipo.valores.find((v) => v.id === valoresSeleccionados[tipo.id])?.valor}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tipo.valores.map((valor) => {
                        const elegido = valoresSeleccionados[tipo.id] === valor.id;
                        const sinStock = !elegido && valoresSinStock.has(valor.id);
                        const delta = sinStock ? null : deltaPrecioValor(tipo.id, valor.id);
                        return (
                          <button
                            key={valor.id}
                            aria-pressed={elegido}
                            aria-label={sinStock ? `${valor.valor} — sin stock para esta combinación` : undefined}
                            disabled={sinStock}
                            title={sinStock ? 'Sin stock para esta combinación' : undefined}
                            onClick={() => {
                              if (elegido) return; // selector obligatorio: no se deselecciona
                              setCantidad(1);
                              setValoresSeleccionados((prev) => ({ ...prev, [tipo.id]: valor.id }));
                            }}
                            className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                              elegido
                                ? 'border-black bg-black text-white'
                                : sinStock
                                  ? 'border-black/10 text-black/25 line-through cursor-not-allowed'
                                  : 'border-black/15 text-black/60 hover:border-black/40'
                            }`}
                          >
                            {valor.valor}
                            {delta != null && (
                              <span className={`ml-1 ${elegido ? 'text-white/55' : 'text-black/35'}`}>
                                {delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('es-AR')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {tiposFaltantes.length > 0 && (
                  <p className="text-[11px] text-black/40">
                    Elegí {faltanNombres} para ver el stock y el precio.
                  </p>
                )}
                {tiposFaltantes.length === 0 && !varianteSeleccionada && (
                  <p className="text-[11px] text-black/40">Esa combinación todavía no está disponible.</p>
                )}
                {valoresSinStock.size > 0 && (
                  <p className="text-[11px] text-black/40">
                    Las opciones <span className="line-through">tachadas</span> no tienen stock para esta combinación.
                  </p>
                )}
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

            {/* Stock — solo una vez que hay una variante resuelta (o el producto
                no tiene variantes). Antes de eso, el mensaje bajo el selector
                ("Elegí X para ver el stock y el precio") ya cubre el estado. */}
            {(!tieneVariantes || varianteSeleccionada) && (
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${disponible ? (pocasUnidades ? 'bg-amber-500' : 'bg-black') : 'bg-black/20'}`} />
                <span className={disponible ? (pocasUnidades ? 'text-amber-600' : 'text-black/60') : 'text-black/25'}>
                  {disponible
                    ? pocasUnidades
                      ? '¡Últimas unidades! · Entrega en 3–5 días hábiles'
                      : 'Stock disponible · Entrega en 3–5 días hábiles'
                    : 'Sin stock disponible'}
                </span>
              </div>
            )}

            {/* Cantidad + agregar — sticky al borde inferior en mobile para
                que el CTA quede siempre a mano sin scrollear hasta el fondo. */}
            <div className="flex flex-col gap-2 sticky bottom-0 z-20 bg-white py-3 -mx-4 px-4 border-t border-black/[0.08] sm:static sm:bg-transparent sm:py-0 sm:mx-0 sm:px-0 sm:border-0">
              {/* Motivo por el que el CTA está bloqueado, pegado al botón. */}
              {!puedeAgregar && motivoNoAgregar && (
                <p className="text-[11px] font-medium text-black/45">{motivoNoAgregar}</p>
              )}

              <div className="flex items-stretch gap-3">
                {/* Selector cantidad — inerte hasta que haya una variante con stock. */}
                <div className={`flex items-center border border-black/15 min-h-[44px] sm:min-h-0 transition-opacity ${puedeAgregar ? '' : 'opacity-40 pointer-events-none'}`}>
                  <button aria-label="Restar una unidad" disabled={!puedeAgregar} onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    className="w-10 sm:w-9 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors h-full">
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-black select-none">{cantidad}</span>
                  <button aria-label="Sumar una unidad" disabled={!puedeAgregar} onClick={() => setCantidad(Math.min(Math.max(1, cantidadMaxima), cantidad + 1))}
                    className="w-10 sm:w-9 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/[0.04] transition-colors h-full">
                    <Plus size={12} />
                  </button>
                </div>

                {/* Botón agregar */}
                <motion.button
                  onClick={handleAgregar}
                  disabled={!puedeAgregar}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-0 text-sm font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-30"
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
            </div>

            <div className="h-px bg-black/[0.07]" />

            {/* Info extra */}
            <div className="flex flex-col gap-3">
              {[
                ...(envioGratisConfirmado
                  ? [{ Icon: Truck, bold: 'Envío gratis', rest: `en compras mayores a $${montoEnvioGratis.toLocaleString('es-AR')}` }]
                  : []),
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

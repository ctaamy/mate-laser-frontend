import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, MessageCircle, Upload, X, ShoppingCart } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore, type SeleccionConfigurador } from '../store/carrito.store';
import { useToastStore } from '../store/toast.store';

interface OpcionConfigurador {
  id: string;
  variante_id: string;
  nombre_visible: string;
  descripcion_corta?: string | null;
  imagen_url?: string | null;
  precio: number;
  precio_base_producto: number;
  sinStock: boolean;
}

interface PasoConfigurador {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  salteable: boolean;
  nota_texto?: string | null;
  permite_upload: boolean;
  es_resumen: boolean;
  opciones: OpcionConfigurador[];
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

export default function DisenaTuMate() {
  const navigate = useNavigate();
  const agregar = useCarritoStore((s) => s.agregar);
  const mostrarToast = useToastStore((s) => s.agregar);

  const { data: pasos, isLoading } = useQuery<PasoConfigurador[]>({
    queryKey: ['configurador-pasos'],
    queryFn: () => api.get('/configurador/pasos').then((r) => r.data),
  });

  const [pasoActivo, setPasoActivo] = useState(0);
  // slug -> selección (undefined si fue salteado explícitamente pero registrado como skip)
  const [selecciones, setSelecciones] = useState<Record<string, OpcionConfigurador | 'saltado' | undefined>>({});
  const [disponibilidad, setDisponibilidad] = useState<Record<string, boolean>>({}); // opcion_id -> sinStock
  const [subiendo, setSubiendo] = useState(false);
  const [errorUpload, setErrorUpload] = useState('');
  const [diseñoUrl, setDiseñoUrl] = useState<string | null>(null);
  const [diseñoNombre, setDiseñoNombre] = useState<string | null>(null);

  const paso = pasos?.[pasoActivo];

  // Recalcula disponibilidad cruzada cuando cambia el paso activo o las selecciones previas.
  useEffect(() => {
    if (!paso || paso.es_resumen) return;
    const variante_ids = Object.values(selecciones)
      .filter((s): s is OpcionConfigurador => !!s && s !== 'saltado')
      .map((s) => s.variante_id);

    api
      .post(`/configurador/pasos/${paso.id}/disponibilidad`, { variante_ids })
      .then((r) => {
        const map: Record<string, boolean> = {};
        for (const item of r.data) map[item.id] = item.sinStock;
        setDisponibilidad(map);
      })
      .catch(() => setDisponibilidad({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso?.id]);

  const seleccionesArray: SeleccionConfigurador[] = useMemo(() => {
    if (!pasos) return [];
    const arr: SeleccionConfigurador[] = [];
    for (const p of pasos) {
      if (p.es_resumen) continue;
      const sel = selecciones[p.slug];
      if (sel && sel !== 'saltado') {
        arr.push({
          paso_slug: p.slug,
          opcion_id: sel.id,
          variante_id: sel.variante_id,
          nombre: sel.nombre_visible,
          precio: sel.precio,
        });
      }
    }
    if (diseñoUrl) {
      const pasoDiseno = pasos.find((p) => p.permite_upload);
      arr.push({
        paso_slug: pasoDiseno?.slug ?? 'diseno',
        nombre: `Diseño de referencia: ${diseñoNombre ?? ''}`,
        precio: 0,
        imagen_referencia_url: diseñoUrl,
      });
    }
    return arr;
  }, [selecciones, diseñoUrl, diseñoNombre, pasos]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-black/40">
        Cargando configurador...
      </div>
    );
  }

  if (!pasos || pasos.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-black/40">
        El configurador todavía no tiene pasos configurados.
      </div>
    );
  }

  const seleccionarOpcion = (opcion: OpcionConfigurador) => {
    if (!paso) return;
    setSelecciones((prev) => ({ ...prev, [paso.slug]: opcion }));
  };

  const saltarPaso = () => {
    if (!paso) return;
    setSelecciones((prev) => ({ ...prev, [paso.slug]: 'saltado' }));
    irSiguiente();
  };

  const irSiguiente = () => setPasoActivo((i) => Math.min(i + 1, (pasos?.length ?? 1) - 1));
  const irAtras = () => setPasoActivo((i) => Math.max(i - 1, 0));

  const validarArchivo = (file: File): string | null => {
    if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usá JPG, PNG o WEBP.';
    if (file.size > MAX_UPLOAD_BYTES) return 'El archivo supera el límite de 10 MB.';
    return null;
  };

  const handleFile = async (file: File) => {
    setErrorUpload('');
    const err = validarArchivo(file);
    if (err) {
      setErrorUpload(err);
      return;
    }
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/configurador/upload-diseno', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDiseñoUrl(data.url);
      setDiseñoNombre(file.name);
    } catch (e: any) {
      setErrorUpload(e?.response?.data?.message || 'Error al subir el diseño.');
    } finally {
      setSubiendo(false);
    }
  };

  const precioTotal = seleccionesArray.reduce((acc, s) => acc + s.precio, 0);

  const agregarAlCarrito = () => {
    const primeraSeleccion = seleccionesArray.find((s) => s.opcion_id);
    agregar({
      producto_id: primeraSeleccion?.variante_id ?? 'configurador',
      variante_id: primeraSeleccion?.variante_id,
      nombre_producto: 'Mate diseñado a medida',
      precio_unitario: precioTotal,
      cantidad: 1,
      selecciones_configurador: seleccionesArray,
    });
    mostrarToast('Tu mate diseñado se agregó al carrito');
    navigate('/carrito');
  };

  const opcionesPaso = paso?.opciones ?? [];
  const seleccionActual = paso ? selecciones[paso.slug] : undefined;
  const puedeContinuar = paso?.es_resumen ? true : !!seleccionActual;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 pb-32 md:pb-10">
      <h1 className="text-2xl font-semibold mb-1">Diseñá tu mate</h1>
      <p className="text-sm text-black/50 mb-8">Armá tu mate a medida paso a paso.</p>

      {/* STEPPER */}
      <div className="mb-10">
        {/* Mobile: número + label del paso activo */}
        <div className="flex md:hidden items-center justify-between text-sm font-medium mb-2">
          <span>Paso {pasoActivo + 1} de {pasos.length}</span>
          <span className="text-black/60">{paso?.nombre}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 overflow-x-auto">
          {pasos.map((p, i) => {
            const activo = i === pasoActivo;
            const hecho = i < pasoActivo;
            return (
              <div key={p.id} className="flex items-center gap-1 md:gap-2 shrink-0">
                <div
                  className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-[11px] font-medium rounded-full shrink-0 ${
                    activo ? 'bg-black text-white' : hecho ? 'bg-black/10 text-black/60' : 'border border-black/15 text-black/30'
                  }`}
                >
                  {hecho ? <Check size={13} /> : i + 1}
                </div>
                <span className={`hidden md:inline text-xs ${activo ? 'font-medium text-black' : 'text-black/40'}`}>
                  {p.nombre}
                </span>
                {i < pasos.length - 1 && <div className="w-4 md:w-8 h-px bg-black/10" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO DEL PASO */}
      {paso && !paso.es_resumen && (
        <div>
          <h2 className="text-lg font-medium mb-4">{paso.nombre}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {opcionesPaso.map((op) => {
              const sinStock = op.sinStock || disponibilidad[op.id];
              const seleccionada = seleccionActual !== 'saltado' && (seleccionActual as OpcionConfigurador)?.id === op.id;
              const diferenciaPrecio = op.precio - op.precio_base_producto;
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={sinStock}
                  onClick={() => seleccionarOpcion(op)}
                  className={`text-left border p-4 min-h-[44px] transition-colors ${
                    sinStock
                      ? 'opacity-40 cursor-not-allowed border-black/10'
                      : seleccionada
                        ? 'border-black bg-black/[0.03]'
                        : 'border-black/15 hover:border-black/40'
                  }`}
                >
                  {op.imagen_url && (
                    <img src={op.imagen_url} alt={op.nombre_visible} className="w-full h-32 object-cover mb-3" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{op.nombre_visible}</span>
                    {seleccionada && <Check size={16} className="shrink-0" />}
                  </div>
                  {op.descripcion_corta && (
                    <p className="text-xs text-black/50 mt-1">{op.descripcion_corta}</p>
                  )}
                  <p className="text-xs mt-2 font-medium">
                    {sinStock ? 'Sin stock' : diferenciaPrecio > 0 ? `+$${diferenciaPrecio.toLocaleString('es-AR')}` : 'Incluido'}
                  </p>
                </button>
              );
            })}
          </div>

          {paso.permite_upload && (
            <div className="border border-dashed border-black/20 p-6 mb-6">
              <label className="flex flex-col items-center justify-center gap-2 cursor-pointer text-center min-h-[44px]">
                <Upload size={20} className="text-black/40" />
                <span className="text-sm text-black/60">
                  {subiendo ? 'Subiendo...' : 'Subí una imagen de referencia de tu diseño (JPG, PNG o WEBP, máx. 10MB)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {errorUpload && <p className="text-xs text-red-500 mt-2 text-center">{errorUpload}</p>}
              {diseñoUrl && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <img src={diseñoUrl} alt="Preview del diseño" className="w-20 h-20 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setDiseñoUrl(null); setDiseñoNombre(null); }}
                    className="text-xs text-black/50 hover:text-black flex items-center gap-1"
                  >
                    <X size={14} /> Quitar
                  </button>
                </div>
              )}
            </div>
          )}

          {paso.nota_texto && (
            <div className="bg-[#E1F5EE] border border-[#5DCAA5] text-[#085041] p-4 mb-6 flex items-start gap-3">
              <MessageCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{paso.nota_texto}</p>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3 md:justify-between">
            <button
              type="button"
              onClick={irAtras}
              disabled={pasoActivo === 0}
              className="min-h-[44px] px-5 border border-black/15 text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Atrás
            </button>
            <div className="flex flex-col md:flex-row gap-3">
              {paso.salteable && (
                <button
                  type="button"
                  onClick={saltarPaso}
                  className="min-h-[44px] px-5 border border-black/15 text-sm font-medium"
                >
                  Saltear paso
                </button>
              )}
              <button
                type="button"
                onClick={irSiguiente}
                disabled={!puedeContinuar}
                className="min-h-[44px] px-6 bg-black text-white text-sm font-medium disabled:opacity-30 flex items-center justify-center gap-2"
              >
                Continuar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESUMEN */}
      {paso && paso.es_resumen && (
        <div>
          <h2 className="text-lg font-medium mb-4">Resumen de tu mate</h2>
          <div className="border border-black/10 divide-y divide-black/10 mb-6">
            {pasos.filter((p) => !p.es_resumen).map((p) => {
              const sel = selecciones[p.slug];
              return (
                <div key={p.slug} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-black/50">{p.nombre}</span>
                  <span className="font-medium">
                    {sel === 'saltado' || !sel ? `Sin ${p.nombre.toLowerCase()}` : sel.nombre_visible}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-black/50">Diseño personalizado</span>
              <span className="font-medium">{diseñoUrl ? 'Imagen de referencia adjunta' : 'Sin diseño personalizado'}</span>
            </div>
          </div>

          {pasos.find((p) => p.permite_upload)?.nota_texto && (
            <div className="bg-[#E1F5EE] border border-[#5DCAA5] text-[#085041] p-4 mb-6 flex items-start gap-3">
              <MessageCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{pasos.find((p) => p.permite_upload)?.nota_texto}</p>
            </div>
          )}

          <div className="flex justify-between md:justify-start md:gap-3 mb-4">
            <button
              type="button"
              onClick={irAtras}
              className="min-h-[44px] px-5 border border-black/15 text-sm font-medium flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Atrás
            </button>
          </div>

          {/* Precio + CTA: sticky en mobile */}
          <div className="fixed bottom-0 left-0 right-0 md:static bg-white border-t md:border border-black/10 p-4 flex items-center justify-between gap-4 z-40">
            <div>
              <p className="text-xs text-black/50">Total</p>
              <p className="text-xl font-semibold">${precioTotal.toLocaleString('es-AR')}</p>
            </div>
            <button
              type="button"
              onClick={agregarAlCarrito}
              className="min-h-[44px] px-6 bg-black text-white text-sm font-medium flex items-center gap-2"
            >
              <ShoppingCart size={16} /> Agregar al carrito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

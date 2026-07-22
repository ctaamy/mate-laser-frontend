import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Save, Palette, Type, Layout, ChevronRight, Image } from 'lucide-react';
import api from '../../lib/api';
import SeccionImageUploader from '../../components/ui/SeccionImageUploader';
import type { Categoria } from '../../types/index';
import { useTemaGlobalData, type TemaGlobal } from '../../hooks/useThemeGlobal';
import { HomeSecciones } from '../../components/home/HomeSecciones';
import ScaledPreview from '../../components/admin/ScaledPreview';
import { STAT_ICONS, STAT_ICON_NAMES, STAT_ICON_FALLBACK } from '../../components/ui/StatIcons';

// ── tipos ────────────────────────────────────────────────────────────────────
type TipoSeccion = 'hero' | 'banner_texto' | 'productos_destacados' | 'categorias_grid' | 'texto_libre' | 'banner_imagen' | 'stats_barra' | 'como_funciona' | 'cta_banner' | 'filtros_rapidos';

// El navbar y el footer se guardan como una sección más cada uno (tipo
// 'navbar' / 'footer'), aunque no son seleccionables desde "Agregar sección"
// ni aparecen en la lista reordenable del tab Inicio — tienen su propia card
// fija y colapsable (navbar al principio, footer al final), porque ambos son
// elementos globales que aparecen en todas las páginas, no solo el inicio.
type SeccionTipo = TipoSeccion | 'navbar' | 'footer';

// Links del navbar — mismos defaults que ya usa el sitio público
// (DEFAULT_LINKS en Navbar.tsx) para que la migración no cambie nada.
const NAV_LINKS_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Personalizado', href: '/productos?personalizado=true' },
  { label: 'Nosotros', href: '/#nosotros' },
];

// Defaults del footer — calcados de lo que hoy está hardcodeado en
// Footer.tsx, para que la migración a sección no cambie nada visualmente
// hasta que el admin edite algo.
const FOOTER_LINKS_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: 'Contacto', href: '/#contacto' },
];
const FOOTER_REDES_DEFAULT = [
  { label: '@matelaserstudio', href: 'https://instagram.com/matelaserstudio' },
];
const FOOTER_TAGLINE_DEFAULT = 'Grabado láser personalizado · Todo Argentina';
const FOOTER_COPYRIGHT_DEFAULT = '© 2025 Mate Laser Studio';

interface Seccion {
  id: string;
  tipo: SeccionTipo;
  activo: boolean;
  orden: number;
  datos: Record<string, any>;
}

const TIPO_LABELS: Record<TipoSeccion, string> = {
  hero: 'Hero',
  banner_texto: 'Banner de texto',
  productos_destacados: 'Productos destacados',
  categorias_grid: 'Grilla de categorías',
  texto_libre: 'Texto libre (HTML)',
  banner_imagen: 'Banner imagen',
  stats_barra: 'Barra de estadísticas',
  como_funciona: 'Cómo funciona',
  cta_banner: 'CTA / Llamada a la acción',
  filtros_rapidos: 'Barra de filtros rápidos',
};

// Defaults de contenido + estilo por tipo
const TIPO_DEFAULTS: Record<TipoSeccion, Record<string, any>> = {
  hero: {
    // El slide NO trae bg_color/texto_color propios: así hereda del bloque
    // (abajo) por defecto, y el bloque es lo que se edita en el tab Estilo.
    // Si se le pone color acá, el slide lo tapa y "Estilo" deja de tener
    // efecto — por eso el color va solo a nivel de bloque.
    slides: [
      { titulo: 'Mates únicos,\nhechos a tu medida', subtitulo: 'Diseño exclusivo para cada cliente.', imagen_url: '', btn_texto: 'Ver colección', btn_link: '/productos' },
    ],
    intervalo: 5,
    bg_color: '#111111', texto_color: '#ffffff',
  },
  banner_texto: {
    texto: '',
    bg_color: '#1D9E75', texto_color: '#ffffff',
    font_size: 'sm', font_weight: 'medium', alineacion: 'center', padding: 'sm',
  },
  productos_destacados: {
    titulo: 'Lo más vendido', cantidad: 8,
    bg_color: '#ffffff', texto_color: '#111111',
    titulo_size: 'lg', columnas: 3, padding: 'md', alineacion: 'left',
  },
  categorias_grid: {
    titulo: 'Categorías', categorias_items: [],
    bg_color: '#f9fafb', texto_color: '#111111',
    titulo_size: 'lg', columnas: 4, padding: 'md', alineacion: 'left',
  },
  texto_libre: {
    html: '',
    bg_color: '#ffffff', padding: 'md',
  },
  banner_imagen: {
    imagen_url: '', link: '',
    border_radius: 'xl', max_height: '300', padding: 'sm', object_fit: 'cover',
  },
  stats_barra: {
    stats: [
      { valor: '1200+', label: 'Mates entregados', icono: 'Truck' },
      { valor: '98%', label: 'Clientes satisfechos', icono: 'BadgeCheck' },
      { valor: '48hs', label: 'Tiempo de entrega', icono: 'Clock' },
      { valor: '5★', label: 'Calificación', icono: 'Star' },
    ],
    bg_color: '#1D9E75', texto_color: '#ffffff',
  },
  como_funciona: {
    titulo: '¿Cómo funciona?',
    subtitulo: 'En 4 simples pasos tenés tu mate personalizado',
    pasos: [
      { icono: '🎨', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' },
      { icono: '✅', titulo: 'Aprobás el arte', desc: 'Te enviamos una previsualización del grabado para tu visto bueno.' },
      { icono: '⚡', titulo: 'Grabamos tu pieza', desc: 'Láser de precisión sobre acero inoxidable, madera o acrílico.' },
      { icono: '📦', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real.' },
    ],
    bg_color: '#0a2218', texto_color: '#ffffff',
  },
  cta_banner: {
    titulo: '¿Listo para personalizar tu mate?',
    subtitulo: 'Hablamos, diseñamos y grabamos. Sin límites de creatividad.',
    eyebrow: '¿Tenés una idea en mente?',
    btn_texto: 'Ver colección', btn_link: '/productos',
    bg_color: '#1D9E75', texto_color: '#ffffff',
  },
  filtros_rapidos: {
    items: [],
    bg_color: '#ffffff', texto_color: '#111111',
    padding: 'sm',
  },
};

// ── helpers de UI ─────────────────────────────────────────────────────────────
const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1D9E75]';
const selectCls = inputCls;
const labelCls = 'text-xs text-gray-500 mb-1 block';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
        <input className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={selectCls} value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const SIZES = [
  { value: 'xs', label: 'XS — Muy pequeño' },
  { value: 'sm', label: 'SM — Pequeño' },
  { value: 'base', label: 'Base — Normal' },
  { value: 'lg', label: 'LG — Grande' },
  { value: 'xl', label: 'XL — Más grande' },
  { value: '2xl', label: '2XL — Muy grande' },
  { value: '3xl', label: '3XL — Enorme' },
  { value: '4xl', label: '4XL — Extra' },
];

const PADDINGS = [
  { value: 'xs', label: 'XS — Mínimo' },
  { value: 'sm', label: 'SM — Chico' },
  { value: 'md', label: 'MD — Normal' },
  { value: 'lg', label: 'LG — Amplio' },
  { value: 'xl', label: 'XL — Muy amplio' },
];

const ALINEACIONES = [
  { value: 'left', label: 'Izquierda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Derecha' },
];

const PESOS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medio' },
  { value: 'semibold', label: 'Semi negrita' },
  { value: 'bold', label: 'Negrita' },
];

const IMAGE_POSITIONS = [
  { value: 'bleed', label: 'Bleed — sin marco, sangra al borde' },
  { value: 'contained', label: 'Contenida — bloque con borde definido' },
  { value: 'background', label: 'Fondo — foto completa con overlay' },
];

const TRANSICIONES = [
  { value: 'ninguna', label: 'Ninguna (corte plano)' },
  { value: 'degradado', label: 'Degradado — fundido suave' },
  { value: 'curva', label: 'Curva' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'ondulada', label: 'Ondulada' },
];

const OVERLAY_DIRECTIONS = [
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
  { value: 'top', label: 'Arriba' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'radial', label: 'Radial (desde el centro)' },
  { value: 'full', label: 'Completo (parejo)' },
  { value: 'none', label: 'Sin overlay' },
];

const FUENTES = [
  { value: '', label: 'Predeterminada (Inter)' },
  // Sans-serif del sistema
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  // Serif del sistema
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  // Monoespaciada
  { value: 'Courier New, monospace', label: 'Courier New' },
  // Google Fonts
  { value: 'Poppins, sans-serif', label: 'Poppins (Google)' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat (Google)' },
  { value: 'Lato, sans-serif', label: 'Lato (Google)' },
  { value: 'Raleway, sans-serif', label: 'Raleway (Google)' },
  { value: 'Oswald, sans-serif', label: 'Oswald (Google)' },
  { value: 'Playfair Display, serif', label: 'Playfair Display (Google)' },
  { value: 'Merriweather, serif', label: 'Merriweather (Google)' },
  { value: 'Nunito, sans-serif', label: 'Nunito (Google)' },
];

// Google Fonts que requieren carga dinámica
const GOOGLE_FONTS = ['Poppins', 'Montserrat', 'Lato', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Nunito'];

function cargarGoogleFont(fontFamily: string) {
  const nombre = fontFamily.split(',')[0].trim();
  if (!GOOGLE_FONTS.includes(nombre)) return;
  const id = `gfont-${nombre.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${nombre.replace(/\s/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

const COLUMNAS = [
  { value: '2', label: '2 columnas' },
  { value: '3', label: '3 columnas' },
  { value: '4', label: '4 columnas' },
  { value: '5', label: '5 columnas' },
];

// ── Tabs de sección: Contenido / Estilo ──────────────────────────────────────
function TabBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: any; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
      <Icon size={12} />{label}
    </button>
  );
}

// ── Editor visual de la grilla de categorías ─────────────────────────────────
const ICONOS_DEFAULT = ['☕', '🍃', '✨', '🎁', '⚡', '🪵', '🔥', '💫', '🧉', '🪄', '🎨', '📦'];

interface CatItem { id: number; icono: string; imagen_url?: string }

function CategoriasGridEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const { data: todasCategorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  const items: CatItem[] = datos.categorias_items ?? [];
  const selectedIds = new Set(items.map(i => i.id));

  const updateItems = (next: CatItem[]) => set('categorias_items', next);

  const toggleCat = (cat: Categoria) => {
    if (selectedIds.has(cat.id)) {
      updateItems(items.filter(i => i.id !== cat.id));
    } else {
      const icono = ICONOS_DEFAULT[items.length % ICONOS_DEFAULT.length];
      updateItems([...items, { id: cat.id, icono, imagen_url: '' }]);
    }
  };

  const updateIcono = (id: number, icono: string) =>
    updateItems(items.map(i => i.id === id ? { ...i, icono } : i));

  const updateImagen = (id: number, imagen_url: string) =>
    updateItems(items.map(i => i.id === id ? { ...i, imagen_url } : i));

  const mover = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    updateItems(next);
  };

  // El endpoint ya devuelve la lista plana completa (raíces + hijos como items separados)
  const disponibles = todasCategorias.filter(c => !selectedIds.has(c.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Título */}
      <div>
        <label className={labelCls}>Título de sección</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>

      {/* Categorías seleccionadas */}
      <div>
        <label className={labelCls}>Categorías en la grilla ({items.length})</label>
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-2">
            Ninguna seleccionada — se mostrarán todas las categorías raíz.
          </p>
        )}
        <div className="flex flex-col gap-2 mt-1">
          {items.map((item, idx) => {
            const cat = todasCategorias.find(c => c.id === item.id);
            return (
              <div key={item.id} className="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                {/* Fila principal */}
                <div className="flex items-center gap-2 px-3 py-2">
                  {/* Preview: imagen o emoji */}
                  {item.imagen_url
                    ? <img src={item.imagen_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                    : <input
                        className="w-10 h-10 text-center text-xl bg-white border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:border-gray-400 flex-shrink-0"
                        value={item.icono}
                        onChange={e => updateIcono(item.id, e.target.value)}
                        maxLength={4}
                        title="Emoji de respaldo (se muestra si no hay imagen)"
                      />
                  }
                  {/* Nombre categoría */}
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {cat?.nombre ?? `ID ${item.id}`}
                    {cat?.padre_id && (
                      <span className="ml-1 text-[10px] text-gray-400 font-normal">subcategoría</span>
                    )}
                  </span>
                {/* Reordenar */}
                <div className="flex items-center gap-0.5">
                  <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => mover(idx, 1)} disabled={idx === items.length - 1}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronDown size={13} />
                  </button>
                </div>
                  {/* Quitar */}
                  <button onClick={() => cat && toggleCat(cat)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Uploader de imagen */}
                <div className="px-3 pb-3">
                  <SeccionImageUploader
                    label={item.imagen_url ? 'Cambiar imagen' : 'Agregar imagen (reemplaza el emoji)'}
                    value={item.imagen_url || ''}
                    onChange={url => updateImagen(item.id, url)}
                  />
                  {item.imagen_url && (
                    <button onClick={() => updateImagen(item.id, '')}
                      className="mt-1.5 text-[11px] text-red-400 hover:text-red-600 transition-colors">
                      Quitar imagen (vuelve al emoji)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agregar categorías disponibles */}
      {disponibles.length > 0 && (
        <div>
          <label className={labelCls}>Agregar categoría</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {disponibles.map(cat => (
              <button key={cat.id} onClick={() => toggleCat(cat)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <Plus size={10} />
                {cat.nombre}
                {cat.padre_id && <span className="text-gray-400 text-[10px]">(sub)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editor de la barra de estadísticas (stats_barra) ─────────────────────────
// Cantidad de items configurable (agregar/quitar/reordenar), mismo patrón
// que CategoriasGridEditor/FiltrosRapidosEditor — cada item tiene valor,
// etiqueta e ícono (lucide-react, elegido de una lista curada en vez de
// subir imágenes sueltas).
interface StatItemEditable { valor: string; label: string; icono?: string }

function StatsBarraEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const stats: StatItemEditable[] = datos.stats ?? [];
  const [pickerAbierto, setPickerAbierto] = useState<number | null>(null);

  const update = (next: StatItemEditable[]) => set('stats', next);
  const agregar = () => update([...stats, {
    valor: '', label: '',
    icono: STAT_ICON_FALLBACK[stats.length % STAT_ICON_FALLBACK.length],
  }]);
  const eliminar = (i: number) => update(stats.filter((_, idx) => idx !== i));
  const mover = (i: number, dir: -1 | 1) => {
    const next = [...stats];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    update(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Estadísticas ({stats.length}) — valor, etiqueta e ícono por cada una.</p>
        <button onClick={agregar} className="flex items-center gap-1 text-xs font-medium text-[#1D9E75] hover:underline">
          <Plus size={12} /> Agregar estadística
        </button>
      </div>
      {stats.map((s, i) => {
        const IconoActual = s.icono ? STAT_ICONS[s.icono] : undefined;
        return (
          <div key={i} className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2 bg-gray-50">
            <div className="flex items-center gap-2">
              <button onClick={() => setPickerAbierto(pickerAbierto === i ? null : i)}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:border-[#1D9E75] transition-colors"
                title="Elegir ícono">
                {IconoActual ? <IconoActual size={16} className="text-gray-600" /> : <span className="text-gray-300 text-xs">?</span>}
              </button>
              <input className={inputCls} value={s.valor} placeholder="1200+"
                onChange={e => { const ns = [...stats]; ns[i] = { ...ns[i], valor: e.target.value }; update(ns); }} />
              <input className={inputCls} value={s.label} placeholder="Mates entregados"
                onChange={e => { const ns = [...stats]; ns[i] = { ...ns[i], label: e.target.value }; update(ns); }} />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => mover(i, -1)} disabled={i === 0}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                  <ChevronUp size={13} />
                </button>
                <button onClick={() => mover(i, 1)} disabled={i === stats.length - 1}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                  <ChevronDown size={13} />
                </button>
                <button onClick={() => eliminar(i)}
                  className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {pickerAbierto === i && (
              <div className="grid grid-cols-10 gap-1 bg-white border border-gray-100 rounded-lg p-2">
                {STAT_ICON_NAMES.map(nombre => {
                  const IconoOpcion = STAT_ICONS[nombre];
                  return (
                    <button key={nombre} title={nombre}
                      onClick={() => { const ns = [...stats]; ns[i] = { ...ns[i], icono: nombre }; update(ns); setPickerAbierto(null); }}
                      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${s.icono === nombre ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <IconoOpcion size={14} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {stats.length === 0 && (
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
          Sin estadísticas — el bloque no se muestra en el sitio hasta agregar al menos una.
        </p>
      )}
    </div>
  );
}

// ── Editor de la barra de filtros rápidos ────────────────────────────────────
// Cada item es {id, tipo, label, config}: "tipo" decide qué formulario de
// config se muestra y cómo se arma la URL a /productos (ver urlDeFiltro en
// HomeSecciones.tsx — mismos query params que ya lee la sidebar de
// Productos.tsx: categoria_id, apto_grabado). Sumar un tipo nuevo a futuro
// (ej. rango_precio) es agregar un caso acá y en urlDeFiltro, sin migrar los
// items ya guardados de otros tipos.
interface FiltroItem { id: string; tipo: 'categoria' | 'apto_grabado'; label: string; config: Record<string, any> }

const TIPOS_FILTRO: { value: FiltroItem['tipo']; label: string }[] = [
  { value: 'categoria', label: 'Categoría' },
  { value: 'apto_grabado', label: 'Apto para grabar' },
];

function nuevoFiltro(tipo: FiltroItem['tipo'], categoriasDisponibles: Categoria[]): FiltroItem {
  if (tipo === 'categoria') {
    const cat = categoriasDisponibles[0];
    return { id: crypto.randomUUID(), tipo, label: cat?.nombre || 'Categoría', config: { categoria_id: cat?.id } };
  }
  return { id: crypto.randomUUID(), tipo: 'apto_grabado', label: 'Apto para grabar', config: {} };
}

function FiltrosRapidosEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  const items: FiltroItem[] = datos.items ?? [];
  const updateItems = (next: FiltroItem[]) => set('items', next);

  const agregar = (tipo: FiltroItem['tipo']) => updateItems([...items, nuevoFiltro(tipo, categorias)]);
  const eliminar = (id: string) => updateItems(items.filter(i => i.id !== id));
  const actualizar = (id: string, patch: Partial<FiltroItem>) =>
    updateItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  const actualizarConfig = (id: string, patch: Record<string, any>) =>
    updateItems(items.map(i => i.id === id ? { ...i, config: { ...i.config, ...patch } } : i));
  const mover = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    updateItems(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelCls}>Filtros en la barra ({items.length})</label>
        {items.length === 0 && (
          <p className="text-xs text-gray-400 py-2">Sin filtros — el bloque no se muestra en el sitio hasta agregar al menos uno.</p>
        )}
        <div className="flex flex-col gap-2 mt-1">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 flex-shrink-0">
                  {TIPOS_FILTRO.find(t => t.value === item.tipo)?.label}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => mover(idx, 1)} disabled={idx === items.length - 1}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 rounded transition-colors">
                    <ChevronDown size={13} />
                  </button>
                </div>
                <button onClick={() => eliminar(item.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>

              <div>
                <label className={labelCls}>Texto del chip</label>
                <input className={inputCls} value={item.label} onChange={e => actualizar(item.id, { label: e.target.value })} />
              </div>

              {item.tipo === 'categoria' && (
                <div>
                  <label className={labelCls}>Categoría</label>
                  <select className={selectCls} value={item.config.categoria_id ?? ''}
                    onChange={e => actualizarConfig(item.id, { categoria_id: parseInt(e.target.value) })}>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}{cat.padre_id ? ' (subcategoría)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Agregar filtro</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {TIPOS_FILTRO.map(t => (
            <button key={t.value} onClick={() => agregar(t.value)} disabled={t.value === 'categoria' && categorias.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <Plus size={10} /> {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Botones extra dentro de un bloque (Fase 3) ───────────────────────────────
// Un bloque guarda su lista de botones en datos.botones: {texto,link}[], con
// cantidad libre. Los campos legacy btn_texto/btn_link/btn2_texto/btn2_link
// (de antes de esta fase) se siguen leyendo como fallback si no hay botones.
// bg_color/texto_color propios son opcionales: vacío = hereda del bloque
// (btn_color/btn_texto_color), que a su vez hereda del tema si tampoco los define.
interface Boton { texto: string; link: string; bg_color?: string; texto_color?: string }

function resolverBotonesLegacy(datos: Record<string, any>): Boton[] {
  if (Array.isArray(datos.botones) && datos.botones.length > 0) return datos.botones;
  const legacy: Boton[] = [];
  if (datos.btn_texto || datos.btn_link) legacy.push({ texto: datos.btn_texto || '', link: datos.btn_link || '' });
  if (datos.btn2_texto || datos.btn2_link) legacy.push({ texto: datos.btn2_texto || '', link: datos.btn2_link || '' });
  return legacy;
}

function BotonesEditor({ botones, onChange, placeholderTexto = 'Ver colección', placeholderLink = '/productos' }: {
  botones: Boton[]; onChange: (b: Boton[]) => void; placeholderTexto?: string; placeholderLink?: string;
}) {
  const update = (i: number, k: keyof Boton, v: string) =>
    onChange(botones.map((b, idx) => idx === i ? { ...b, [k]: v } : b));
  const agregar = () => onChange([...botones, { texto: '', link: '' }]);
  const eliminar = (i: number) => onChange(botones.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className={labelCls}>Botones ({botones.length})</label>
        <button onClick={agregar} className="flex items-center gap-1 text-xs font-medium text-[#1D9E75] hover:underline">
          <Plus size={12} /> Agregar botón
        </button>
      </div>
      {botones.length === 0 && (
        <p className="text-xs text-gray-400">Sin botones — se muestra un botón "{placeholderTexto}" por defecto.</p>
      )}
      {botones.map((boton, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input className={inputCls} value={boton.texto} placeholder={i === 0 ? placeholderTexto : 'Texto del botón'}
              onChange={e => update(i, 'texto', e.target.value)} />
            <input className={inputCls} value={boton.link} placeholder={i === 0 ? placeholderLink : '/ruta'}
              onChange={e => update(i, 'link', e.target.value)} />
            <button onClick={() => eliminar(i)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 -mb-1">
            <span className="text-[13px] text-gray-400">↳</span>
            <p className="text-[11px] text-gray-500">Opcional — sobreescribe el color base/default del bloque solo para <strong>este botón</strong>.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Fondo de este botón (opcional)" value={boton.bg_color || ''}
              onChange={v => update(i, 'bg_color', v)} />
            <ColorField label="Texto de este botón (opcional)" value={boton.texto_color || ''}
              onChange={v => update(i, 'texto_color', v)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Editor de slides del hero ─────────────────────────────────────────────────
interface HeroSlide {
  titulo: string; subtitulo?: string; eyebrow?: string; imagen_url?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  botones?: Boton[];
  bg_color?: string; texto_color?: string;
}

// Sin bg_color/texto_color: un slide nuevo hereda del bloque por defecto
// (ver comentario en TIPO_DEFAULTS.hero más arriba).
const SLIDE_DEFAULT: HeroSlide = {
  titulo: 'Mates únicos,\nhechos a tu medida',
  subtitulo: 'Diseño exclusivo para cada cliente.',
  imagen_url: '',
  btn_texto: 'Ver colección',
  btn_link: '/productos',
};

function HeroSlideEditor({ slide, onChange, onRemove, canRemove, index }: {
  slide: HeroSlide; onChange: (s: HeroSlide) => void;
  onRemove: () => void; canRemove: boolean; index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  const set = (k: keyof HeroSlide, v: string) => onChange({ ...slide, [k]: v });

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* Header del slide */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gray-100 text-xs font-bold text-gray-500 flex-shrink-0">
          {index + 1}
        </div>
        {slide.imagen_url
          ? <img src={slide.imagen_url} className="w-10 h-7 object-cover rounded flex-shrink-0" />
          : <div className="w-10 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><Image size={12} className="text-gray-300" /></div>
        }
        <span className="flex-1 text-sm font-medium truncate text-gray-800">
          {slide.titulo?.split('\n')[0] || `Slide ${index + 1}`}
        </span>
        {canRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
            <Trash2 size={12} />
          </button>
        )}
        <button className="text-gray-400 flex-shrink-0">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Campos */}
      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 flex flex-col gap-3">
          <div>
            <label className={labelCls}>Título (Enter = nueva línea)</label>
            <textarea className={inputCls + ' resize-none h-16 text-xs'} value={slide.titulo || ''}
              onChange={e => set('titulo', e.target.value)} placeholder="Mates únicos,&#10;hechos a tu medida" />
          </div>
          <div>
            <label className={labelCls}>Subtítulo</label>
            <input className={inputCls} value={slide.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Eyebrow (texto pequeño arriba del título, opcional)</label>
            <input className={inputCls} value={slide.eyebrow || ''} onChange={e => set('eyebrow', e.target.value)} placeholder="Ej: Grabado láser de precisión" />
          </div>
          <SeccionImageUploader label="Imagen" value={slide.imagen_url || ''} onChange={v => set('imagen_url', v)} />
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <span className="text-[13px] text-gray-400">↳</span>
            <p className="text-[11px] text-gray-500">
              Opcional — sobreescribe el color base del bloque (tab Estilo) solo para <strong>este slide</strong>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>Fondo de este slide (opcional)</label>
                {slide.bg_color && (
                  <button onClick={() => set('bg_color', '')} className="text-[10px] text-[#1D9E75] hover:underline mb-1">
                    Heredar del bloque
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input type="color" value={slide.bg_color || '#111111'} onChange={e => set('bg_color', e.target.value)}
                  className="w-8 h-[34px] rounded border border-gray-200 cursor-pointer p-0.5" />
                <input className={inputCls} value={slide.bg_color || ''} onChange={e => set('bg_color', e.target.value)} placeholder="Hereda del bloque" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={labelCls}>Texto de este slide (opcional)</label>
                {slide.texto_color && (
                  <button onClick={() => set('texto_color', '')} className="text-[10px] text-[#1D9E75] hover:underline mb-1">
                    Heredar del bloque
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input type="color" value={slide.texto_color || '#ffffff'} onChange={e => set('texto_color', e.target.value)}
                  className="w-8 h-[34px] rounded border border-gray-200 cursor-pointer p-0.5" />
                <input className={inputCls} value={slide.texto_color || ''} onChange={e => set('texto_color', e.target.value)} placeholder="Hereda del bloque" />
              </div>
            </div>
          </div>
          <BotonesEditor botones={resolverBotonesLegacy(slide)} onChange={b => onChange({ ...slide, botones: b })} />
        </div>
      )}
    </div>
  );
}

function HeroSlidesEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  // Normalizar: si tiene campos legacy sin "slides", convertirlos
  const slides: HeroSlide[] = datos.slides?.length
    ? datos.slides
    : [{
        titulo: datos.titulo || SLIDE_DEFAULT.titulo,
        subtitulo: datos.subtitulo || SLIDE_DEFAULT.subtitulo,
        imagen_url: datos.imagen_url || '',
        btn_texto: datos.btn_texto || SLIDE_DEFAULT.btn_texto,
        btn_link: datos.btn_link || SLIDE_DEFAULT.btn_link,
        bg_color: datos.bg_color || SLIDE_DEFAULT.bg_color,
        texto_color: datos.texto_color || SLIDE_DEFAULT.texto_color,
      }];

  const update = (next: HeroSlide[]) => set('slides', next);
  const updateSlide = (i: number, s: HeroSlide) => update(slides.map((sl, idx) => idx === i ? s : sl));
  const addSlide = () => update([...slides, { ...SLIDE_DEFAULT }]);
  const removeSlide = (i: number) => {
    if (!confirm('¿Eliminar este slide? Se pierde su título, imagen, botones y estilos propios — no se puede deshacer.')) return;
    update(slides.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{slides.length} slide{slides.length !== 1 ? 's' : ''}. El hero los mostrará en bucle automáticamente.</p>
        <button onClick={addSlide}
          className="flex items-center gap-1 text-xs font-medium text-[#1D9E75] hover:underline">
          <Plus size={12} /> Agregar slide
        </button>
      </div>

      {slides.map((slide, i) => (
        <HeroSlideEditor
          key={i}
          index={i}
          slide={slide}
          onChange={s => updateSlide(i, s)}
          onRemove={() => removeSlide(i)}
          canRemove={slides.length > 1}
        />
      ))}

      {/* Configuración del slider */}
      <div className="border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 flex items-center gap-4">
        <div className="flex-1">
          <label className={labelCls}>Intervalo entre slides (segundos)</label>
          <input className={inputCls} type="number" min={2} max={30} value={datos.intervalo ?? 5}
            onChange={e => set('intervalo', parseInt(e.target.value) || 5)} />
        </div>
      </div>
    </div>
  );
}

// ── Editor de CONTENIDO por tipo ─────────────────────────────────────────────
function EditorContenido({ tipo, datos, set }: {
  tipo: TipoSeccion; datos: Record<string, any>; set: (k: string, v: any) => void;
}) {
  if (tipo === 'hero') return <HeroSlidesEditor datos={datos} set={set} />;

  if (tipo === 'filtros_rapidos') return <FiltrosRapidosEditor datos={datos} set={set} />;

  if (tipo === 'banner_texto') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Texto del banner</label>
        <input className={inputCls} value={datos.texto || ''} onChange={e => set('texto', e.target.value)} placeholder="Ej: Envío gratis a partir de $15.000" />
      </div>
      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        <div>
          <div className="text-sm font-medium">Modo ticker (marquee)</div>
          <div className="text-xs text-gray-400">Texto en movimiento continuo</div>
        </div>
        <button
          onClick={() => set('marquee', !datos.marquee)}
          className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${datos.marquee ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${datos.marquee ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );

  if (tipo === 'productos_destacados') return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Título de sección</label>
          <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Cantidad a mostrar</label>
          <input className={inputCls} type="number" min={1} max={24} value={datos.cantidad || 8}
            onChange={e => set('cantidad', parseInt(e.target.value))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>
    </div>
  );

  if (tipo === 'categorias_grid') return <CategoriasGridEditor datos={datos} set={set} />;

  if (tipo === 'texto_libre') return (
    <div>
      <label className={labelCls}>HTML</label>
      <textarea className={inputCls + ' h-32 resize-y font-mono text-xs'} value={datos.html || ''}
        onChange={e => set('html', e.target.value)} placeholder="<p>Tu contenido aquí...</p>" />
    </div>
  );

  if (tipo === 'banner_imagen') return (
    <div className="flex flex-col gap-3">
      <SeccionImageUploader
        label="Imagen del banner"
        value={datos.imagen_url || ''}
        onChange={v => set('imagen_url', v)}
      />
      <div>
        <label className={labelCls}>Link al hacer click (opcional)</label>
        <input className={inputCls} value={datos.link || ''} onChange={e => set('link', e.target.value)} placeholder="/productos" />
      </div>
    </div>
  );

  if (tipo === 'stats_barra') return <StatsBarraEditor datos={datos} set={set} />;

  if (tipo === 'como_funciona') {
    const pasos: { icono: string; titulo: string; desc: string }[] = datos.pasos ?? [];
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Título de sección</label>
          <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Subtítulo</label>
          <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
        </div>
        {pasos.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-400">Paso {i + 1}</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Ícono (emoji)</label>
                <input className={inputCls} value={p.icono} onChange={e => {
                  const np = [...pasos]; np[i] = { ...np[i], icono: e.target.value }; set('pasos', np);
                }} placeholder="🎨" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Título del paso</label>
                <input className={inputCls} value={p.titulo} onChange={e => {
                  const np = [...pasos]; np[i] = { ...np[i], titulo: e.target.value }; set('pasos', np);
                }} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} value={p.desc} onChange={e => {
                const np = [...pasos]; np[i] = { ...np[i], desc: e.target.value }; set('pasos', np);
              }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tipo === 'cta_banner') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Texto sobre el título (eyebrow)</label>
        <input className={inputCls} value={datos.eyebrow || ''} onChange={e => set('eyebrow', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Título principal</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>
      <BotonesEditor botones={resolverBotonesLegacy(datos)} onChange={b => set('botones', b)} />
    </div>
  );

  return null;
}

// ── Editor de ESTILO por tipo ────────────────────────────────────────────────
function EditorEstilo({ tipo, datos, set }: {
  tipo: TipoSeccion; datos: Record<string, any>; set: (k: string, v: any) => void;
}) {
  // El overlay del hero aplica sobre la imagen del slide activo — hay que
  // mirar los slides (formato actual), no solo el campo legacy datos.imagen_url
  // (única imagen, formato previo a los slides múltiples).
  const heroTieneImagen = tipo === 'hero' && (!!datos.imagen_url || !!datos.slides?.some((s: any) => s.imagen_url));
  const tieneSubtitulo = ['hero', 'cta_banner', 'productos_destacados', 'categorias_grid', 'como_funciona'].includes(tipo);
  const tieneBotonesConColorPropio = tipo === 'hero' || tipo === 'cta_banner';

  return (
    <div className="flex flex-col gap-4">
      {/* Colores comunes */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Colores</div>
        {(tipo === 'hero' || tieneBotonesConColorPropio) && (
          <p className="text-xs text-gray-400 -mt-1 mb-2">
            Esto es la base del bloque{tipo === 'hero' ? ' — un slide o un botón con su propio color (tab Contenido) lo pisa.' : ' — un botón con su propio color (tab Contenido) lo pisa.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {tipo !== 'banner_imagen' && (
            <ColorField label="Fondo del bloque (base)" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          )}
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <ColorField label="Texto del bloque (base)" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Color título" value={datos.titulo_color || ''} onChange={v => set('titulo_color', v)} />
          )}
          {tieneSubtitulo && (
            <ColorField label="Color subtítulo" value={datos.subtitulo_color || ''} onChange={v => set('subtitulo_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Color eyebrow" value={datos.eyebrow_color || ''} onChange={v => set('eyebrow_color', v)} />
          )}
          {tieneBotonesConColorPropio && (
            <ColorField label="Fondo botón (default)" value={datos.btn_color || ''} onChange={v => set('btn_color', v)} />
          )}
          {tieneBotonesConColorPropio && (
            <ColorField label="Texto botón (default)" value={datos.btn_texto_color || ''} onChange={v => set('btn_texto_color', v)} />
          )}
          {tipo === 'categorias_grid' && (
            <ColorField label="Color de acento (link 'Ver productos')" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
          {tipo === 'productos_destacados' && (
            <ColorField label="Color de acento (link 'Ver producto')" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
          {tipo === 'stats_barra' && (
            <ColorField label="Color del ícono (default: hereda el texto)" value={datos.icon_color || ''} onChange={v => set('icon_color', v)} />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Por defecto, título y subtítulo usan el color de texto primario del tema (alto contraste). Para un look más sutil, elegí acá el color secundario del tema en vez de dejarlo en blanco.
        </p>
      </div>

      {heroTieneImagen && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Imagen y overlay</div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Posición de la imagen" value={datos.image_position || 'bleed'} onChange={v => set('image_position', v)} options={IMAGE_POSITIONS} />
            <SelectField label="Dirección del overlay" value={datos.overlay_direction || 'left'} onChange={v => set('overlay_direction', v)} options={OVERLAY_DIRECTIONS} />
          </div>
          {datos.image_position === 'background' && !datos.overlay_direction && (
            <p className="text-[10px] text-amber-600 mt-2">
              Con imagen de fondo completa, sugerimos overlay "Completo (parejo)" con intensidad 45-55% para que el texto se lea bien.
            </p>
          )}
          {(datos.overlay_direction || 'left') !== 'none' && (
            <div className="mt-3">
              <label className={labelCls}>Intensidad del overlay: {datos.overlay_intensity ?? 60}%</label>
              <input type="range" min={0} max={100} value={datos.overlay_intensity ?? 60}
                onChange={e => set('overlay_intensity', parseInt(e.target.value))}
                className="w-full accent-[#1D9E75]" />
            </div>
          )}
        </div>
      )}

      {/* Tipografía */}
      {tipo !== 'banner_imagen' && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipografía</div>
          <div className="grid grid-cols-2 gap-3">
            {/* Fuente — aplica a toda la sección */}
            <div className="col-span-2">
              <label className={labelCls}>Fuente de letra</label>
              <select className={selectCls}
                value={datos.font_family || ''}
                onChange={e => { set('font_family', e.target.value); cargarGoogleFont(e.target.value); }}
                style={{ fontFamily: datos.font_family || undefined }}>
                {FUENTES.map(f => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                    {f.label}
                  </option>
                ))}
              </select>
              {datos.font_family && GOOGLE_FONTS.includes(datos.font_family.split(',')[0].trim()) && (
                <p className="text-[10px] text-gray-400 mt-1">Google Font — se carga desde internet</p>
              )}
            </div>
            {['hero', 'productos_destacados', 'categorias_grid'].includes(tipo) && (
              <SelectField label="Tamaño título" value={datos.titulo_size || 'lg'} onChange={v => set('titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'categorias_grid' && (
              <SelectField label="Tamaño nombre de categoría (dentro de cada card)" value={datos.item_titulo_size || 'sm'} onChange={v => set('item_titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'categorias_grid' && (
              <SelectField label='Tamaño link "Ver productos"' value={datos.item_link_size || 'xs'} onChange={v => set('item_link_size', v)} options={SIZES} />
            )}
            {tipo === 'productos_destacados' && (
              <SelectField label="Tamaño nombre de producto (dentro de cada card)" value={datos.item_titulo_size || 'sm'} onChange={v => set('item_titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'productos_destacados' && (
              <SelectField label='Tamaño precio / link "Ver producto"' value={datos.item_link_size || 'xs'} onChange={v => set('item_link_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso título" value={datos.titulo_font_weight || 'bold'} onChange={v => set('titulo_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente título (opcional, pisa la fuente del bloque)" value={datos.titulo_font_family || ''} onChange={v => { set('titulo_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Tamaño subtítulo" value={datos.subtitulo_size || 'xl'} onChange={v => set('subtitulo_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso subtítulo" value={datos.subtitulo_font_weight || 'normal'} onChange={v => set('subtitulo_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente subtítulo (opcional, pisa la fuente del bloque)" value={datos.subtitulo_font_family || ''} onChange={v => { set('subtitulo_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Tamaño eyebrow" value={datos.eyebrow_size || 'xs'} onChange={v => set('eyebrow_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso eyebrow" value={datos.eyebrow_font_weight || 'semibold'} onChange={v => set('eyebrow_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente eyebrow (opcional, pisa la fuente del bloque)" value={datos.eyebrow_font_family || ''} onChange={v => { set('eyebrow_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'banner_texto' && (
              <SelectField label="Tamaño texto" value={datos.font_size || 'sm'} onChange={v => set('font_size', v)} options={SIZES} />
            )}
            {tipo === 'banner_texto' && (
              <SelectField label="Peso tipográfico" value={datos.font_weight || 'medium'} onChange={v => set('font_weight', v)} options={PESOS} />
            )}
          </div>
        </div>
      )}

      {/* Layout */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Layout</div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Espaciado vertical" value={datos.padding || 'md'} onChange={v => set('padding', v)} options={PADDINGS} />
          <SelectField label="Transición al bloque siguiente" value={datos.transicion_inferior || 'ninguna'} onChange={v => set('transicion_inferior', v)} options={TRANSICIONES} />
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <SelectField label="Alineación" value={datos.alineacion || 'left'} onChange={v => set('alineacion', v)} options={ALINEACIONES} />
          )}
          {['productos_destacados', 'categorias_grid'].includes(tipo) && (
            <SelectField label="Columnas" value={String(datos.columnas || 3)} onChange={v => set('columnas', parseInt(v))} options={COLUMNAS} />
          )}
          {tipo !== 'banner_imagen' && (
            <div>
              <label className={labelCls}>Alto mínimo del bloque (px, vacío = automático)</label>
              <input className={inputCls} type="number" min={100} step={50} value={datos.min_height === 'auto' ? '' : datos.min_height || ''}
                onChange={e => set('min_height', e.target.value || 'auto')} placeholder={tipo === 'hero' ? '400' : 'auto'} />
            </div>
          )}
          {tipo === 'stats_barra' && (
            <div className="col-span-2">
              <label className={labelCls}>Escala general: {Math.round((datos.escala ?? 1) * 100)}%</label>
              <input type="range" min={0.4} max={2} step={0.05} value={datos.escala ?? 1}
                onChange={e => set('escala', parseFloat(e.target.value))}
                className="w-full accent-[#1D9E75]" />
              <p className="text-[10px] text-gray-400 mt-1">Achica o agranda números, ícono, etiqueta y espaciado juntos, en proporción — sin tope mínimo fijo.</p>
            </div>
          )}
          {tipo === 'banner_imagen' && (
            <>
              <div>
                <label className={labelCls}>Altura máxima (px)</label>
                <input className={inputCls} type="number" value={datos.max_height || 300}
                  onChange={e => set('max_height', e.target.value)} />
              </div>
              <SelectField label="Ajuste imagen" value={datos.object_fit || 'cover'}
                onChange={v => set('object_fit', v)}
                options={[{ value: 'cover', label: 'Cubrir (recorta)' }, { value: 'contain', label: 'Contener (completa)' }]} />
              <SelectField label="Bordes redondeados" value={datos.border_radius || 'xl'}
                onChange={v => set('border_radius', v)}
                options={[{ value: 'none', label: 'Sin redondeo' }, { value: 'md', label: 'Suave' }, { value: 'xl', label: 'Redondo' }, { value: '2xl', label: 'Muy redondo' }]} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editor de imágenes libres dentro de un bloque (Fase 4) ───────────────────
// Cada imagen se guarda en datos.imagenes: {id,url,x,y,escala}[], con x/y en
// % del espacio del bloque (se arrastra dentro del recuadro de preview) y
// escala en % del ancho del bloque.
interface ImagenLibre { id: string; url: string; x: number; y: number; escala: number }

function ImagenesEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const imagenes: ImagenLibre[] = datos.imagenes ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const update = (next: ImagenLibre[]) => set('imagenes', next);
  const agregar = (url: string) => update([...imagenes, { id: crypto.randomUUID(), url, x: 50, y: 50, escala: 30 }]);
  const eliminar = (id: string) => update(imagenes.filter(i => i.id !== id));
  const updateImg = (id: string, patch: Partial<ImagenLibre>) =>
    update(imagenes.map(i => i.id === id ? { ...i, ...patch } : i));

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
      updateImg(dragId, { x, y });
    };
    const onUp = () => setDragId(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400">Arrastrá las imágenes dentro del recuadro para reposicionarlas en el bloque.</p>

      <div ref={containerRef}
        className="relative w-full h-56 bg-gray-100 rounded-xl border border-dashed border-gray-300 overflow-hidden">
        {imagenes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Sin imágenes todavía</div>
        )}
        {imagenes.map(img => (
          <img key={img.id} src={img.url} draggable={false}
            data-testid="imagen-libre-drag"
            onPointerDown={e => { e.preventDefault(); setDragId(img.id); }}
            className="absolute cursor-move select-none max-w-none rounded shadow"
            style={{ left: `${img.x}%`, top: `${img.y}%`, width: `${img.escala}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
          />
        ))}
      </div>

      {imagenes.map(img => (
        <div key={img.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2 border border-gray-100">
          <img src={img.url} className="w-10 h-10 object-cover rounded flex-shrink-0" />
          <div className="flex-1">
            <label className={labelCls}>Tamaño: {img.escala}%</label>
            <input type="range" min={5} max={100} value={img.escala}
              onChange={e => updateImg(img.id, { escala: parseInt(e.target.value) })}
              className="w-full accent-[#1D9E75]" />
          </div>
          <button onClick={() => eliminar(img.id)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <SeccionImageUploader label="Agregar imagen" value="" onChange={url => url && agregar(url)} />
    </div>
  );
}

// ── Card de sección ──────────────────────────────────────────────────────────
function SeccionCard({ sec, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  sec: Seccion; idx: number; total: number;
  onChange: (s: Seccion) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const [tabEdit, setTabEdit] = useState<'contenido' | 'estilo' | 'imagenes'>('contenido');
  const preview = sec.datos.titulo || sec.datos.texto || sec.datos.imagen_url || '';
  const set = (k: string, v: any) => onChange({ ...sec, datos: { ...sec.datos, [k]: v } });

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-opacity ${!sec.activo ? 'opacity-50' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
        {/* color swatch del fondo */}
        {sec.datos.bg_color && (
          <div className="w-4 h-4 rounded border border-gray-200 flex-shrink-0"
            style={{ backgroundColor: sec.datos.bg_color }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{TIPO_LABELS[sec.tipo as TipoSeccion]}</div>
          {preview && <div className="text-xs text-gray-400 truncate">{preview}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={idx === 0}
            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
            <ChevronUp size={13} />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1}
            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
            <ChevronDown size={13} />
          </button>
          <button onClick={() => onChange({ ...sec, activo: !sec.activo })} title={sec.activo ? 'Ocultar' : 'Mostrar'}
            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#1D9E75] transition-colors">
            {sec.activo ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => setExpandida(e => !e)}
            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
            {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={onRemove}
            className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Panel expandido */}
      <AnimatePresence initial={false}>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-gray-50"
          >
            {/* Tabs Contenido / Estilo / Imágenes */}
            <div className="flex gap-1 px-4 pt-3 pb-2">
              <TabBtn active={tabEdit === 'contenido'} onClick={() => setTabEdit('contenido')} icon={Type} label="Contenido" />
              <TabBtn active={tabEdit === 'estilo'} onClick={() => setTabEdit('estilo')} icon={Palette} label="Estilo" />
              <TabBtn active={tabEdit === 'imagenes'} onClick={() => setTabEdit('imagenes')} icon={Image} label="Imágenes" />
            </div>
            <div className="px-4 pb-4">
              {tabEdit === 'contenido' && <EditorContenido tipo={sec.tipo as TipoSeccion} datos={sec.datos} set={set} />}
              {tabEdit === 'estilo' && <EditorEstilo tipo={sec.tipo as TipoSeccion} datos={sec.datos} set={set} />}
              {tabEdit === 'imagenes' && <ImagenesEditor datos={sec.datos} set={set} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Card del navbar (dentro del tab Inicio) ──────────────────────────────────
// El navbar vive en el mismo array/endpoint que el resto de las secciones
// (ver comentario de SeccionTipo más arriba), pero a diferencia de ellas no
// se reordena ni se elimina: se renderiza fijo arriba de TODAS las páginas
// del sitio (no solo el inicio), así que no tiene sentido moverlo entre
// Hero/Stats/etc. Por eso es una card fija al principio de la lista en vez
// de aparecer mezclado en el drag-and-drop.
function NavbarCard({ datos, set, nombreTienda, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; nombreTienda: string; tema: TemaGlobal;
}) {
  const [expandida, setExpandida] = useState(false);
  return (
    // Nota: esta card usa deliberadamente una combinación de clases distinta
    // a la de SeccionCard (sin "overflow-hidden") — varios tests e2e ya
    // existentes ubican la primera sección reordenable con el selector
    // '.bg-white.border.rounded-xl.overflow-hidden', y esta card no debe
    // matchear esa consulta (no es una sección reordenable).
    <div className="bg-white border border-gray-100 rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <Layout size={16} className="text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Navbar</div>
          <div className="text-xs text-gray-400 truncate">Fijo arriba de todas las páginas — no se reordena</div>
        </div>
        <button onClick={() => setExpandida(e => !e)}
          aria-label={expandida ? 'Colapsar navbar' : 'Editar navbar'}
          className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-gray-50 px-4 pb-4 pt-3"
          >
            <NavbarEditor datos={datos} set={set} nombreTienda={nombreTienda} tema={tema} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Toggle reutilizable ───────────────────────────────────────────────────────
// Mensaje de feedback tras guardar/publicar/descartar — antes aparecía y
// desaparecía a los golpes (mount/unmount directo); ahora un fade + leve
// desplazamiento, igual look pero se siente más pulido.
function FeedbackToast({ show, children, className }: { show: boolean; children: React.ReactNode; className: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }} className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-gray-400">{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ── "Aplicar a todo" / "Aplicar" (tab Tema) ──────────────────────────────────
// Recorren toda la cadena de herencia (bloque → título/subtítulo → botón) y
// BORRAN la clave de override (no la dejan en '') para que ese elemento
// vuelva a heredar del nivel de arriba — nunca escriben el valor del tema
// como fijo, así si el tema cambia después, estos elementos lo siguen.
//
// 'todo': borra siempre, tenga o no override.
// 'solo_vacios': borra solo si el valor YA era falsy (undefined o '') — es
// decir, normaliza "sin override representado como ''" a "clave ausente",
// sin tocar nada que el admin haya personalizado a mano.
const ESTILO_KEYS = ['bg_color', 'texto_color', 'font_family'];

function limpiarClaves<T extends Record<string, any>>(obj: T, keys: string[], modo: 'todo' | 'solo_vacios'): T {
  const copia = { ...obj };
  for (const k of keys) {
    const yaVacio = !copia[k];
    if (modo === 'todo' || yaVacio) delete copia[k];
  }
  return copia;
}

function limpiarBotones(botones: any, modo: 'todo' | 'solo_vacios') {
  if (!Array.isArray(botones)) return botones;
  return botones.map((b: any) => limpiarClaves(b, ESTILO_KEYS, modo));
}

function limpiarDatosSeccion(datos: Record<string, any>, modo: 'todo' | 'solo_vacios'): Record<string, any> {
  // Bloque: bg_color/texto_color/font_family, más btn_color/btn_texto_color
  // (el nivel "Bloque" de la cadena para botones, mismos 3 campos con otro
  // nombre) y subtitulo_color/subtitulo_font_family (nivel Subtítulo).
  let d = limpiarClaves(datos, [...ESTILO_KEYS, 'btn_color', 'btn_texto_color'], modo);
  d = limpiarClaves(d, ['subtitulo_color', 'subtitulo_font_family'], modo);
  if (Array.isArray(d.botones)) d.botones = limpiarBotones(d.botones, modo);
  // Hero: cada slide es su propio nivel de Bloque para bg/texto, con sus
  // propios botones.
  if (Array.isArray(d.slides)) {
    d.slides = d.slides.map((s: any) => {
      const ns = limpiarClaves(s, ESTILO_KEYS, modo);
      if (Array.isArray(ns.botones)) ns.botones = limpiarBotones(ns.botones, modo);
      return ns;
    });
  }
  return d;
}

// ── Editor de tema global ────────────────────────────────────────────────────
function TemaEditor({ form, setForm, onAplicarATodo, onAplicar, aplicando, aplicadoOk }: {
  form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAplicarATodo: () => void; onAplicar: () => void; aplicando: boolean; aplicadoOk: boolean;
}) {
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Colores por defecto</div>
        <p className="text-xs text-gray-400 -mt-2">
          Se aplican a todo el sitio salvo que un bloque tenga su propio color configurado.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={form.tema_bg_color ?? '#ffffff'} onChange={v => set('tema_bg_color', v)} />
          <ColorField label="Color de letra" value={form.tema_texto_color ?? '#111111'} onChange={v => set('tema_texto_color', v)} />
          <ColorField label="Color de letra secundario" value={form.tema_texto_secundario_color ?? '#6b7280'} onChange={v => set('tema_texto_secundario_color', v)} />
          <ColorField label="Color de acento" value={form.tema_accent_color ?? '#1D9E75'} onChange={v => set('tema_accent_color', v)} />
          <ColorField label='Color de badge (ej. "Apto grabado")' value={form.tema_badge_color ?? '#111111'} onChange={v => set('tema_badge_color', v)} />
        </div>
        <p className="text-[10px] text-gray-400 -mt-2">
          El acento se usa en links y detalles que necesitan destacar (ej. "Ver productos" de Categorías) — no reemplaza el color de letra.
          El color secundario es para texto de menor jerarquía (elegido explícitamente por elemento, no aplicado por opacidad).
          El color de badge es para etiquetas informativas sobre imágenes — deliberadamente distinto del acento, para no confundirse con un llamado a la acción.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipografía por defecto</div>
        <div>
          <label className={labelCls}>Fuente de letra</label>
          <select className={selectCls}
            value={form.tema_font_family ?? ''}
            onChange={e => { set('tema_font_family', e.target.value); cargarGoogleFont(e.target.value); }}
            style={{ fontFamily: form.tema_font_family || undefined }}>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          {form.tema_font_family && GOOGLE_FONTS.includes(form.tema_font_family.split(',')[0].trim()) && (
            <p className="text-[10px] text-gray-400 mt-1">Google Font — se carga desde internet</p>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-1.5 bg-gray-50 border-b border-gray-100 font-semibold">Preview</div>
        <div className="px-6 py-8"
          style={{
            backgroundColor: form.tema_bg_color || '#ffffff',
            color: form.tema_texto_color || '#111111',
            fontFamily: form.tema_font_family || undefined,
          }}>
          <p className="text-sm">Así se ve el texto por defecto del sitio.</p>
        </div>
      </div>

      {/* Aplicar a los bloques */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aplicar a los bloques</div>
        <p className="text-xs text-gray-400 -mt-1">
          Hace que los bloques, títulos/subtítulos y botones vuelvan a heredar el color y la tipografía de acá arriba,
          en vez de tener los suyos propios. Guarda automáticamente al ejecutarse.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onAplicar} disabled={aplicando}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
            Aplicar
          </button>
          <button onClick={onAplicarATodo} disabled={aplicando}
            className="bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
            Aplicar a todo
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          <strong>Aplicar</strong>: solo normaliza los bloques/títulos/botones que ya no tenían color propio configurado — no toca lo que personalizaste a mano.<br />
          <strong>Aplicar a todo</strong>: borra el color y la tipografía propios de <em>todos</em> los bloques, títulos y botones, sin excepción. Pide confirmación.
        </p>
        <FeedbackToast show={aplicadoOk} className="text-xs text-[#1D9E75]">¡Guardado correctamente!</FeedbackToast>
      </div>
    </div>
  );
}

// ── Editor de navbar ──────────────────────────────────────────────────────────
function NavbarEditor({ datos, set, nombreTienda, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; nombreTienda: string; tema: TemaGlobal;
}) {
  const bool = (k: string, def = true) => datos[k] ?? def;
  const tipoMenu: 'tradicional' | 'hamburguesa' = datos.tipo_menu === 'hamburguesa' ? 'hamburguesa' : 'tradicional';
  const menuPosicion: 'izquierda' | 'derecha' = datos.menu_posicion === 'izquierda' ? 'izquierda' : 'derecha';
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : NAV_LINKS_DEFAULT;

  return (
    <div className="flex flex-col gap-4">
      {/* Colores */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Colores</div>
        <p className="text-xs text-gray-400 -mt-2">Vacío = hereda el color del tema global.</p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          <ColorField label="Color del texto / íconos" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
        </div>
        <div>
          <label className={labelCls}>Color del borde inferior / sombra</label>
          <div className="flex items-center gap-2">
            <input type="color" value={datos.border_color ?? '#f3f4f6'}
              onChange={e => set('border_color', e.target.value)}
              className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
            <input className={inputCls} value={datos.border_color ?? '#f3f4f6'}
              onChange={e => set('border_color', e.target.value)} placeholder="#f3f4f6" />
          </div>
        </div>
      </div>

      {/* Tipografía */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipografía</div>
        <div>
          <label className={labelCls}>Fuente de letra</label>
          <select className={selectCls}
            value={datos.font_family || ''}
            onChange={e => { set('font_family', e.target.value); cargarGoogleFont(e.target.value); }}
            style={{ fontFamily: datos.font_family || undefined }}>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Predeterminada = hereda la tipografía del tema global.</p>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Logo</div>
        <div>
          <label className={labelCls}>URL del logo (imagen)</label>
          <input className={inputCls} value={datos.logo_url ?? ''} placeholder="https://... (dejar vacío para usar el nombre)"
            onChange={e => set('logo_url', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-1">Si no se especifica una imagen, se muestra el nombre de la tienda como texto.</p>
        </div>
        {datos.logo_url && (
          <div className="flex items-center gap-3">
            <img src={datos.logo_url} alt="Logo preview" className="h-10 object-contain border border-gray-100 rounded-lg p-1 bg-white" />
            <button onClick={() => set('logo_url', '')} className="text-xs text-red-500 hover:underline">Quitar imagen</button>
          </div>
        )}
        <div>
          <label className={labelCls}>Altura del logo (px)</label>
          <input className={inputCls} type="number" min={20} max={80} value={datos.logo_alto ?? '32'}
            onChange={e => set('logo_alto', e.target.value)} placeholder="32" />
        </div>
        <SeccionImageUploader
          value={datos.logo_url ?? ''}
          onChange={url => set('logo_url', url)}
          label="O subir imagen de logo"
        />
      </div>

      {/* Visibilidad de íconos */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Íconos visibles</div>
        <Toggle label="Buscador" desc="Muestra el ícono de búsqueda en la navbar"
          value={bool('mostrar_buscar')} onChange={v => set('mostrar_buscar', v)} />
        <Toggle label="Ícono de usuario" desc="Muestra el ícono de usuario / login"
          value={bool('mostrar_usuario')} onChange={v => set('mostrar_usuario', v)} />
        <Toggle label="Carrito" desc="Muestra el ícono del carrito con badge de items"
          value={bool('mostrar_carrito')} onChange={v => set('mostrar_carrito', v)} />
      </div>

      {/* Tipo de menú */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo de menú</div>
        <p className="text-xs text-gray-400 -mt-2">
          En pantallas chicas el menú siempre es hamburguesa (no rompe el layout con muchos links) —
          esta opción solo define cómo se ve en desktop/tablet.
        </p>
        <div className="flex gap-2">
          <button onClick={() => set('tipo_menu', 'tradicional')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${tipoMenu === 'tradicional' ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Tradicional
          </button>
          <button onClick={() => set('tipo_menu', 'hamburguesa')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${tipoMenu === 'hamburguesa' ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Hamburguesa
          </button>
        </div>
        {links.length > 6 && tipoMenu === 'tradicional' && (
          <p className="text-[10px] text-amber-600">
            {links.length} links puede verse apretado en modo Tradicional en pantallas más chicas de desktop — considerá Hamburguesa.
          </p>
        )}
      </div>

      {/* Posición del ícono hamburguesa */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Posición del ícono hamburguesa</div>
        <p className="text-xs text-gray-400 -mt-2">
          En mobile el menú siempre es hamburguesa (ver arriba) — esta posición aplica ahí, y también en
          desktop/tablet si elegiste el tipo de menú Hamburguesa. El menú se despliega pegado al mismo lado del ícono.
        </p>
        <div className="flex gap-2">
          <button onClick={() => set('menu_posicion', 'izquierda')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${menuPosicion === 'izquierda' ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Izquierda
          </button>
          <button onClick={() => set('menu_posicion', 'derecha')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${menuPosicion === 'derecha' ? 'bg-[#1D9E75] text-white border-[#1D9E75]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Derecha
          </button>
        </div>
      </div>

      <EnlacesEditor titulo="Links de navegación" enlaces={links} onChange={v => set('links', v)}
        placeholderLabel="Nuevo link" placeholderHref="/" />

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100" data-testid="navbar-preview-editor">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-1.5 bg-gray-50 border-b border-gray-100 font-semibold">Preview (desktop)</div>
        <NavbarPreviewBar datos={datos} tema={tema} nombreTienda={nombreTienda} />
      </div>
    </div>
  );
}

// Barra estática del navbar (sin routing, sin estado) — reusada dentro del
// mini-preview de NavbarCard y en el panel grande "Vista previa en vivo"
// (ScaledPreview), ambos alimentados por el mismo borrador en memoria.
function NavbarPreviewBar({ datos, tema, nombreTienda }: {
  datos: Record<string, any>; tema: TemaGlobal; nombreTienda: string;
}) {
  const bool = (k: string, def = true) => datos[k] ?? def;
  const bg = datos.bg_color || tema.bg_color;
  const texto = datos.texto_color || tema.texto_color;
  const fontFamily = datos.font_family || tema.font_family || undefined;
  const tipoMenu: 'tradicional' | 'hamburguesa' = datos.tipo_menu === 'hamburguesa' ? 'hamburguesa' : 'tradicional';
  const menuPosicion: 'izquierda' | 'derecha' = datos.menu_posicion === 'izquierda' ? 'izquierda' : 'derecha';
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : NAV_LINKS_DEFAULT;

  const hamburguesa = tipoMenu === 'hamburguesa' && (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: texto }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </div>
  );
  const logo = datos.logo_url
    ? <img src={datos.logo_url} alt="Logo" style={{ height: `${datos.logo_alto ?? 32}px` }} className="object-contain" />
    : <span className="text-base font-semibold whitespace-nowrap" style={{ color: texto }}>
        {nombreTienda || 'matelaser studio'}
      </span>;

  return (
    <div className="px-6 h-14 flex items-center justify-between gap-4"
      style={{ backgroundColor: bg, borderBottom: `1px solid ${datos.border_color || '#f3f4f6'}`, fontFamily }}>
      <div className="flex items-center gap-3">
        {menuPosicion === 'izquierda' && hamburguesa}
        {logo}
      </div>
      {tipoMenu === 'tradicional' && (
        <div className="flex items-center gap-4 flex-1 justify-center min-w-0 overflow-hidden">
          {links.map((l, i) => <span key={i} className="text-xs whitespace-nowrap" style={{ color: texto }}>{l.label}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2">
        {bool('mostrar_buscar') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>}
        {bool('mostrar_usuario') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>}
        {bool('mostrar_carrito') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>}
        {menuPosicion === 'derecha' && hamburguesa}
      </div>
    </div>
  );
}

// ── Editor genérico de lista de enlaces (label + href) ───────────────────────
// Reutilizado tanto para los links secundarios del footer como para sus
// redes sociales — misma forma de dato ({label, href}), solo cambia el
// texto de la sección y los placeholders.
function EnlacesEditor({ titulo, enlaces, onChange, placeholderLabel, placeholderHref }: {
  titulo: string; enlaces: { label: string; href: string }[]; onChange: (v: { label: string; href: string }[]) => void;
  placeholderLabel: string; placeholderHref: string;
}) {
  const update = (idx: number, key: 'label' | 'href', val: string) =>
    onChange(enlaces.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const agregar = () => onChange([...enlaces, { label: placeholderLabel, href: placeholderHref }]);
  const eliminar = (idx: number) => onChange(enlaces.filter((_, i) => i !== idx));
  const mover = (idx: number, dir: -1 | 1) => {
    const destino = idx + dir;
    if (destino < 0 || destino >= enlaces.length) return;
    const copia = [...enlaces];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onChange(copia);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{titulo}</div>
        <button onClick={agregar}
          className="text-xs font-medium text-[#1D9E75] hover:underline flex items-center gap-1">
          <Plus size={12} /> Agregar
        </button>
      </div>
      {enlaces.map((enlace, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col flex-shrink-0">
            <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover arriba"
              className="w-6 h-4 flex items-center justify-center text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors">
              <ChevronUp size={11} />
            </button>
            <button onClick={() => mover(i, 1)} disabled={i === enlaces.length - 1} aria-label="Mover abajo"
              className="w-6 h-4 flex items-center justify-center text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors">
              <ChevronDown size={11} />
            </button>
          </div>
          <input className={inputCls} value={enlace.label} placeholder="Etiqueta"
            onChange={e => update(i, 'label', e.target.value)} />
          <input className={inputCls} value={enlace.href} placeholder="/ruta o https://..."
            onChange={e => update(i, 'href', e.target.value)} />
          <button onClick={() => eliminar(i)} aria-label="Eliminar enlace"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Editor de footer ──────────────────────────────────────────────────────────
function FooterEditor({ datos, set, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; tema: TemaGlobal;
}) {
  const bg = datos.bg_color || tema.bg_color;
  const texto = datos.texto_color || tema.texto_color;
  const fontFamily = datos.font_family || tema.font_family || undefined;
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : FOOTER_LINKS_DEFAULT;
  const redes: { label: string; href: string }[] = Array.isArray(datos.redes) ? datos.redes : FOOTER_REDES_DEFAULT;

  return (
    <div className="flex flex-col gap-4">
      {/* Colores */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Colores</div>
        <p className="text-xs text-gray-400 -mt-2">Vacío = hereda el color del tema global.</p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          <ColorField label="Color del texto" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
        </div>
      </div>

      {/* Tipografía */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipografía</div>
        <div>
          <label className={labelCls}>Fuente de letra</label>
          <select className={selectCls}
            value={datos.font_family || ''}
            onChange={e => { set('font_family', e.target.value); cargarGoogleFont(e.target.value); }}
            style={{ fontFamily: datos.font_family || undefined }}>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Predeterminada = hereda la tipografía del tema global.</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contenido</div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input className={inputCls} value={datos.tagline ?? FOOTER_TAGLINE_DEFAULT}
            onChange={e => set('tagline', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Copyright</label>
          <input className={inputCls} value={datos.copyright ?? FOOTER_COPYRIGHT_DEFAULT}
            onChange={e => set('copyright', e.target.value)} />
        </div>
      </div>

      <EnlacesEditor titulo="Links secundarios" enlaces={links} onChange={v => set('links', v)}
        placeholderLabel="Nuevo link" placeholderHref="/" />

      <EnlacesEditor titulo="Redes sociales" enlaces={redes} onChange={v => set('redes', v)}
        placeholderLabel="@usuario" placeholderHref="https://instagram.com/usuario" />

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-1.5 bg-gray-50 border-b border-gray-100 font-semibold">Preview</div>
        <div className="px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{ backgroundColor: bg, fontFamily }}>
          <div>
            <div className="font-bold tracking-tight mb-1" style={{ color: texto }}>matelaser studio</div>
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: `${texto}70` }}>
              {datos.tagline ?? FOOTER_TAGLINE_DEFAULT}
            </p>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: texto }}>
            {links.map((l, i) => <span key={i}>{l.label}</span>)}
          </div>
          <div className="flex gap-3 items-center text-xs" style={{ color: texto }}>
            {redes.map((r, i) => <span key={i}>{r.label}</span>)}
            <span style={{ color: `${texto}50` }}>{datos.copyright ?? FOOTER_COPYRIGHT_DEFAULT}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card del footer (dentro del tab Inicio, al final) ────────────────────────
// Mismo criterio que NavbarCard: el footer vive en el mismo array/endpoint
// que el resto de las secciones, pero no se reordena ni se elimina — se
// renderiza fijo al pie de TODAS las páginas del sitio, no solo el inicio.
function FooterCard({ datos, set, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; tema: TemaGlobal;
}) {
  const [expandida, setExpandida] = useState(false);
  return (
    <div className="bg-white border border-gray-100 rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <Layout size={16} className="text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Footer</div>
          <div className="text-xs text-gray-400 truncate">Fijo al pie de todas las páginas — no se reordena</div>
        </div>
        <button onClick={() => setExpandida(e => !e)}
          aria-label={expandida ? 'Colapsar footer' : 'Editar footer'}
          className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-gray-50 px-4 pb-4 pt-3"
          >
            <FooterEditor datos={datos} set={set} tema={tema} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminConfiguracion() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'homepage' | 'tema' | 'tienda'>('homepage');
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargado, setCargado] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoSeccion>('hero');
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  // Snapshot de la última versión guardada de configForm — se actualiza al
  // cargar del borrador y al guardar con éxito. Comparado contra configForm
  // en cada render, permite avisar "cambios sin guardar" en las tabs Tema y
  // Tienda (comparten este mismo formulario) antes de que el admin navegue
  // a otra sección del sidebar y los pierda en silencio.
  const [configFormGuardado, setConfigFormGuardado] = useState<Record<string, string>>({});
  const [configOk, setConfigOk] = useState(false);

  // El editor siempre lee/escribe el BORRADOR — nunca lo publicado
  // directamente. Lo que ve el admin acá es su propia vista previa real:
  // no hay ningún modo "simulación" aparte.
  const { data: seccionesRemote } = useQuery<Seccion[]>({
    queryKey: ['homepage', 'borrador'],
    queryFn: () => api.get('/configuracion/homepage/borrador').then(r => r.data),
  });

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion', 'borrador'],
    queryFn: () => api.get('/configuracion/borrador').then(r => r.data),
  });

  const { data: estadoPublicacion } = useQuery<{ hayCambios: boolean }>({
    queryKey: ['configuracion', 'estado-publicacion'],
    queryFn: () => api.get('/configuracion/estado-publicacion').then(r => r.data),
  });

  const tema = useTemaGlobalData('borrador');

  useEffect(() => {
    if (!seccionesRemote || !config || cargado) return;
    // Migración: si todavía no existe una sección tipo 'navbar' (instalación
    // previa a esta fase), se sintetiza una a partir de las claves sueltas
    // legacy (navbar_*) para que el navbar pase a vivir en homepage_sections
    // como cualquier otro bloque. No pisa nada remoto hasta el próximo guardado.
    const yaTieneNavbar = seccionesRemote.some(s => s.tipo === 'navbar');
    const navbarMigrada: Seccion = {
      id: crypto.randomUUID(),
      tipo: 'navbar',
      activo: true,
      // El backend valida orden >= 0 (@Min(0) en HomepageSeccionDto) — un
      // valor negativo acá hacía fallar CUALQUIER guardado de /homepage
      // (incluida una simple eliminación de sección) con 400 Bad Request,
      // sin feedback visible para el admin. El valor en sí no importa
      // funcionalmente: el navbar se excluye de la lista reordenable por
      // tipo, no por orden — se usa un sentinel alto para que no choque con
      // el índice de ninguna sección real.
      orden: 999999,
      datos: {
        bg_color: config.navbar_bg_color || '',
        texto_color: config.navbar_texto_color || '',
        border_color: config.navbar_border_color || '',
        logo_url: config.navbar_logo_url || '',
        logo_alto: config.navbar_logo_alto || '32',
        mostrar_buscar: (config.navbar_mostrar_buscar ?? 'true') !== 'false',
        mostrar_usuario: (config.navbar_mostrar_usuario ?? 'true') !== 'false',
        mostrar_carrito: (config.navbar_mostrar_carrito ?? 'true') !== 'false',
        tipo_menu: 'tradicional',
        // Migración de nav_links (clave suelta legacy, JSON string) a
        // datos.links (array, editable con agregar/quitar/reordenar).
        links: (() => {
          if (!config.nav_links) return NAV_LINKS_DEFAULT;
          try {
            const parsed = typeof config.nav_links === 'string' ? JSON.parse(config.nav_links) : config.nav_links;
            return Array.isArray(parsed) ? parsed : NAV_LINKS_DEFAULT;
          } catch { return NAV_LINKS_DEFAULT; }
        })(),
      },
    };
    const conNavbar = yaTieneNavbar ? seccionesRemote : [...seccionesRemote, navbarMigrada];

    // Migración del footer: no tenía ninguna clave suelta previa (estaba
    // 100% hardcodeado en Footer.tsx) — se sintetiza con esos mismos
    // valores fijos para que el sitio se vea igual hasta el próximo guardado.
    const yaTieneFooter = conNavbar.some(s => s.tipo === 'footer');
    const footerMigrado: Seccion = {
      id: crypto.randomUUID(),
      tipo: 'footer',
      activo: true,
      orden: 999999,
      datos: {
        bg_color: '#0a0a0a',
        texto_color: '#ffffff',
        tagline: FOOTER_TAGLINE_DEFAULT,
        links: FOOTER_LINKS_DEFAULT,
        redes: FOOTER_REDES_DEFAULT,
        copyright: FOOTER_COPYRIGHT_DEFAULT,
      },
    };
    setSecciones(yaTieneFooter ? conNavbar : [...conNavbar, footerMigrado]);
    setCargado(true);
  }, [seccionesRemote, config, cargado]);

  useEffect(() => {
    if (config && Object.keys(configForm).length === 0) {
      const form: Record<string, string> = {};
      for (const [k, v] of Object.entries(config)) {
        if (k !== 'homepage_sections') form[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      setConfigForm(form);
      setConfigFormGuardado(form);
    }
  }, [config]);

  const guardarHomepageMutation = useMutation({
    mutationFn: (secs: Seccion[]) => api.put('/configuracion/homepage', { secciones: secs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    },
  });

  const guardarConfigMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/configuracion', data),
    onSuccess: (_res, data) => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setConfigFormGuardado(data);
      setConfigOk(true);
      setTimeout(() => setConfigOk(false), 3000);
    },
  });

  const [publicando, setPublicando] = useState(false);
  const [descartando, setDescartando] = useState(false);

  const publicarMutation = useMutation({
    mutationFn: () => api.post('/configuracion/publicar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setPublicando(true);
      setTimeout(() => setPublicando(false), 3000);
    },
  });

  const descartarMutation = useMutation({
    mutationFn: () => api.post('/configuracion/descartar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage', 'borrador'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'borrador'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setDescartando(true);
      setTimeout(() => setDescartando(false), 3000);
    },
  });

  const publicarCambios = () => {
    const ok = window.confirm('Vas a hacer visibles estos cambios a todos los clientes. ¿Confirmás?');
    if (!ok) return;
    publicarMutation.mutate();
  };

  const descartarCambios = () => {
    const ok = window.confirm('Se va a descartar todo lo que editaste desde la última publicación. ¿Confirmás?');
    if (!ok) return;
    descartarMutation.mutate();
  };

  // El navbar y el footer comparten el mismo array/endpoint que el resto de
  // las secciones, pero no aparecen en la lista reordenable de "Inicio" ni
  // en el selector de "Agregar sección" — cada uno tiene su propia card fija.
  const seccionesHomepage = secciones.filter(s => s.tipo !== 'navbar' && s.tipo !== 'footer');
  const navbarSec = secciones.find(s => s.tipo === 'navbar');
  const footerSec = secciones.find(s => s.tipo === 'footer');

  const agregarSeccion = () => {
    const nueva: Seccion = {
      id: crypto.randomUUID(),
      tipo: nuevoTipo,
      activo: true,
      orden: seccionesHomepage.length,
      datos: { ...TIPO_DEFAULTS[nuevoTipo] },
    };
    setSecciones(prev => [...prev, nueva]);
  };

  const actualizarSeccion = (id: string, sec: Seccion) =>
    setSecciones(prev => prev.map(s => s.id === id ? sec : s));

  const eliminarSeccion = (id: string) => {
    const sec = secciones.find(s => s.id === id);
    const nombre = sec ? (TIPO_LABELS[sec.tipo as TipoSeccion] ?? 'esta sección') : 'esta sección';
    if (!confirm(`¿Eliminar el bloque "${nombre}"? Se pierde su título, imágenes, botones y estilos propios — no se puede deshacer.`)) return;
    setSecciones(prev => prev.filter(s => s.id !== id));
  };

  const moverSeccion = (id: string, dir: -1 | 1) =>
    setSecciones(prev => {
      const homepage = prev.filter(s => s.tipo !== 'navbar' && s.tipo !== 'footer');
      const otras = prev.filter(s => s.tipo === 'navbar' || s.tipo === 'footer');
      const idx = homepage.findIndex(s => s.id === id);
      if (idx === -1 || idx + dir < 0 || idx + dir >= homepage.length) return prev;
      [homepage[idx], homepage[idx + dir]] = [homepage[idx + dir], homepage[idx]];
      return [...homepage.map((s, i) => ({ ...s, orden: i })), ...otras];
    });

  const actualizarNavbarDatos = (k: string, v: any) => {
    if (!navbarSec) return;
    actualizarSeccion(navbarSec.id, { ...navbarSec, datos: { ...navbarSec.datos, [k]: v } });
  };

  const actualizarFooterDatos = (k: string, v: any) => {
    if (!footerSec) return;
    actualizarSeccion(footerSec.id, { ...footerSec, datos: { ...footerSec.datos, [k]: v } });
  };

  // "Aplicar" / "Aplicar a todo" del tab Tema — ver limpiarDatosSeccion.
  const aplicarTema = (modo: 'todo' | 'solo_vacios') => {
    if (modo === 'todo') {
      const ok = window.confirm('Esto va a borrar la personalización de todos los bloques, títulos y botones. ¿Confirmás?');
      if (!ok) return;
    }
    const nuevas = secciones.map(sec => ({ ...sec, datos: limpiarDatosSeccion(sec.datos, modo) }));
    setSecciones(nuevas);
    guardarHomepageMutation.mutate(nuevas);
  };

  const hayCambiosSinPublicar = estadoPublicacion?.hayCambios ?? false;

  // Tema y Tienda comparten este mismo formulario (claves sueltas de
  // configuración) — si el admin edita acá y navega a otra sección del
  // sidebar sin guardar, lo pierde en silencio. Este flag alimenta el aviso
  // visual en ambas tabs (ver JSX de "tema" y "tienda" más abajo).
  const hayCambiosConfigSinGuardar = JSON.stringify(configForm) !== JSON.stringify(configFormGuardado);

  // Aviso del navegador al cerrar/recargar la pestaña con cambios sin
  // guardar en Tema/Tienda. No cubre la navegación interna del sidebar
  // (SPA) — para eso está el indicador visual en cada tab.
  useEffect(() => {
    if (!hayCambiosConfigSinGuardar) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hayCambiosConfigSinGuardar]);

  // Tema "en vivo": se calcula directo de configForm (el estado editable en
  // memoria), no del borrador ya guardado en el backend — así el preview
  // refleja cada tecla, no solo lo que ya se guardó con "Guardar tema".
  const temaEnVivo: TemaGlobal = {
    bg_color: configForm.tema_bg_color || '#ffffff',
    texto_color: configForm.tema_texto_color || '#111111',
    texto_secundario_color: configForm.tema_texto_secundario_color || '#6b7280',
    font_family: configForm.tema_font_family || '',
    accent_color: configForm.tema_accent_color || '#1D9E75',
    badge_color: configForm.tema_badge_color || '#111111',
  };
  const seccionesPreview = secciones.filter(s => s.activo && s.tipo !== 'navbar' && s.tipo !== 'footer');
  const mostrarPreview = tab === 'homepage' || tab === 'tema';

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 max-w-6xl">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-400 mt-0.5">Personalizá la tienda y el inicio</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {hayCambiosSinPublicar && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              Tenés cambios sin publicar
            </span>
          )}
          <FeedbackToast show={publicando} className="text-xs text-[#1D9E75]">¡Publicado correctamente!</FeedbackToast>
          <FeedbackToast show={descartando} className="text-xs text-gray-500">Cambios descartados</FeedbackToast>
          <div className="flex gap-2">
            <button onClick={descartarCambios}
              disabled={descartarMutation.isPending || !hayCambiosSinPublicar}
              className="border border-gray-200 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              Descartar cambios del borrador
            </button>
            <motion.button onClick={publicarCambios} whileTap={{ scale: 0.97 }}
              disabled={publicarMutation.isPending || !hayCambiosSinPublicar}
              className="bg-[#111111] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-black disabled:opacity-50">
              {publicarMutation.isPending ? 'Publicando...' : 'Publicar cambios'}
            </motion.button>
          </div>
        </div>
      </div>

      <div className={`flex flex-col ${mostrarPreview ? 'xl:flex-row' : ''} gap-6 items-start`}>
      <div className="flex flex-col gap-6 w-full max-w-3xl flex-shrink-0">

      <div className="flex gap-1 border border-gray-100 rounded-xl p-1 bg-white w-fit">
        {(['homepage', 'tema', 'tienda'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'homepage' ? 'Inicio' : t === 'tema' ? 'Tema' : 'Tienda'}
            {/* Tema y Tienda comparten el mismo formulario — el punto avisa
                que hay cambios sin guardar aunque no estés parado en esa tab. */}
            {(t === 'tema' || t === 'tienda') && hayCambiosConfigSinGuardar && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" title="Cambios sin guardar" />
            )}
          </button>
        ))}
      </div>

      {tab === 'homepage' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Cada sección tiene dos tabs: <strong>Contenido</strong> (textos, links) y <strong>Estilo</strong> (colores, tipografía, layout).
          </p>

          {navbarSec && (
            <NavbarCard datos={navbarSec.datos} set={actualizarNavbarDatos}
              nombreTienda={configForm.nombre_tienda ?? ''} tema={tema} />
          )}

          <div className="flex flex-col gap-2">
            {seccionesHomepage.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
                {cargado ? 'No hay secciones. Agregá una abajo.' : 'Cargando...'}
              </div>
            )}
            {seccionesHomepage.map((sec, idx) => (
              <SeccionCard key={sec.id} sec={sec} idx={idx} total={seccionesHomepage.length}
                onChange={s => actualizarSeccion(sec.id, s)}
                onRemove={() => eliminarSeccion(sec.id)}
                onMoveUp={() => moverSeccion(sec.id, -1)}
                onMoveDown={() => moverSeccion(sec.id, 1)} />
            ))}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as TipoSeccion)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-[#1D9E75]">
              {(Object.keys(TIPO_LABELS) as TipoSeccion[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
            <button onClick={agregarSeccion}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2 font-medium transition-colors flex-shrink-0">
              <Plus size={14} /> Agregar sección
            </button>
          </div>

          {footerSec && (
            <FooterCard datos={footerSec.datos} set={actualizarFooterDatos} tema={tema} />
          )}

          <div className="flex items-center justify-end gap-3">
            <FeedbackToast show={guardadoOk} className="text-xs text-[#1D9E75]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarHomepageMutation.mutate(secciones)} whileTap={{ scale: 0.97 }}
              disabled={guardarHomepageMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarHomepageMutation.isPending ? 'Guardando...' : 'Guardar inicio'}
            </motion.button>
          </div>
        </div>
      )}

      {tab === 'tema' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Color de fondo, color de letra y tipografía por defecto de todo el sitio.
          </p>
          <TemaEditor form={configForm} setForm={setConfigForm}
            onAplicar={() => aplicarTema('solo_vacios')}
            onAplicarATodo={() => aplicarTema('todo')}
            aplicando={guardarHomepageMutation.isPending}
            aplicadoOk={guardadoOk} />
          <div className="flex items-center justify-end gap-3">
            {hayCambiosConfigSinGuardar && !configOk && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Tenés cambios sin guardar
              </span>
            )}
            <FeedbackToast show={configOk} className="text-xs text-[#1D9E75]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarConfigMutation.mutate(configForm)} whileTap={{ scale: 0.97 }}
              disabled={guardarConfigMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar tema'}
            </motion.button>
          </div>
        </div>
      )}

      {tab === 'tienda' && (
        <div className="flex flex-col gap-4">

          {/* Datos generales */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos generales</div>
            {[
              { key: 'nombre_tienda', label: 'Nombre de la tienda', placeholder: 'Mate Laser Studio' },
              { key: 'email_contacto', label: 'Email de contacto', placeholder: 'hola@matelaser.com' },
              { key: 'telefono_contacto', label: 'Teléfono / WhatsApp (con código de país)', placeholder: '+5491112345678' },
              { key: 'whatsapp_mensaje', label: 'Mensaje pre-cargado de WhatsApp', placeholder: '¡Hola! Quiero hacer un pedido personalizado 🧉' },
              { key: 'moneda', label: 'Moneda', placeholder: 'ARS' },
              { key: 'envio_gratis_monto', label: 'Monto mínimo para envío gratis ($)', placeholder: '15000' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} value={configForm[key] ?? ''} placeholder={placeholder}
                  onChange={e => setConfigForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <div>
                <div className="text-sm font-medium">Envío gratis activo</div>
                <div className="text-xs text-gray-400">Cuando el subtotal supera el monto mínimo</div>
              </div>
              <button
                onClick={() => setConfigForm(f => ({ ...f, envio_gratis_activo: f.envio_gratis_activo === 'true' ? 'false' : 'true' }))}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${configForm.envio_gratis_activo === 'true' ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${configForm.envio_gratis_activo === 'true' ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {hayCambiosConfigSinGuardar && !configOk && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Tenés cambios sin guardar
              </span>
            )}
            <FeedbackToast show={configOk} className="text-xs text-[#1D9E75]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarConfigMutation.mutate(configForm)} whileTap={{ scale: 0.97 }}
              disabled={guardarConfigMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </motion.button>
          </div>
        </div>
      )}
      </div>

      {mostrarPreview && (
        <div className="w-full xl:flex-1 xl:sticky xl:top-6 min-w-0" data-testid="navbar-preview-live">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-2 bg-gray-50 border-b border-gray-100 font-semibold flex items-center justify-between">
              <span>Vista previa en vivo — borrador</span>
              <span className="normal-case font-normal text-gray-300">así lo ven vos, no los clientes</span>
            </div>
            <div className="max-h-[calc(100vh-140px)] overflow-y-auto bg-gray-50">
              <ScaledPreview>
                {navbarSec && (
                  <NavbarPreviewBar datos={navbarSec.datos} tema={temaEnVivo} nombreTienda={configForm.nombre_tienda ?? ''} />
                )}
                {seccionesPreview.length === 0
                  ? <div className="text-center py-16 text-sm text-gray-400">No hay secciones activas para mostrar.</div>
                  : <HomeSecciones secciones={seccionesPreview} tema={temaEnVivo} />
                }
              </ScaledPreview>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

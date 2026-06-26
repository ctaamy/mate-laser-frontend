import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Save, Palette, Type, Layout, ChevronRight, Image } from 'lucide-react';
import api from '../../lib/api';
import SeccionImageUploader from '../../components/ui/SeccionImageUploader';
import type { Categoria } from '../../types/index';

// ── tipos ────────────────────────────────────────────────────────────────────
type TipoSeccion = 'hero' | 'banner_texto' | 'productos_destacados' | 'categorias_grid' | 'texto_libre' | 'banner_imagen' | 'stats_barra' | 'como_funciona' | 'cta_banner';

interface Seccion {
  id: string;
  tipo: TipoSeccion;
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
};

// Defaults de contenido + estilo por tipo
const TIPO_DEFAULTS: Record<TipoSeccion, Record<string, any>> = {
  hero: {
    slides: [
      { titulo: 'Mates únicos,\nhechos a tu medida', subtitulo: 'Diseño exclusivo para cada cliente.', imagen_url: '', btn_texto: 'Ver colección', btn_link: '/productos', bg_color: '#111111', texto_color: '#ffffff' },
    ],
    intervalo: 5,
    // campos legacy para backward compat
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
      { valor: '1200+', label: 'Mates entregados' },
      { valor: '98%', label: 'Clientes satisfechos' },
      { valor: '48hs', label: 'Tiempo de entrega' },
      { valor: '5★', label: 'Calificación' },
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

  // Todas las categorías disponibles: raíces + sus hijos (aplanadas)
  const todasPlanas: Categoria[] = [];
  todasCategorias.forEach(c => {
    todasPlanas.push(c);
    ((c as any).other_categorias ?? []).forEach((h: Categoria) => todasPlanas.push(h));
  });
  const disponibles = todasPlanas.filter(c => !selectedIds.has(c.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Título */}
      <div>
        <label className={labelCls}>Título de sección</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
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
            const cat = todasPlanas.find(c => c.id === item.id);
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

// ── Editor de slides del hero ─────────────────────────────────────────────────
interface HeroSlide {
  titulo: string; subtitulo?: string; imagen_url?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  bg_color?: string; texto_color?: string;
}

const SLIDE_DEFAULT: HeroSlide = {
  titulo: 'Mates únicos,\nhechos a tu medida',
  subtitulo: 'Diseño exclusivo para cada cliente.',
  imagen_url: '',
  btn_texto: 'Ver colección',
  btn_link: '/productos',
  bg_color: '#111111',
  texto_color: '#ffffff',
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
          <SeccionImageUploader label="Imagen" value={slide.imagen_url || ''} onChange={v => set('imagen_url', v)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Color de fondo</label>
              <div className="flex gap-2">
                <input type="color" value={slide.bg_color || '#111111'} onChange={e => set('bg_color', e.target.value)}
                  className="w-8 h-[34px] rounded border border-gray-200 cursor-pointer p-0.5" />
                <input className={inputCls} value={slide.bg_color || ''} onChange={e => set('bg_color', e.target.value)} placeholder="#111111" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Color de texto</label>
              <div className="flex gap-2">
                <input type="color" value={slide.texto_color || '#ffffff'} onChange={e => set('texto_color', e.target.value)}
                  className="w-8 h-[34px] rounded border border-gray-200 cursor-pointer p-0.5" />
                <input className={inputCls} value={slide.texto_color || ''} onChange={e => set('texto_color', e.target.value)} placeholder="#ffffff" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Texto botón 1</label>
              <input className={inputCls} value={slide.btn_texto || ''} onChange={e => set('btn_texto', e.target.value)} placeholder="Ver colección" />
            </div>
            <div>
              <label className={labelCls}>Link botón 1</label>
              <input className={inputCls} value={slide.btn_link || ''} onChange={e => set('btn_link', e.target.value)} placeholder="/productos" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Texto botón 2 (opcional)</label>
              <input className={inputCls} value={slide.btn2_texto || ''} onChange={e => set('btn2_texto', e.target.value)} placeholder="¿Cómo funciona?" />
            </div>
            <div>
              <label className={labelCls}>Link botón 2</label>
              <input className={inputCls} value={slide.btn2_link || ''} onChange={e => set('btn2_link', e.target.value)} placeholder="/#como-funciona" />
            </div>
          </div>
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
  const removeSlide = (i: number) => update(slides.filter((_, idx) => idx !== i));

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

  if (tipo === 'stats_barra') {
    const stats: { valor: string; label: string }[] = datos.stats ?? [];
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400">Cada métrica tiene un valor (ej: "1200+") y una etiqueta.</p>
        {stats.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Valor {i + 1}</label>
              <input className={inputCls} value={s.valor} onChange={e => {
                const ns = [...stats]; ns[i] = { ...ns[i], valor: e.target.value }; set('stats', ns);
              }} placeholder="1200+" />
            </div>
            <div>
              <label className={labelCls}>Etiqueta {i + 1}</label>
              <input className={inputCls} value={s.label} onChange={e => {
                const ns = [...stats]; ns[i] = { ...ns[i], label: e.target.value }; set('stats', ns);
              }} placeholder="Mates entregados" />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Texto del botón</label>
          <input className={inputCls} value={datos.btn_texto || ''} onChange={e => set('btn_texto', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Link del botón</label>
          <input className={inputCls} value={datos.btn_link || ''} onChange={e => set('btn_link', e.target.value)} placeholder="/productos" />
        </div>
      </div>
    </div>
  );

  return null;
}

// ── Editor de ESTILO por tipo ────────────────────────────────────────────────
function EditorEstilo({ tipo, datos, set }: {
  tipo: TipoSeccion; datos: Record<string, any>; set: (k: string, v: any) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Colores comunes */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Colores</div>
        <div className="grid grid-cols-2 gap-3">
          {tipo !== 'banner_imagen' && (
            <ColorField label="Fondo" value={datos.bg_color || '#ffffff'} onChange={v => set('bg_color', v)} />
          )}
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <ColorField label="Texto" value={datos.texto_color || '#111111'} onChange={v => set('texto_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Color subtítulo" value={datos.subtitulo_color || '#1D9E75'} onChange={v => set('subtitulo_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Fondo botón" value={datos.btn_color || '#1D9E75'} onChange={v => set('btn_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Texto botón" value={datos.btn_texto_color || '#ffffff'} onChange={v => set('btn_texto_color', v)} />
          )}
          {tipo === 'hero' && datos.imagen_url && (
            <ColorField label="Color overlay (sobre imagen)" value={datos.overlay_color || '#000000'} onChange={v => set('overlay_color', v)} />
          )}
        </div>
        {tipo === 'hero' && datos.imagen_url && (
          <div className="mt-3">
            <label className={labelCls}>Opacidad del overlay: {datos.overlay_opacidad ?? 40}%</label>
            <input type="range" min={0} max={90} value={datos.overlay_opacidad ?? 40}
              onChange={e => set('overlay_opacidad', parseInt(e.target.value))}
              className="w-full accent-[#1D9E75]" />
          </div>
        )}
      </div>

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
            {tipo === 'hero' && (
              <SelectField label="Tamaño subtítulo" value={datos.subtitulo_size || 'xl'} onChange={v => set('subtitulo_size', v)} options={SIZES} />
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
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <SelectField label="Alineación" value={datos.alineacion || 'left'} onChange={v => set('alineacion', v)} options={ALINEACIONES} />
          )}
          {['productos_destacados', 'categorias_grid'].includes(tipo) && (
            <SelectField label="Columnas" value={String(datos.columnas || 3)} onChange={v => set('columnas', parseInt(v))} options={COLUMNAS} />
          )}
          {tipo === 'hero' && (
            <div>
              <label className={labelCls}>Altura mínima (px, vacío = automático)</label>
              <input className={inputCls} type="number" min={200} step={50} value={datos.min_height === 'auto' ? '' : datos.min_height || ''}
                onChange={e => set('min_height', e.target.value || 'auto')} placeholder="400" />
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

// ── Card de sección ──────────────────────────────────────────────────────────
function SeccionCard({ sec, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  sec: Seccion; idx: number; total: number;
  onChange: (s: Seccion) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const [tabEdit, setTabEdit] = useState<'contenido' | 'estilo'>('contenido');
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
          <div className="text-sm font-medium">{TIPO_LABELS[sec.tipo]}</div>
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
      {expandida && (
        <div className="border-t border-gray-50">
          {/* Tabs Contenido / Estilo */}
          <div className="flex gap-1 px-4 pt-3 pb-2">
            <TabBtn active={tabEdit === 'contenido'} onClick={() => setTabEdit('contenido')} icon={Type} label="Contenido" />
            <TabBtn active={tabEdit === 'estilo'} onClick={() => setTabEdit('estilo')} icon={Palette} label="Estilo" />
          </div>
          <div className="px-4 pb-4">
            {tabEdit === 'contenido'
              ? <EditorContenido tipo={sec.tipo} datos={sec.datos} set={set} />
              : <EditorEstilo tipo={sec.tipo} datos={sec.datos} set={set} />
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editor de links de navegación ────────────────────────────────────────────
function NavLinksEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const links: { label: string; href: string }[] = (() => {
    try { return value ? JSON.parse(value) : [
      { label: 'Productos', href: '/productos' },
      { label: 'Personalizado', href: '/productos?personalizado=true' },
      { label: 'Nosotros', href: '/#nosotros' },
    ]; } catch { return []; }
  })();

  const update = (idx: number, key: 'label' | 'href', val: string) => {
    const next = links.map((l, i) => i === idx ? { ...l, [key]: val } : l);
    onChange(JSON.stringify(next));
  };
  const agregar = () => onChange(JSON.stringify([...links, { label: 'Nuevo link', href: '/' }]));
  const eliminar = (idx: number) => onChange(JSON.stringify(links.filter((_, i) => i !== idx)));

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Links de navegación</div>
        <button onClick={agregar}
          className="text-xs font-medium text-[#1D9E75] hover:underline flex items-center gap-1">
          <Plus size={12} /> Agregar link
        </button>
      </div>
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={inputCls} value={link.label} placeholder="Etiqueta"
            onChange={e => update(i, 'label', e.target.value)} />
          <input className={inputCls} value={link.href} placeholder="/ruta"
            onChange={e => update(i, 'href', e.target.value)} />
          <button onClick={() => eliminar(i)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <p className="text-[10px] text-gray-400">Los cambios se aplican al guardar configuración.</p>
    </div>
  );
}

// ── Toggle reutilizable ───────────────────────────────────────────────────────
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

// ── Editor de navbar ──────────────────────────────────────────────────────────
function NavbarEditor({ form, setForm }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const bool = (k: string, def = 'true') => (form[k] ?? def) !== 'false';

  return (
    <div className="flex flex-col gap-4">
      {/* Colores */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Colores</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Color de fondo</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.navbar_bg_color ?? '#ffffff'}
                onChange={e => set('navbar_bg_color', e.target.value)}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
              <input className={inputCls} value={form.navbar_bg_color ?? '#ffffff'}
                onChange={e => set('navbar_bg_color', e.target.value)} placeholder="#ffffff" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Color del texto / íconos</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.navbar_texto_color ?? '#111111'}
                onChange={e => set('navbar_texto_color', e.target.value)}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
              <input className={inputCls} value={form.navbar_texto_color ?? '#111111'}
                onChange={e => set('navbar_texto_color', e.target.value)} placeholder="#111111" />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Color del borde inferior / sombra</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.navbar_border_color ?? '#f3f4f6'}
              onChange={e => set('navbar_border_color', e.target.value)}
              className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
            <input className={inputCls} value={form.navbar_border_color ?? '#f3f4f6'}
              onChange={e => set('navbar_border_color', e.target.value)} placeholder="#f3f4f6" />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Logo</div>
        <div>
          <label className={labelCls}>URL del logo (imagen)</label>
          <input className={inputCls} value={form.navbar_logo_url ?? ''} placeholder="https://... (dejar vacío para usar el nombre)"
            onChange={e => set('navbar_logo_url', e.target.value)} />
          <p className="text-[10px] text-gray-400 mt-1">Si no se especifica una imagen, se muestra el nombre de la tienda como texto.</p>
        </div>
        {form.navbar_logo_url && (
          <div className="flex items-center gap-3">
            <img src={form.navbar_logo_url} alt="Logo preview" className="h-10 object-contain border border-gray-100 rounded-lg p-1 bg-white" />
            <button onClick={() => set('navbar_logo_url', '')} className="text-xs text-red-500 hover:underline">Quitar imagen</button>
          </div>
        )}
        <div>
          <label className={labelCls}>Altura del logo (px)</label>
          <input className={inputCls} type="number" min={20} max={80} value={form.navbar_logo_alto ?? '32'}
            onChange={e => set('navbar_logo_alto', e.target.value)} placeholder="32" />
        </div>
        <SeccionImageUploader
          value={form.navbar_logo_url ?? ''}
          onChange={url => set('navbar_logo_url', url)}
          label="O subir imagen de logo"
        />
      </div>

      {/* Visibilidad de íconos */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Íconos visibles</div>
        <Toggle label="Buscador" desc="Muestra el ícono de búsqueda en la navbar"
          value={bool('navbar_mostrar_buscar')} onChange={v => set('navbar_mostrar_buscar', v ? 'true' : 'false')} />
        <Toggle label="Ícono de usuario" desc="Muestra el ícono de usuario / login"
          value={bool('navbar_mostrar_usuario')} onChange={v => set('navbar_mostrar_usuario', v ? 'true' : 'false')} />
        <Toggle label="Carrito" desc="Muestra el ícono del carrito con badge de items"
          value={bool('navbar_mostrar_carrito')} onChange={v => set('navbar_mostrar_carrito', v ? 'true' : 'false')} />
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-1.5 bg-gray-50 border-b border-gray-100 font-semibold">Preview</div>
        <div className="px-6 h-14 flex items-center justify-between gap-4"
          style={{ backgroundColor: form.navbar_bg_color ?? '#ffffff', borderBottom: `1px solid ${form.navbar_border_color ?? '#f3f4f6'}` }}>
          {form.navbar_logo_url
            ? <img src={form.navbar_logo_url} alt="Logo" style={{ height: `${form.navbar_logo_alto ?? 32}px` }} className="object-contain" />
            : <span className="text-base font-semibold" style={{ color: form.navbar_texto_color ?? '#111111' }}>
                {form.nombre_tienda || 'matelaser studio'}
              </span>
          }
          <div className="flex items-center gap-2">
            {bool('navbar_mostrar_buscar') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: form.navbar_texto_color ?? '#111111' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>}
            {bool('navbar_mostrar_usuario') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: form.navbar_texto_color ?? '#111111' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>}
            {bool('navbar_mostrar_carrito') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: form.navbar_texto_color ?? '#111111' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminConfiguracion() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'homepage' | 'navbar' | 'tienda'>('homepage');
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargado, setCargado] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoSeccion>('hero');
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [configOk, setConfigOk] = useState(false);

  const { data: seccionesRemote } = useQuery<Seccion[]>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/configuracion/homepage').then(r => r.data),
  });

  useEffect(() => {
    if (seccionesRemote && !cargado) {
      setSecciones(seccionesRemote);
      setCargado(true);
    }
  }, [seccionesRemote, cargado]);

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
  });

  useEffect(() => {
    if (config && Object.keys(configForm).length === 0) {
      const form: Record<string, string> = {};
      for (const [k, v] of Object.entries(config)) {
        if (k !== 'homepage_sections') form[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      setConfigForm(form);
    }
  }, [config]);

  const guardarHomepageMutation = useMutation({
    mutationFn: (secs: Seccion[]) => api.put('/configuracion/homepage', { secciones: secs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage'] });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    },
  });

  const guardarConfigMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/configuracion', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      setConfigOk(true);
      setTimeout(() => setConfigOk(false), 3000);
    },
  });

  const agregarSeccion = () => {
    const nueva: Seccion = {
      id: crypto.randomUUID(),
      tipo: nuevoTipo,
      activo: true,
      orden: secciones.length,
      datos: { ...TIPO_DEFAULTS[nuevoTipo] },
    };
    setSecciones(prev => [...prev, nueva]);
  };

  const actualizarSeccion = (idx: number, sec: Seccion) =>
    setSecciones(prev => prev.map((s, i) => i === idx ? sec : s));

  const eliminarSeccion = (idx: number) =>
    setSecciones(prev => prev.filter((_, i) => i !== idx));

  const moverSeccion = (idx: number, dir: -1 | 1) =>
    setSecciones(prev => {
      const arr = [...prev];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return arr.map((s, i) => ({ ...s, orden: i }));
    });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-medium">Configuración</h1>
        <p className="text-sm text-gray-400 mt-0.5">Personalizá la tienda y el inicio</p>
      </div>

      <div className="flex gap-1 border border-gray-100 rounded-xl p-1 bg-white w-fit">
        {(['homepage', 'navbar', 'tienda'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'homepage' ? 'Inicio' : t === 'navbar' ? 'Navbar' : 'Tienda'}
          </button>
        ))}
      </div>

      {tab === 'homepage' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Cada sección tiene dos tabs: <strong>Contenido</strong> (textos, links) y <strong>Estilo</strong> (colores, tipografía, layout).
          </p>

          <div className="flex flex-col gap-2">
            {secciones.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
                {cargado ? 'No hay secciones. Agregá una abajo.' : 'Cargando...'}
              </div>
            )}
            {secciones.map((sec, idx) => (
              <SeccionCard key={sec.id} sec={sec} idx={idx} total={secciones.length}
                onChange={s => actualizarSeccion(idx, s)}
                onRemove={() => eliminarSeccion(idx)}
                onMoveUp={() => moverSeccion(idx, -1)}
                onMoveDown={() => moverSeccion(idx, 1)} />
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

          <div className="flex items-center justify-end gap-3">
            {guardadoOk && <span className="text-xs text-[#1D9E75]">¡Guardado correctamente!</span>}
            <button onClick={() => guardarHomepageMutation.mutate(secciones)}
              disabled={guardarHomepageMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarHomepageMutation.isPending ? 'Guardando...' : 'Guardar inicio'}
            </button>
          </div>
        </div>
      )}

      {tab === 'navbar' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Personalizá los colores, el logo y qué íconos se muestran en la barra de navegación.
          </p>
          <NavbarEditor form={configForm} setForm={setConfigForm} />
          <div className="flex items-center justify-end gap-3">
            {configOk && <span className="text-xs text-[#1D9E75]">¡Guardado correctamente!</span>}
            <button onClick={() => guardarConfigMutation.mutate(configForm)}
              disabled={guardarConfigMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar navbar'}
            </button>
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
              { key: 'telefono_contacto', label: 'Teléfono / WhatsApp', placeholder: '+54 9 11 1234-5678' },
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

          {/* Links de navegación */}
          <NavLinksEditor
            value={configForm.nav_links ?? ''}
            onChange={v => setConfigForm(f => ({ ...f, nav_links: v }))}
          />

          <div className="flex items-center justify-end gap-3">
            {configOk && <span className="text-xs text-[#1D9E75]">¡Guardado correctamente!</span>}
            <button onClick={() => guardarConfigMutation.mutate(configForm)}
              disabled={guardarConfigMutation.isPending}
              className="bg-[#1D9E75] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

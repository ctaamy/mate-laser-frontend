import { useState } from 'react';
import { Image, Trash2, Plus } from 'lucide-react';
import SeccionImageUploader from '../../ui/SeccionImageUploader';
import { labelCls, inputCls } from './constantes';
import { SLIDE_DEFAULT } from './defaults';
import type { HeroSlide } from './types';
import { BotonesEditor, resolverBotonesLegacy } from './BotonesEditor';
import { Drawer } from './Drawer';
import { DragHandle, SortableList, useSortableItem } from './dnd-utils';

// ── Campos completos de un slide — se editan en el Drawer, no inline ─────────
function HeroSlideFields({ slide, onChange }: {
  slide: HeroSlide; onChange: (s: HeroSlide) => void;
}) {
  const set = (k: keyof HeroSlide, v: string) => onChange({ ...slide, [k]: v });

  return (
    <div className="flex flex-col gap-3">
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
      <div className="bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-3 py-2 flex items-center gap-1.5">
        <span className="text-[13px] text-[var(--ink-soft)]">↳</span>
        <p className="text-[11px] text-[var(--ink-soft)]">
          Opcional — sobreescribe el color base del bloque (tab Estilo) solo para <strong>este slide</strong>.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Fondo de este slide (opcional)</label>
            {slide.bg_color && (
              <button onClick={() => set('bg_color', '')} className="text-[10px] text-[var(--accent)] hover:underline mb-1">
                Heredar del bloque
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input type="color" value={slide.bg_color || '#111111'} onChange={e => set('bg_color', e.target.value)}
              className="w-8 h-[34px] rounded border border-[var(--line)] cursor-pointer p-0.5" />
            <input className={inputCls} value={slide.bg_color || ''} onChange={e => set('bg_color', e.target.value)} placeholder="Hereda del bloque" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Texto de este slide (opcional)</label>
            {slide.texto_color && (
              <button onClick={() => set('texto_color', '')} className="text-[10px] text-[var(--accent)] hover:underline mb-1">
                Heredar del bloque
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input type="color" value={slide.texto_color || '#ffffff'} onChange={e => set('texto_color', e.target.value)}
              className="w-8 h-[34px] rounded border border-[var(--line)] cursor-pointer p-0.5" />
            <input className={inputCls} value={slide.texto_color || ''} onChange={e => set('texto_color', e.target.value)} placeholder="Hereda del bloque" />
          </div>
        </div>
      </div>
      <BotonesEditor botones={resolverBotonesLegacy(slide)} onChange={b => onChange({ ...slide, botones: b })} />
    </div>
  );
}

// ── Fila compacta de un slide (colapsada) ─────────────────────────────────────
// thumbnail 40x40 + label + drag handle + eliminar. Click en la fila (no el
// handle ni el botón de eliminar) abre el Drawer con los campos completos —
// ver comentario de Drawer.tsx sobre por qué se editan ahí y no expandidos
// inline acá (el caso más señalado en la auditoría de jerarquía visual).
function HeroSlideRow({ slide, index, onOpen, onRemove, canRemove }: {
  slide: HeroSlide; index: number; onOpen: () => void; onRemove: () => void; canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, style } = useSortableItem(String(index));
  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-3 border border-[var(--line)] rounded-xl bg-white px-3 py-2">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[var(--n-100)] text-xs font-bold text-[var(--ink-soft)] flex-shrink-0">
        {index + 1}
      </div>
      {slide.imagen_url
        ? <img src={slide.imagen_url} className="w-10 h-10 object-cover rounded flex-shrink-0" />
        : <div className="w-10 h-10 rounded bg-[var(--n-100)] flex items-center justify-center flex-shrink-0"><Image size={14} className="text-[var(--n-300)]" /></div>
      }
      {/* Click en la fila (no el handle ni "eliminar") abre el Drawer — div,
          no button, mismo criterio que el header de SeccionCard (evita
          anidar un <button> dentro de otro). */}
      <div onClick={onOpen} className="flex-1 min-w-0 cursor-pointer">
        <span className="block text-sm font-medium truncate text-[var(--ink)]">
          {slide.titulo?.split('\n')[0] || `Slide ${index + 1}`}
        </span>
        {slide.subtitulo && <span className="block text-xs text-[var(--ink-soft)] truncate">{slide.subtitulo}</span>}
      </div>
      <DragHandle attributes={attributes} listeners={listeners} />
      {canRemove && (
        <button onClick={onRemove} aria-label="Eliminar slide"
          className="w-6 h-6 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors flex-shrink-0">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export function HeroSlidesEditor({ datos, set, onSubDragChange }: {
  datos: Record<string, any>; set: (k: string, v: any) => void;
  onSubDragChange?: (active: boolean) => void;
}) {
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

  const [abierto, setAbierto] = useState<number | null>(null);

  const update = (next: HeroSlide[]) => set('slides', next);
  const updateSlide = (i: number, s: HeroSlide) => update(slides.map((sl, idx) => idx === i ? s : sl));
  const addSlide = () => update([...slides, { ...SLIDE_DEFAULT }]);
  const removeSlide = (i: number) => {
    if (!confirm('¿Eliminar este slide? Se pierde su título, imagen, botones y estilos propios — no se puede deshacer.')) return;
    update(slides.filter((_, idx) => idx !== i));
    setAbierto(a => (a === null || a === i) ? null : (a > i ? a - 1 : a));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--ink-soft)]">{slides.length} slide{slides.length !== 1 ? 's' : ''}. El hero los mostrará en bucle automáticamente.</p>
        <button onClick={addSlide}
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
          <Plus size={12} /> Agregar slide
        </button>
      </div>

      <SortableList
        items={slides}
        getId={(_, i) => String(i)}
        onReorder={update}
        onDragStateChange={onSubDragChange}
        disabled={slides.length < 2}
      >
        <div className="flex flex-col gap-2">
          {slides.map((slide, i) => (
            <HeroSlideRow
              key={i}
              index={i}
              slide={slide}
              onOpen={() => setAbierto(i)}
              onRemove={() => removeSlide(i)}
              canRemove={slides.length > 1}
            />
          ))}
        </div>
      </SortableList>

      <Drawer open={abierto !== null} onClose={() => setAbierto(null)}
        title={abierto !== null ? `Slide ${abierto + 1}` : ''}>
        {abierto !== null && slides[abierto] && (
          <HeroSlideFields slide={slides[abierto]} onChange={s => updateSlide(abierto, s)} />
        )}
      </Drawer>

      {/* Configuración del slider */}
      <div className="border border-[var(--line)] rounded-xl px-4 py-3 bg-[var(--n-50)] flex items-center gap-4">
        <div className="flex-1">
          <label className={labelCls}>Intervalo entre slides (segundos)</label>
          <input className={inputCls} type="number" min={2} max={30} value={datos.intervalo ?? 5}
            onChange={e => set('intervalo', parseInt(e.target.value) || 5)} />
        </div>
      </div>
    </div>
  );
}

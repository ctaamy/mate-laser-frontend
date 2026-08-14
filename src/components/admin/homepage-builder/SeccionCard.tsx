import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ChevronDown, ChevronUp, Trash2, Copy, Palette, Type, Image, AlertTriangle } from 'lucide-react';
import { TabBtn } from './campos-comunes';
import { TIPO_LABELS } from './defaults';
import { EditorContenido } from './EditorContenido';
import { EditorEstilo } from './EditorEstilo';
import { ImagenesEditor } from './ImagenesEditor';
import { DragHandle, useSortableItem } from './dnd-utils';
import { validarSeccion } from './validacion';
import type { Seccion, TipoSeccion } from './types';

// ── Contador de sub-items para el resumen de la card colapsada ──────────────
// Solo los tipos con una lista de sub-items propia (Fase 2-3) muestran un
// contador — el resto no tiene nada que resumir acá.
function contarSubitems(tipo: TipoSeccion, datos: Record<string, any>): string | null {
  if (tipo === 'hero') {
    const n = datos.slides?.length ?? 1;
    return `${n} slide${n !== 1 ? 's' : ''}`;
  }
  if (tipo === 'categorias_grid') {
    const n = datos.categorias_items?.length ?? 0;
    return `${n} categoría${n !== 1 ? 's' : ''}`;
  }
  if (tipo === 'stats_barra') {
    const n = datos.stats?.length ?? 0;
    return `${n} estadística${n !== 1 ? 's' : ''}`;
  }
  if (tipo === 'filtros_rapidos') {
    const n = datos.items?.length ?? 0;
    return `${n} filtro${n !== 1 ? 's' : ''}`;
  }
  return null;
}

// ── Badge de validación (Fase 5) ─────────────────────────────────────────────
// Rojo (bloqueante) tiene prioridad visual sobre ámbar (warning) si la
// sección tiene ambos tipos de problema a la vez. Puramente informativo —
// nunca bloquea guardar ni seguir editando, ver validacion.ts.
function ValidacionBadge({ problemas }: { problemas: ReturnType<typeof validarSeccion> }) {
  if (problemas.length === 0) return null;
  const hayBloqueante = problemas.some(p => p.severidad === 'bloqueante');
  const n = problemas.length;
  const titulo = problemas.map(p => p.mensaje).join(' · ');
  return (
    <span
      data-testid="badge-validacion"
      data-severidad={hayBloqueante ? 'bloqueante' : 'warning'}
      title={titulo}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${
        hayBloqueante ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
      }`}
    >
      <AlertTriangle size={11} />
      {n > 1 ? `${n} problemas` : '1 problema'}
    </span>
  );
}

// ── Card de sección ──────────────────────────────────────────────────────────
export function SeccionCard({ sec, onChange, onRemove, onDuplicate }: {
  sec: Seccion;
  onChange: (s: Seccion) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const [tabEdit, setTabEdit] = useState<'contenido' | 'estilo' | 'imagenes'>('contenido');
  // Mientras un sub-item (ej. un slide del Hero) está siendo arrastrado
  // adentro de esta card, el handle de la card se deshabilita y atenúa —
  // comunica "estás editando adentro de este bloque, no vas a mover la
  // sección entera por error". Ver EditorContenido → HeroSlidesEditor, etc.
  const [subDragActivo, setSubDragActivo] = useState(false);
  const { attributes, listeners, setNodeRef, style } = useSortableItem(sec.id);

  const preview = sec.datos.titulo || sec.datos.texto || sec.datos.imagen_url || '';
  const subitems = contarSubitems(sec.tipo as TipoSeccion, sec.datos);
  const problemasValidacion = validarSeccion(sec);
  const set = (k: string, v: any) => onChange({ ...sec, datos: { ...sec.datos, [k]: v } });

  return (
    <div ref={setNodeRef} style={style} id={`seccion-card-${sec.id}`} data-seccion-id={sec.id}
      className={`bg-white border rounded-xl overflow-hidden transition-opacity ${!sec.activo ? 'opacity-50' : 'border-[var(--line)]'}`}>
      {/* Header — clickeable para expandir/colapsar (excepto handle y botones) */}
      <div className="flex items-center gap-3 px-4 py-3">
        <DragHandle attributes={attributes} listeners={listeners} disabled={subDragActivo} />
        {/* color swatch del fondo */}
        {sec.datos.bg_color && (
          <div className="w-4 h-4 rounded border border-[var(--line)] flex-shrink-0"
            style={{ backgroundColor: sec.datos.bg_color }} />
        )}
        {/* Click en el header (no toda la card, que tiene tabs/botones adentro
            una vez expandida) expande/colapsa — div, no button, para no
            competir con el botón chevron de al lado en el conteo de roles. */}
        <div onClick={() => setExpandida(e => !e)} className="flex-1 min-w-0 cursor-pointer">
          <div className="text-sm font-medium flex items-center gap-2">
            <span>{TIPO_LABELS[sec.tipo as TipoSeccion]}</span>
            {subitems && (
              <span className="text-[10px] font-normal text-[var(--ink-soft)] bg-[var(--n-100)] rounded-full px-2 py-0.5">
                {subitems}
              </span>
            )}
            <ValidacionBadge problemas={problemasValidacion} />
          </div>
          {preview && <div className="text-xs text-[var(--ink-soft)] truncate">{preview}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onChange({ ...sec, activo: !sec.activo })} title={sec.activo ? 'Ocultar' : 'Mostrar'}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors">
            {sec.activo ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => setExpandida(e => !e)}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={onDuplicate} title="Duplicar"
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors">
            <Copy size={13} />
          </button>
          <button onClick={onRemove}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-red-500 hover:border-red-200 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Panel expandido */}
      <AnimatePresence initial={false}>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-[var(--line)]"
          >
            {/* Tabs Contenido / Estilo / Imágenes */}
            <div className="flex gap-1 px-4 pt-3 pb-2">
              <TabBtn active={tabEdit === 'contenido'} onClick={() => setTabEdit('contenido')} icon={Type} label="Contenido" />
              <TabBtn active={tabEdit === 'estilo'} onClick={() => setTabEdit('estilo')} icon={Palette} label="Estilo" />
              <TabBtn active={tabEdit === 'imagenes'} onClick={() => setTabEdit('imagenes')} icon={Image} label="Imágenes" />
            </div>
            <div className="px-4 pb-4">
              {tabEdit === 'contenido' && (
                <EditorContenido tipo={sec.tipo as TipoSeccion} datos={sec.datos} set={set} onSubDragChange={setSubDragActivo} />
              )}
              {tabEdit === 'estilo' && <EditorEstilo tipo={sec.tipo as TipoSeccion} datos={sec.datos} set={set} />}
              {tabEdit === 'imagenes' && <ImagenesEditor datos={sec.datos} set={set} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

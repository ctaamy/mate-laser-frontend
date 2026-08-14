import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Trash2, Palette, Type, Image } from 'lucide-react';
import { TabBtn } from './campos-comunes';
import { TIPO_LABELS } from './defaults';
import { EditorContenido } from './EditorContenido';
import { EditorEstilo } from './EditorEstilo';
import { ImagenesEditor } from './ImagenesEditor';
import type { Seccion, TipoSeccion } from './types';

// ── Card de sección ──────────────────────────────────────────────────────────
export function SeccionCard({ sec, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  sec: Seccion; idx: number; total: number;
  onChange: (s: Seccion) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [expandida, setExpandida] = useState(false);
  const [tabEdit, setTabEdit] = useState<'contenido' | 'estilo' | 'imagenes'>('contenido');
  const preview = sec.datos.titulo || sec.datos.texto || sec.datos.imagen_url || '';
  const set = (k: string, v: any) => onChange({ ...sec, datos: { ...sec.datos, [k]: v } });

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-opacity ${!sec.activo ? 'opacity-50' : 'border-[var(--line)]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical size={16} className="text-[var(--n-300)] flex-shrink-0" />
        {/* color swatch del fondo */}
        {sec.datos.bg_color && (
          <div className="w-4 h-4 rounded border border-[var(--line)] flex-shrink-0"
            style={{ backgroundColor: sec.datos.bg_color }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{TIPO_LABELS[sec.tipo as TipoSeccion]}</div>
          {preview && <div className="text-xs text-[var(--ink-soft)] truncate">{preview}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={idx === 0}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30 transition-colors">
            <ChevronUp size={13} />
          </button>
          <button onClick={onMoveDown} disabled={idx === total - 1}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-30 transition-colors">
            <ChevronDown size={13} />
          </button>
          <button onClick={() => onChange({ ...sec, activo: !sec.activo })} title={sec.activo ? 'Ocultar' : 'Mostrar'}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors">
            {sec.activo ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => setExpandida(e => !e)}
            className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
            {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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

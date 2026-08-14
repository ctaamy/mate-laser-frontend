import { Plus, Trash2 } from 'lucide-react';
import { inputCls } from './constantes';
import { DragHandle, SortableList, useSortableItem } from './dnd-utils';

// ── Fila de un enlace (label + href), arrastrable ────────────────────────────
function EnlaceRow({ index, enlace, onLabelChange, onHrefChange, onRemove }: {
  index: number; enlace: { label: string; href: string };
  onLabelChange: (v: string) => void; onHrefChange: (v: string) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, style } = useSortableItem(String(index));
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white">
      <DragHandle attributes={attributes} listeners={listeners} />
      <input className={inputCls} value={enlace.label} placeholder="Etiqueta"
        onChange={e => onLabelChange(e.target.value)} />
      <input className={inputCls} value={enlace.href} placeholder="/ruta o https://..."
        onChange={e => onHrefChange(e.target.value)} />
      <button onClick={onRemove} aria-label="Eliminar enlace"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-red-500 border border-[var(--line)] rounded-lg transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Editor genérico de lista de enlaces (label + href) ───────────────────────
// Reutilizado tanto para los links secundarios del footer como para sus
// redes sociales, y para los links de navegación del navbar — misma forma
// de dato ({label, href}), solo cambia el texto de la sección y los
// placeholders. Reorden por drag & drop (handle propio, SortableContext con
// namespace de ids propio — ver dnd-utils).
export function EnlacesEditor({ titulo, enlaces, onChange, placeholderLabel, placeholderHref }: {
  titulo: string; enlaces: { label: string; href: string }[]; onChange: (v: { label: string; href: string }[]) => void;
  placeholderLabel: string; placeholderHref: string;
}) {
  const update = (idx: number, key: 'label' | 'href', val: string) =>
    onChange(enlaces.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const agregar = () => onChange([...enlaces, { label: placeholderLabel, href: placeholderHref }]);
  const eliminar = (idx: number) => onChange(enlaces.filter((_, i) => i !== idx));

  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">{titulo}</div>
        <button onClick={agregar}
          className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
          <Plus size={12} /> Agregar
        </button>
      </div>
      <SortableList items={enlaces} getId={(_, i) => String(i)} onReorder={onChange} disabled={enlaces.length < 2}>
        <div className="flex flex-col gap-2">
          {enlaces.map((enlace, i) => (
            <EnlaceRow key={i} index={i} enlace={enlace}
              onLabelChange={v => update(i, 'label', v)}
              onHrefChange={v => update(i, 'href', v)}
              onRemove={() => eliminar(i)} />
          ))}
        </div>
      </SortableList>
    </div>
  );
}

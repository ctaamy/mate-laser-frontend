import { Plus, Trash2 } from 'lucide-react';
import { STAT_ICON_FALLBACK } from '../../ui/StatIcons';
import { inputCls } from './constantes';
import type { StatItemEditable } from './types';
import { IconPickerButton } from './IconPickerButton';
import { DragHandle, SortableList, useSortableItem } from './dnd-utils';

function StatRow({ index, stat, onChange, onRemove }: {
  index: number; stat: StatItemEditable; onChange: (s: StatItemEditable) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, style } = useSortableItem(String(index));
  return (
    <div ref={setNodeRef} style={style} className="border border-[var(--line)] rounded-xl p-3 flex flex-col gap-2 bg-[var(--n-50)]">
      <div className="flex items-center gap-2">
        <DragHandle attributes={attributes} listeners={listeners} />
        <IconPickerButton value={stat.icono} onChange={nombre => onChange({ ...stat, icono: nombre })} />
        <input className={inputCls} value={stat.valor} placeholder="1200+"
          onChange={e => onChange({ ...stat, valor: e.target.value })} />
        <input className={inputCls} value={stat.label} placeholder="Mates entregados"
          onChange={e => onChange({ ...stat, label: e.target.value })} />
        <button onClick={onRemove}
          className="w-7 h-7 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Editor de la barra de estadísticas (stats_barra) ─────────────────────────
// Cantidad de items configurable (agregar/quitar/reordenar por drag & drop),
// mismo patrón que CategoriasGridEditor/FiltrosRapidosEditor — cada item
// tiene valor, etiqueta e ícono (lucide-react, elegido de una lista curada en
// vez de subir imágenes sueltas).
export function StatsBarraEditor({ datos, set, onSubDragChange }: {
  datos: Record<string, any>; set: (k: string, v: any) => void;
  onSubDragChange?: (active: boolean) => void;
}) {
  const stats: StatItemEditable[] = datos.stats ?? [];

  const update = (next: StatItemEditable[]) => set('stats', next);
  const agregar = () => update([...stats, {
    valor: '', label: '',
    icono: STAT_ICON_FALLBACK[stats.length % STAT_ICON_FALLBACK.length],
  }]);
  const eliminar = (i: number) => update(stats.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--ink-soft)]">Estadísticas ({stats.length}) — valor, etiqueta e ícono por cada una.</p>
        <button onClick={agregar} className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
          <Plus size={12} /> Agregar estadística
        </button>
      </div>
      <SortableList items={stats} getId={(_, i) => String(i)} onReorder={update}
        onDragStateChange={onSubDragChange} disabled={stats.length < 2}>
        <div className="flex flex-col gap-3">
          {stats.map((s, i) => (
            <StatRow key={i} index={i} stat={s}
              onChange={next => update(stats.map((st, idx) => idx === i ? next : st))}
              onRemove={() => eliminar(i)} />
          ))}
        </div>
      </SortableList>
      {stats.length === 0 && (
        <p className="text-xs text-[var(--ink-soft)] bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-4 py-3">
          Sin estadísticas — el bloque no se muestra en el sitio hasta agregar al menos una.
        </p>
      )}
    </div>
  );
}

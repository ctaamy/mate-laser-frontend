import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { STAT_ICON_FALLBACK } from '../../ui/StatIcons';
import { inputCls } from './constantes';
import type { StatItemEditable } from './types';
import { IconPickerButton } from './IconPickerButton';

// ── Editor de la barra de estadísticas (stats_barra) ─────────────────────────
// Cantidad de items configurable (agregar/quitar/reordenar), mismo patrón
// que CategoriasGridEditor/FiltrosRapidosEditor — cada item tiene valor,
// etiqueta e ícono (lucide-react, elegido de una lista curada en vez de
// subir imágenes sueltas).
export function StatsBarraEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const stats: StatItemEditable[] = datos.stats ?? [];

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
        <p className="text-xs text-[var(--ink-soft)]">Estadísticas ({stats.length}) — valor, etiqueta e ícono por cada una.</p>
        <button onClick={agregar} className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
          <Plus size={12} /> Agregar estadística
        </button>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="border border-[var(--line)] rounded-xl p-3 flex flex-col gap-2 bg-[var(--n-50)]">
          <div className="flex items-center gap-2">
            <IconPickerButton value={s.icono} onChange={nombre => { const ns = [...stats]; ns[i] = { ...ns[i], icono: nombre }; update(ns); }} />
            <input className={inputCls} value={s.valor} placeholder="1200+"
              onChange={e => { const ns = [...stats]; ns[i] = { ...ns[i], valor: e.target.value }; update(ns); }} />
            <input className={inputCls} value={s.label} placeholder="Mates entregados"
              onChange={e => { const ns = [...stats]; ns[i] = { ...ns[i], label: e.target.value }; update(ns); }} />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => mover(i, -1)} disabled={i === 0}
                className="w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-20 rounded transition-colors">
                <ChevronUp size={13} />
              </button>
              <button onClick={() => mover(i, 1)} disabled={i === stats.length - 1}
                className="w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-20 rounded transition-colors">
                <ChevronDown size={13} />
              </button>
              <button onClick={() => eliminar(i)}
                className="w-7 h-7 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}
      {stats.length === 0 && (
        <p className="text-xs text-[var(--ink-soft)] bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-4 py-3">
          Sin estadísticas — el bloque no se muestra en el sitio hasta agregar al menos una.
        </p>
      )}
    </div>
  );
}

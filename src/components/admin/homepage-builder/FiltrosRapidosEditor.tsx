import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../lib/api';
import type { Categoria } from '../../../types/index';
import { labelCls, inputCls, selectCls, TIPOS_FILTRO } from './constantes';
import type { FiltroItem } from './types';

// ── Editor de la barra de filtros rápidos ────────────────────────────────────
// Cada item es {id, tipo, label, config}: "tipo" decide qué formulario de
// config se muestra y cómo se arma la URL a /productos (ver urlDeFiltro en
// HomeSecciones.tsx — mismos query params que ya lee la sidebar de
// Productos.tsx: categoria_id, apto_grabado). Sumar un tipo nuevo a futuro
// (ej. rango_precio) es agregar un caso acá y en urlDeFiltro, sin migrar los
// items ya guardados de otros tipos.
function nuevoFiltro(tipo: FiltroItem['tipo'], categoriasDisponibles: Categoria[]): FiltroItem {
  if (tipo === 'categoria') {
    const cat = categoriasDisponibles[0];
    return { id: crypto.randomUUID(), tipo, label: cat?.nombre || 'Categoría', config: { categoria_id: cat?.id } };
  }
  return { id: crypto.randomUUID(), tipo: 'apto_grabado', label: 'Apto para grabar', config: {} };
}

export function FiltrosRapidosEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
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
          <p className="text-xs text-[var(--ink-soft)] py-2">Sin filtros — el bloque no se muestra en el sitio hasta agregar al menos uno.</p>
        )}
        <div className="flex flex-col gap-2 mt-1">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-[var(--n-50)] border border-[var(--line)] rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)] flex-shrink-0">
                  {TIPOS_FILTRO.find(t => t.value === item.tipo)?.label}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => mover(idx, -1)} disabled={idx === 0}
                    className="w-6 h-6 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-20 rounded transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => mover(idx, 1)} disabled={idx === items.length - 1}
                    className="w-6 h-6 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-20 rounded transition-colors">
                    <ChevronDown size={13} />
                  </button>
                </div>
                <button onClick={() => eliminar(item.id)}
                  className="w-6 h-6 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-[var(--line)] rounded-lg hover:border-[var(--n-400)] hover:bg-[var(--n-50)] disabled:opacity-30 transition-colors">
              <Plus size={10} /> {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

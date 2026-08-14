import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../../lib/api';
import type { Categoria } from '../../../types/index';
import { labelCls, inputCls, selectCls, TIPOS_FILTRO } from './constantes';
import type { FiltroItem } from './types';
import { DragHandle, SortableList, useSortableItem } from './dnd-utils';

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

function FiltroRow({ item, categorias, onActualizar, onActualizarConfig, onEliminar }: {
  item: FiltroItem; categorias: Categoria[];
  onActualizar: (patch: Partial<FiltroItem>) => void;
  onActualizarConfig: (patch: Record<string, any>) => void;
  onEliminar: () => void;
}) {
  const { attributes, listeners, setNodeRef, style } = useSortableItem(item.id);
  return (
    <div ref={setNodeRef} style={style} className="bg-[var(--n-50)] border border-[var(--line)] rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <DragHandle attributes={attributes} listeners={listeners} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)] flex-shrink-0">
          {TIPOS_FILTRO.find(t => t.value === item.tipo)?.label}
        </span>
        <div className="flex-1" />
        <button onClick={onEliminar}
          className="w-6 h-6 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors">
          <Trash2 size={12} />
        </button>
      </div>

      <div>
        <label className={labelCls}>Texto del chip</label>
        <input className={inputCls} value={item.label} onChange={e => onActualizar({ label: e.target.value })} />
      </div>

      {item.tipo === 'categoria' && (
        <div>
          <label className={labelCls}>Categoría</label>
          <select className={selectCls} value={item.config.categoria_id ?? ''}
            onChange={e => onActualizarConfig({ categoria_id: parseInt(e.target.value) })}>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}{cat.padre_id ? ' (subcategoría)' : ''}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function FiltrosRapidosEditor({ datos, set, onSubDragChange }: {
  datos: Record<string, any>; set: (k: string, v: any) => void;
  onSubDragChange?: (active: boolean) => void;
}) {
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelCls}>Filtros en la barra ({items.length})</label>
        {items.length === 0 && (
          <p className="text-xs text-[var(--ink-soft)] py-2">Sin filtros — el bloque no se muestra en el sitio hasta agregar al menos uno.</p>
        )}
        <SortableList items={items} getId={i => i.id} onReorder={updateItems}
          onDragStateChange={onSubDragChange} disabled={items.length < 2}>
          <div className="flex flex-col gap-2 mt-1">
            {items.map(item => (
              <FiltroRow key={item.id} item={item} categorias={categorias}
                onActualizar={patch => actualizar(item.id, patch)}
                onActualizarConfig={patch => actualizarConfig(item.id, patch)}
                onEliminar={() => eliminar(item.id)} />
            ))}
          </div>
        </SortableList>
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

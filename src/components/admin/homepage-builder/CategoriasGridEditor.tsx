import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../lib/api';
import SeccionImageUploader from '../../ui/SeccionImageUploader';
import type { Categoria } from '../../../types/index';
import { labelCls, inputCls } from './constantes';
import { ICONOS_DEFAULT } from './defaults';
import type { CatItem } from './types';

// ── Editor visual de la grilla de categorías ─────────────────────────────────
export function CategoriasGridEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
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
          <p className="text-xs text-[var(--ink-soft)] py-2">
            Ninguna seleccionada — se mostrarán todas las categorías raíz.
          </p>
        )}
        <div className="flex flex-col gap-2 mt-1">
          {items.map((item, idx) => {
            const cat = todasCategorias.find(c => c.id === item.id);
            return (
              <div key={item.id} className="bg-[var(--n-50)] border border-[var(--line)] rounded-xl overflow-hidden">
                {/* Fila principal */}
                <div className="flex items-center gap-2 px-3 py-2">
                  {/* Preview: imagen o emoji */}
                  {item.imagen_url
                    ? <img src={item.imagen_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-[var(--line)]" />
                    : <input
                        className="w-10 h-10 text-center text-xl bg-white border border-[var(--line)] rounded-lg cursor-pointer focus:outline-none focus:border-[var(--n-400)] flex-shrink-0"
                        value={item.icono}
                        onChange={e => updateIcono(item.id, e.target.value)}
                        maxLength={4}
                        title="Emoji de respaldo (se muestra si no hay imagen)"
                      />
                  }
                  {/* Nombre categoría */}
                  <span className="flex-1 text-sm font-medium text-[var(--ink)] truncate">
                    {cat?.nombre ?? `ID ${item.id}`}
                    {cat?.padre_id && (
                      <span className="ml-1 text-[10px] text-[var(--ink-soft)] font-normal">subcategoría</span>
                    )}
                  </span>
                {/* Reordenar */}
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
                  {/* Quitar */}
                  <button onClick={() => cat && toggleCat(cat)}
                    className="w-6 h-6 flex items-center justify-center text-[var(--n-300)] hover:text-red-500 rounded transition-colors">
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-[var(--line)] rounded-lg hover:border-[var(--n-400)] hover:bg-[var(--n-50)] transition-colors">
                <Plus size={10} />
                {cat.nombre}
                {cat.padre_id && <span className="text-[var(--ink-soft)] text-[10px]">(sub)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

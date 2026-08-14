import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import SeccionImageUploader from '../../ui/SeccionImageUploader';
import { labelCls } from './constantes';
import type { ImagenLibre } from './types';

// ── Editor de imágenes libres dentro de un bloque (Fase 4) ───────────────────
// Cada imagen se guarda en datos.imagenes: {id,url,x,y,escala}[], con x/y en
// % del espacio del bloque (se arrastra dentro del recuadro de preview) y
// escala en % del ancho del bloque.
export function ImagenesEditor({ datos, set }: { datos: Record<string, any>; set: (k: string, v: any) => void }) {
  const imagenes: ImagenLibre[] = datos.imagenes ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const update = (next: ImagenLibre[]) => set('imagenes', next);
  const agregar = (url: string) => update([...imagenes, { id: crypto.randomUUID(), url, x: 50, y: 50, escala: 30 }]);
  const eliminar = (id: string) => update(imagenes.filter(i => i.id !== id));
  const updateImg = (id: string, patch: Partial<ImagenLibre>) =>
    update(imagenes.map(i => i.id === id ? { ...i, ...patch } : i));

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
      updateImg(dragId, { x, y });
    };
    const onUp = () => setDragId(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--ink-soft)]">Arrastrá las imágenes dentro del recuadro para reposicionarlas en el bloque.</p>

      <div ref={containerRef}
        className="relative w-full h-56 bg-[var(--n-100)] rounded-xl border border-dashed border-[var(--line)] overflow-hidden">
        {imagenes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--ink-soft)]">Sin imágenes todavía</div>
        )}
        {imagenes.map(img => (
          <img key={img.id} src={img.url} draggable={false}
            data-testid="imagen-libre-drag"
            onPointerDown={e => { e.preventDefault(); setDragId(img.id); }}
            className="absolute cursor-move select-none max-w-none rounded shadow"
            style={{ left: `${img.x}%`, top: `${img.y}%`, width: `${img.escala}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
          />
        ))}
      </div>

      {imagenes.map(img => (
        <div key={img.id} data-testid="imagen-libre-row" className="flex items-center gap-3 bg-[var(--n-50)] rounded-lg p-2 border border-[var(--line)]">
          <img src={img.url} className="w-10 h-10 object-cover rounded flex-shrink-0" />
          <div className="flex-1">
            <label className={labelCls}>Tamaño: {img.escala}%</label>
            <input type="range" min={5} max={100} value={img.escala}
              onChange={e => updateImg(img.id, { escala: parseInt(e.target.value) })}
              className="w-full accent-[var(--accent)]" />
          </div>
          <button onClick={() => eliminar(img.id)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-red-500 border border-[var(--line)] rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <SeccionImageUploader label="Agregar imagen" value="" onChange={url => url && agregar(url)} />
    </div>
  );
}

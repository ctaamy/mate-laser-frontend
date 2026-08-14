import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { inputCls } from './constantes';

// ── Editor genérico de lista de enlaces (label + href) ───────────────────────
// Reutilizado tanto para los links secundarios del footer como para sus
// redes sociales — misma forma de dato ({label, href}), solo cambia el
// texto de la sección y los placeholders.
export function EnlacesEditor({ titulo, enlaces, onChange, placeholderLabel, placeholderHref }: {
  titulo: string; enlaces: { label: string; href: string }[]; onChange: (v: { label: string; href: string }[]) => void;
  placeholderLabel: string; placeholderHref: string;
}) {
  const update = (idx: number, key: 'label' | 'href', val: string) =>
    onChange(enlaces.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  const agregar = () => onChange([...enlaces, { label: placeholderLabel, href: placeholderHref }]);
  const eliminar = (idx: number) => onChange(enlaces.filter((_, i) => i !== idx));
  const mover = (idx: number, dir: -1 | 1) => {
    const destino = idx + dir;
    if (destino < 0 || destino >= enlaces.length) return;
    const copia = [...enlaces];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onChange(copia);
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">{titulo}</div>
        <button onClick={agregar}
          className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
          <Plus size={12} /> Agregar
        </button>
      </div>
      {enlaces.map((enlace, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col flex-shrink-0">
            <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover arriba"
              className="w-6 h-4 flex items-center justify-center text-[var(--n-300)] hover:text-[var(--ink-soft)] disabled:opacity-20 transition-colors">
              <ChevronUp size={11} />
            </button>
            <button onClick={() => mover(i, 1)} disabled={i === enlaces.length - 1} aria-label="Mover abajo"
              className="w-6 h-4 flex items-center justify-center text-[var(--n-300)] hover:text-[var(--ink-soft)] disabled:opacity-20 transition-colors">
              <ChevronDown size={11} />
            </button>
          </div>
          <input className={inputCls} value={enlace.label} placeholder="Etiqueta"
            onChange={e => update(i, 'label', e.target.value)} />
          <input className={inputCls} value={enlace.href} placeholder="/ruta o https://..."
            onChange={e => update(i, 'href', e.target.value)} />
          <button onClick={() => eliminar(i)} aria-label="Eliminar enlace"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-red-500 border border-[var(--line)] rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

import { Plus, Trash2 } from 'lucide-react';
import { labelCls, inputCls } from './constantes';
import { ColorField } from './campos-comunes';
import type { Boton } from './types';

// ── Botones extra dentro de un bloque (Fase 3) ───────────────────────────────
// Un bloque guarda su lista de botones en datos.botones: {texto,link}[], con
// cantidad libre. Los campos legacy btn_texto/btn_link/btn2_texto/btn2_link
// (de antes de esta fase) se siguen leyendo como fallback si no hay botones.
// bg_color/texto_color propios son opcionales: vacío = hereda del bloque
// (btn_color/btn_texto_color), que a su vez hereda del tema si tampoco los define.
export function resolverBotonesLegacy(datos: Record<string, any>): Boton[] {
  if (Array.isArray(datos.botones) && datos.botones.length > 0) return datos.botones;
  const legacy: Boton[] = [];
  if (datos.btn_texto || datos.btn_link) legacy.push({ texto: datos.btn_texto || '', link: datos.btn_link || '' });
  if (datos.btn2_texto || datos.btn2_link) legacy.push({ texto: datos.btn2_texto || '', link: datos.btn2_link || '' });
  return legacy;
}

export function BotonesEditor({ botones, onChange, placeholderTexto = 'Ver colección', placeholderLink = '/productos' }: {
  botones: Boton[]; onChange: (b: Boton[]) => void; placeholderTexto?: string; placeholderLink?: string;
}) {
  const update = (i: number, k: keyof Boton, v: string) =>
    onChange(botones.map((b, idx) => idx === i ? { ...b, [k]: v } : b));
  const agregar = () => onChange([...botones, { texto: '', link: '' }]);
  const eliminar = (i: number) => onChange(botones.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className={labelCls}>Botones ({botones.length})</label>
        <button onClick={agregar} className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
          <Plus size={12} /> Agregar botón
        </button>
      </div>
      {botones.length === 0 && (
        <p className="text-xs text-[var(--ink-soft)]">Sin botones — se muestra un botón "{placeholderTexto}" por defecto.</p>
      )}
      {botones.map((boton, i) => (
        <div key={i} className="border border-[var(--line)] rounded-lg p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input className={inputCls} value={boton.texto} placeholder={i === 0 ? placeholderTexto : 'Texto del botón'}
              onChange={e => update(i, 'texto', e.target.value)} />
            <input className={inputCls} value={boton.link} placeholder={i === 0 ? placeholderLink : '/ruta'}
              onChange={e => update(i, 'link', e.target.value)} />
            <button onClick={() => eliminar(i)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[var(--ink-soft)] hover:text-red-500 border border-[var(--line)] rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 -mb-1">
            <span className="text-[13px] text-[var(--ink-soft)]">↳</span>
            <p className="text-[11px] text-[var(--ink-soft)]">Opcional — sobreescribe el color base/default del bloque solo para <strong>este botón</strong>.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Fondo de este botón (opcional)" value={boton.bg_color || ''}
              onChange={v => update(i, 'bg_color', v)} />
            <ColorField label="Texto de este botón (opcional)" value={boton.texto_color || ''}
              onChange={v => update(i, 'texto_color', v)} />
          </div>
        </div>
      ))}
    </div>
  );
}

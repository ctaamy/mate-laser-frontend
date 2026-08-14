import { useState } from 'react';
import { STAT_ICONS, STAT_ICON_NAMES } from '../../ui/StatIcons';

// ── Selector de ícono (lucide-react, lista curada) ───────────────────────────
// Compartido entre stats_barra y como_funciona — un solo componente para
// elegir ícono en vez de duplicar el picker en cada editor.
export function IconPickerButton({ value, onChange }: { value?: string; onChange: (nombre: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const IconoActual = value ? STAT_ICONS[value] : undefined;
  return (
    <div className="relative">
      <button onClick={() => setAbierto(o => !o)}
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-white border border-[var(--line)] rounded-lg hover:border-[var(--accent)] transition-colors"
        title="Elegir ícono">
        {IconoActual ? <IconoActual size={16} className="text-[var(--ink-soft)]" /> : <span className="text-[var(--n-300)] text-xs">?</span>}
      </button>
      {abierto && (
        <div className="absolute z-10 top-full left-0 mt-1 grid grid-cols-10 gap-1 bg-white border border-[var(--line)] rounded-lg p-2 shadow-lg w-[280px]">
          {STAT_ICON_NAMES.map(nombre => {
            const IconoOpcion = STAT_ICONS[nombre];
            return (
              <button key={nombre} title={nombre}
                onClick={() => { onChange(nombre); setAbierto(false); }}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${value === nombre ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--n-100)]'}`}>
                <IconoOpcion size={14} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

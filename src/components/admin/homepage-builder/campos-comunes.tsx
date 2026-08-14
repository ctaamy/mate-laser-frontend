import { AnimatePresence, motion } from 'motion/react';
import { labelCls, selectCls, inputCls, GOOGLE_FONTS } from './constantes';

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-[var(--line)] cursor-pointer p-0.5" />
        <input className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </div>
  );
}

export function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={selectCls} value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function cargarGoogleFontImpl(fontFamily: string) {
  const nombre = fontFamily.split(',')[0].trim();
  if (!GOOGLE_FONTS.includes(nombre)) return;
  const id = `gfont-${nombre.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${nombre.replace(/\s/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}
export const cargarGoogleFont = cargarGoogleFontImpl;

// ── Tabs de sección: Contenido / Estilo ──────────────────────────────────────
export function TabBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: any; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--n-100)]'}`}>
      <Icon size={12} />{label}
    </button>
  );
}

// ── Toggle reutilizable ───────────────────────────────────────────────────────
// Mensaje de feedback tras guardar/publicar/descartar — antes aparecía y
// desaparecía a los golpes (mount/unmount directo); ahora un fade + leve
// desplazamiento, igual look pero se siente más pulido.
export function FeedbackToast({ show, children, className }: { show: boolean; children: React.ReactNode; className: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }} className={className}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between bg-[var(--n-50)] rounded-lg px-4 py-3 border border-[var(--line)]">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-[var(--ink-soft)]">{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${value ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

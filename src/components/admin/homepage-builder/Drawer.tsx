import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

// ── Drawer lateral reutilizable (Fase 3 del rediseño del builder) ────────────
// Editar el contenido completo de un sub-item (ej. un slide del Hero) se
// hace acá en vez de expandido inline dentro de la card — evita que la card
// del bloque padre se vuelva gigante con todos los campos de todos los
// sub-items a la vez. Portal a document.body: la página de Configuración
// tiene varios ancestros con `motion`/transform propios (animaciones de
// alto/opacidad) que romperían un `position: fixed` normal.
export function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[101] shadow-2xl flex flex-col"
            role="dialog" aria-modal="true" aria-label={title}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)] flex-shrink-0">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
              <button onClick={onClose} aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--n-100)] hover:text-[var(--ink)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

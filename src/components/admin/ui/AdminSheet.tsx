import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Hoja de formulario para el admin: en el celu sube desde abajo (ocupa el ancho
// completo, con el botón principal siempre a mano, pegado abajo); en escritorio
// es un modal centrado, igual que AdminModal. Existe aparte porque AdminModal es
// un cuadro centrado pensado para escritorio y en 360 px deja los campos y el
// botón "Guardar" fuera de alcance del pulgar.
interface AdminSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl';
}

const MAX_W: Record<NonNullable<AdminSheetProps['maxWidth']>, string> = {
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
};

export default function AdminSheet({ open, onClose, title, children, footer, maxWidth = 'md' }: AdminSheetProps) {
  const titleId = useId();
  // `onClose` suele ser una función nueva en cada render del padre: se guarda en
  // un ref para registrar el listener y el bloqueo de scroll UNA vez por apertura.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', alTeclear);
    // La página de atrás no tiene que moverse mientras se escribe en la hoja.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = previo;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-[var(--panel)] [box-shadow:var(--shadow-hover)] md:max-h-[90dvh] md:rounded-[var(--radius-card)] ${MAX_W[maxWidth]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-[var(--ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--n-100)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--panel)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

// Modal compartido — reemplaza el
// "fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
// + backdrop-click-to-close retipeado a mano en Productos.tsx,
// CategoriasPanel.tsx y otros (ver audit Fase 5 punto 1).
interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'; // md ~28rem (formularios chicos), xl ~36rem (con tabs/imágenes)
}

const MAX_W: Record<NonNullable<AdminModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export default function AdminModal({
  open, onClose, title, children, footer, maxWidth = 'md',
}: AdminModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-[var(--panel)] rounded-[var(--radius-card)] w-full ${MAX_W[maxWidth]} max-h-[90vh] overflow-y-auto [box-shadow:var(--shadow-hover)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--panel)] flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="font-semibold text-sm text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--ink-soft)] hover:text-[var(--ink)]" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">{children}</div>

        {footer && (
          <div className="sticky bottom-0 bg-[var(--panel)] px-5 py-4 border-t border-[var(--line)] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

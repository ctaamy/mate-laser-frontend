import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, X } from 'lucide-react';
import { useToastStore } from '../../store/toast.store';

export default function ToastCarrito() {
  const { toasts, quitar } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="pointer-events-auto flex items-center gap-3 bg-black text-white px-4 py-3 shadow-2xl min-w-[240px] max-w-[320px]"
          >
            {toast.imagen
              ? <img src={toast.imagen} alt="" className="w-9 h-9 object-cover flex-shrink-0 opacity-90" />
              : <div className="w-9 h-9 flex items-center justify-center bg-white/10 flex-shrink-0">
                  <ShoppingCart size={15} />
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-0.5">Agregado al carrito</p>
              <p className="text-sm font-medium text-white truncate">{toast.mensaje}</p>
            </div>
            <button
              onClick={() => quitar(toast.id)}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-1"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

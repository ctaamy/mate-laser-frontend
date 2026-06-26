import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '../../lib/api';

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.104 1.523 5.827L.057 23.882a.5.5 0 0 0 .606.625l6.284-1.643A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.504-5.23-1.384l-.374-.22-3.882 1.015 1.034-3.777-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

export default function WhatsAppButton() {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const telefono: string = (config?.telefono_contacto || config?.whatsapp || '')
    .replace(/\D/g, '');
  const mensaje = encodeURIComponent(
    config?.whatsapp_mensaje || '¡Hola! Quiero hacer un pedido personalizado 🧉'
  );

  if (!telefono || dismissed) return null;

  const href = `https://wa.me/${telefono}?text=${mensaje}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Tooltip / mini card */}
      <AnimatePresence>
        {tooltipOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white rounded-2xl shadow-xl border border-black/[0.07] p-4 w-60 relative"
          >
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-black/25 hover:text-black/60 transition-colors"
            >
              <X size={12} />
            </button>

            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
                {WA_ICON}
              </div>
              <div>
                <p className="text-[11px] font-bold text-black leading-tight">Diseño personalizado</p>
                <p className="text-[10px] text-black/40 leading-tight">Respondemos en minutos</p>
              </div>
            </div>

            <p className="text-[11px] text-black/60 leading-relaxed mb-3">
              Coordinamos tu pedido por WhatsApp. Mandanos tu idea y te enviamos una previsualización.
            </p>

            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#25D366' }}
            >
              <span className="w-4 h-4">{WA_ICON}</span>
              Escribinos ahora
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón principal */}
      <motion.a
        href={tooltipOpen ? undefined : href}
        target={tooltipOpen ? undefined : '_blank'}
        rel="noopener noreferrer"
        onClick={e => {
          if (!tooltipOpen) return; // si tooltip cerrado, abre el link directo
          e.preventDefault();
        }}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => {}} // no cierra al salir del botón, solo con X
        className="relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer select-none"
        style={{ backgroundColor: '#25D366' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
      >
        {/* Pulso animado */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: '#25D366' }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative z-10 w-6 h-6">{WA_ICON}</span>
      </motion.a>
    </div>
  );
}

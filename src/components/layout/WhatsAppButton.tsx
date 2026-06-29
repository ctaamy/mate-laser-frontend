import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { X, ArrowRight } from 'lucide-react';
import api from '../../lib/api';

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.104 1.523 5.827L.057 23.882a.5.5 0 0 0 .606.625l6.284-1.643A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.504-5.23-1.384l-.374-.22-3.882 1.015 1.034-3.777-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

export default function WhatsAppButton() {
  const [open, setOpen] = useState(false);

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const telefono = (config?.telefono_contacto || '').replace(/\D/g, '');
  const mensaje = encodeURIComponent(
    config?.whatsapp_mensaje || '¡Hola! Quiero hacer un pedido personalizado 🧉'
  );

  if (!telefono) return null;

  const href = `https://wa.me/${telefono}?text=${mensaje}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Card emergente */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-64 bg-white border border-black/10 shadow-2xl overflow-hidden"
          >
            {/* Header negro */}
            <div className="bg-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[#25D366]">{WA_ICON}</span>
                <div>
                  <p className="text-white text-[11px] font-bold leading-tight">Pedido personalizado</p>
                  <p className="text-white/40 text-[10px] leading-tight">Respondemos rápido</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-4 py-4">
              <p className="text-[11px] text-black/60 leading-relaxed mb-4">
                Coordinamos cada diseño de forma personalizada. Mandanos tu idea y te enviamos una previsualización antes de grabar.
              </p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 bg-black text-white text-[12px] font-semibold hover:bg-[#25D366] transition-colors group"
                onClick={() => setOpen(false)}
              >
                Escribinos por WhatsApp
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón principal — forma clásica de WhatsApp */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="relative w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl"
        style={{ backgroundColor: '#25D366' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        title="Contactar por WhatsApp"
      >
        {/* Pulso */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: '#25D366' }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0, 0.35] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative z-10">
          <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.104 1.523 5.827L.057 23.882a.5.5 0 0 0 .606.625l6.284-1.643A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.504-5.23-1.384l-.374-.22-3.882 1.015 1.034-3.777-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
        </span>
      </motion.button>
    </div>
  );
}

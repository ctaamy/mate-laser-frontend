import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Phone, MapPin } from 'lucide-react';
import { useConfiguracion } from '../../hooks/useConfiguracion';

// Modal de contacto público, disparado desde el link "Contacto" del footer
// (Footer.tsx). Reusa el mismo patrón de modal ya usado en el admin
// (backdrop fixed inset-0 + motion.div centrado, ver Categorias.tsx) y la
// misma lógica de armado de link de WhatsApp que WhatsAppButton.tsx
// (wa.me/${telefono}?text=...). Estilo fijo (no hereda el tema global):
// es un overlay que se monta sobre cualquier página, no una sección del
// page builder — mismo criterio que los modales del admin.
const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.104 1.523 5.827L.057 23.882a.5.5 0 0 0 .606.625l6.284-1.643A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.504-5.23-1.384l-.374-.22-3.882 1.015 1.034-3.777-.242-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);

type Contacto = { email?: string; telefono?: string; direccion?: string };

export default function ContactoModal({ open, onClose, contacto }: { open: boolean; onClose: () => void; contacto: Contacto }) {
  const { data: config } = useConfiguracion();

  // Mismo campo/lógica que WhatsAppButton.tsx: config.telefono_contacto,
  // no contacto.telefono (que es el que se muestra como texto/tel: en el
  // footer) — son dos claves de configuración distintas.
  const telefonoWa = (config?.telefono_contacto || '').replace(/\D/g, '');
  const mensaje = encodeURIComponent(config?.whatsapp_mensaje || '¡Hola! Quiero hacer una consulta 🧉');
  const hrefWhatsapp = telefonoWa ? `https://wa.me/${telefonoWa}?text=${mensaje}` : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-sm text-gray-900">Contacto</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-sm">
              {contacto.email && (
                <a href={`mailto:${contacto.email}`} className="flex items-center gap-2.5 text-gray-700 hover:text-black transition-colors">
                  <Mail size={15} className="text-gray-400" /> {contacto.email}
                </a>
              )}
              {contacto.telefono && (
                <a href={`tel:${contacto.telefono}`} className="flex items-center gap-2.5 text-gray-700 hover:text-black transition-colors">
                  <Phone size={15} className="text-gray-400" /> {contacto.telefono}
                </a>
              )}
              {contacto.direccion && (
                <span className="flex items-center gap-2.5 text-gray-700">
                  <MapPin size={15} className="text-gray-400" /> {contacto.direccion}
                </span>
              )}

              {hrefWhatsapp && (
                <a
                  href={hrefWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors"
                  style={{ backgroundColor: '#25D366' }}
                >
                  {WA_ICON} Escribinos por WhatsApp
                </a>
              )}

              {!contacto.email && !contacto.telefono && !contacto.direccion && !hrefWhatsapp && (
                <p className="text-gray-400 text-xs">Todavía no hay datos de contacto cargados.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { TIPO_LABELS } from './defaults';
import { hayProblemaBloqueante, type ResultadoValidacionSeccion } from './validacion';
import type { TipoSeccion } from './types';

// ── Fase 5: modal-resumen antes de publicar ──────────────────────────────────
// Se muestra al hacer click en "Publicar cambios" SOLO si hay al menos un
// problema (bloqueante o warning) en alguna sección activa — ver
// validarSecciones/hayProblemaBloqueante y el uso en Configuracion.tsx. No
// reemplaza el window.confirm existente para la publicación normal: ese
// sigue corriendo después, cuando no hay ningún problema o cuando el admin
// elige "Publicar igual" con solo warnings.
//
// Modal centrado (no un panel lateral como el Drawer) — mismo patrón de
// portal a document.body + overlay, adaptado a un contenedor centrado.
export function PublicarModal({ open, resultados, onClose, onIrASeccion, onPublicarIgual }: {
  open: boolean;
  resultados: ResultadoValidacionSeccion[];
  onClose: () => void;
  onIrASeccion: (seccionId: string) => void;
  onPublicarIgual: () => void;
}) {
  const bloqueante = hayProblemaBloqueante(resultados);

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
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'tween', duration: 0.15 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col pointer-events-auto"
              role="dialog" aria-modal="true" aria-label="Revisión antes de publicar"
              data-testid="publicar-modal"
              data-bloqueante={bloqueante ? 'true' : 'false'}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)] flex-shrink-0">
                <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
                  <AlertTriangle size={16} className={bloqueante ? 'text-red-500' : 'text-amber-500'} />
                  {bloqueante ? 'No se puede publicar todavía' : 'Hay algunas cosas para revisar'}
                </h3>
                <button onClick={onClose} aria-label="Cerrar"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--n-100)] hover:text-[var(--ink)] transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 flex-1 overflow-y-auto">
                <p className="text-xs text-[var(--ink-soft)] mb-4">
                  {bloqueante
                    ? 'Estas secciones están vacías y no se van a ver en el sitio. Arreglalas antes de publicar.'
                    : 'Ninguno de estos problemas impide publicar, pero conviene revisarlos.'}
                </p>
                <ul className="flex flex-col gap-2">
                  {resultados.map(r => {
                    const tieneBloqueante = r.problemas.some(p => p.severidad === 'bloqueante');
                    return (
                      <li key={r.seccionId}>
                        <button
                          onClick={() => onIrASeccion(r.seccionId)}
                          className={`w-full text-left border rounded-lg px-3 py-2.5 flex flex-col gap-1 transition-colors hover:bg-[var(--n-50)] ${
                            tieneBloqueante ? 'border-red-200' : 'border-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                            <AlertTriangle size={13} className={tieneBloqueante ? 'text-red-500' : 'text-amber-500'} />
                            {TIPO_LABELS[r.tipo as TipoSeccion] ?? r.tipo}
                          </div>
                          <ul className="text-xs text-[var(--ink-soft)] pl-[21px] list-disc list-inside">
                            {r.problemas.map((p, i) => <li key={i}>{p.mensaje}</li>)}
                          </ul>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--line)] flex-shrink-0">
                <button onClick={onClose}
                  className="border border-[var(--line)] text-[var(--ink-soft)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--n-50)]">
                  {bloqueante ? 'Volver a editar' : 'Cancelar'}
                </button>
                {!bloqueante && (
                  <button onClick={onPublicarIgual}
                    className="bg-[var(--ink)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--n-700)]">
                    Publicar igual
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

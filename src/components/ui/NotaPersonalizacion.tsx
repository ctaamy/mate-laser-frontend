import { useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// Nota desplegable "¿Cómo funciona el grabado?" del módulo de grabado de la
// PDP (ProductoDetalle.tsx). Explica en dos oraciones qué se graba y dónde se
// escribe, sin prometer nada que el sistema no haga: hoy solo captura un texto
// libre con tope de caracteres (no hay vista previa, logos ni tipografías, y
// tampoco se sabe si el grabado suma días de entrega).
//
// Decisiones (revisadas con ux-reviewer):
// - Va FUERA del <button> del toggle: un botón dentro de otro es HTML inválido
//   y, además, abrir la nota no debe prender ni apagar el grabado.
// - Inline y no popover: en mobile no hay hover y un flotante se corta o lo
//   tapa la barra fija de "Agregar al carrito".
// - La monta ProductoDetalle solo con el toggle apagado: al activarlo, el campo
//   "Texto a grabar" ya trae su label, placeholder y contador. Cerrada por
//   defecto, sin memoria entre productos (la `key` es el id del producto) y
//   nunca se abre sola.
// - Sin ícono: el módulo ya tiene rayo + switch. Texto subrayado con contraste
//   real (el `/40` que usan otros textos chicos del módulo no pasa AA).
// - Los tests buscan `getByText('Grabado personalizado')` (substring): esa
//   frase no puede aparecer ni en el trigger ni en la nota.
export default function NotaPersonalizacion({ maxChars }: { maxChars: number }) {
  const [abierta, setAbierta] = useState(false);
  const reduceMotion = useReducedMotion();
  const idNota = useId();
  const notaRef = useRef<HTMLDivElement>(null);
  const duracion = reduceMotion ? 0 : 0.22;

  return (
    // Raíz animable: el padre la envuelve en <AnimatePresence> para que salga
    // colapsando (en sincro con el campo de texto que se expande) y no de golpe.
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: duracion }}
      className="overflow-hidden"
    >
      <div className="px-4">
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          aria-controls={abierta ? idNota : undefined}
          // min-h-11 = 44px de alto táctil. El outline va hacia adentro
          // (-outline-offset) porque la raíz tiene overflow-hidden y un anillo
          // externo quedaría recortado.
          // ml-3.5 + px-1.5 = los 20px de `pl-5` del costo: el texto queda
          // alineado con "+$X adicional" y el anillo de foco no pega en la "¿".
          className="ml-3.5 inline-flex min-h-11 items-center px-1.5 text-xs text-black/60 underline decoration-black/30 underline-offset-4 transition-colors hover:text-black hover:decoration-black focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
        >
          ¿Cómo funciona el grabado?
        </button>
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            ref={notaRef}
            id={idNota}
            role="note"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duracion }}
            // Ya expandida, si quedó tapada por la barra fija de mobile (~76px)
            // se corre lo mínimo para que se lea entera; `scroll-mb-28` deja
            // ese margen abajo. Con 'nearest', si ya se ve, no se mueve nada.
            // Solo al terminar de EXPANDIR (height 'auto'), no al colapsar.
            onAnimationComplete={(def) => {
              if ((def as { height?: unknown }).height !== 'auto') return;
              notaRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
            }}
            className="overflow-hidden scroll-mb-28"
          >
            <p className="mx-4 mb-3 bg-black/[0.04] px-3 py-2.5 text-xs leading-relaxed text-black/70">
              Grabamos con láser el texto que elijas: un nombre, una frase corta o una fecha. Activá la opción y
              escribilo en el campo que aparece (hasta {maxChars} caracteres, con espacios).
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

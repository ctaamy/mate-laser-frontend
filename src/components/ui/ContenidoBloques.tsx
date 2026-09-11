import { type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// ─────────────────────────────────────────────────────────────────────────────
// Renderer de contenido editorial por bloques — párrafos de texto (Markdown)
// y fotos interpoladas. Usado por PaginaEstatica cuando la página tiene
// `pagina_<slug>_contenido` (por ahora solo /nosotros). Candidato a
// promoverse a bloque `articulo` del page builder más adelante — por eso es
// un componente propio y no vive dentro de PaginaEstatica.
//
// Reglas de ancho (revisión ux-reviewer):
// - Todo el texto va a `max-w-3xl` (medida de lectura ~80 caracteres).
// - Foto "ancho_lectura" (default): igual ancho que el texto.
// - Foto "destacada": contenida más ancha (`max-w-6xl`), NUNCA full-bleed.
// - El epígrafe siempre se alinea a la columna de texto `max-w-3xl`, aunque
//   la foto sea más ancha — el margen izquierdo no se mueve bajando la página.
// - Mobile: una sola columna, todo al gutter. En "destacada" no hay a dónde
//   romper → se ve igual que "ancho_lectura".
//
// Markdown: react-markdown SIN rehype-raw (HTML embebido no se interpreta) —
// misma postura anti-XSS que el resto del proyecto. `#`/H1 se degrada a H2
// para que no aparezca un titular gigante a mitad de página.
// ─────────────────────────────────────────────────────────────────────────────

export interface BloqueContenido {
  id: string;
  tipo: 'parrafo' | 'imagen';
  md?: string;
  url?: string;
  url_mobile?: string;
  alt?: string;
  foco?: string;
  layout?: 'ancho_lectura' | 'destacada';
  epigrafe?: string;
}

// Espejo de FOCO_POS en HomeSecciones — copiado (no importado) para que la
// ruta /nosotros no arrastre todo el renderer del home.
const FOCO_POS: Record<string, string> = {
  centro: 'center', arriba: 'top', abajo: 'bottom', izquierda: 'left', derecha: 'right',
};

const FADE_UP = {
  hidden: { opacity: 0, y: 20 } as const,
  visible: { opacity: 1, y: 0 } as const,
};
const T = { duration: 0.6, ease: 'easeOut' as const };
const VIEWPORT = { once: true, margin: '-60px' };

export default function ContenidoBloques({ bloques, textoColor, textoSecundarioColor, fontFamily, accentColor, sinAnimacion = false }: {
  bloques: BloqueContenido[];
  textoColor: string;
  textoSecundarioColor: string;
  fontFamily?: string;
  accentColor: string;
  // El preview del admin lo pasa: dentro de un contenedor con `transform:
  // scale()` la detección de whileInView es poco fiable, y no aporta nada
  // ver la animación de entrada mientras se edita.
  sinAnimacion?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const estatico = sinAnimacion || reduceMotion;
  const entrada = estatico
    ? { initial: false as const, animate: 'visible' as const }
    : { initial: 'hidden' as const, whileInView: 'visible' as const, viewport: VIEWPORT };

  // Overrides de `prose` con las CSS vars de @tailwindcss/typography para que
  // el Markdown respete el color del tema. Mismo patrón que SeccionMediaTexto.
  const proseVars = {
    '--tw-prose-body': `${textoColor}cc`,
    '--tw-prose-headings': textoColor,
    '--tw-prose-bold': textoColor,
    '--tw-prose-links': accentColor,
    '--tw-prose-bullets': `${textoColor}80`,
    '--tw-prose-hr': `${textoColor}20`,
    '--tw-prose-quotes': `${textoColor}cc`,
    '--tw-prose-quote-borders': `${textoColor}20`,
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {bloques.map((b) => {
        if (b.tipo === 'parrafo') {
          if (!b.md?.trim()) return null;
          return (
            <motion.div
              key={b.id} {...entrada} variants={FADE_UP} transition={T}
              className="max-w-3xl mx-auto w-full px-6 prose prose-sm md:prose-base"
              style={{ ...proseVars, fontFamily }}
            >
              <ReactMarkdown components={{ h1: 'h2' }}>{b.md}</ReactMarkdown>
            </motion.div>
          );
        }

        if (!b.url) return null;
        const destacada = b.layout === 'destacada';
        const objectPosition = FOCO_POS[b.foco || 'centro'] || 'center';
        return (
          <motion.figure
            key={b.id} {...entrada} variants={FADE_UP} transition={T}
            className="w-full m-0"
          >
            <div className={`mx-auto w-full px-6 ${destacada ? 'max-w-6xl' : 'max-w-3xl'}`}>
              <div className="overflow-hidden rounded-xl">
                <picture>
                  {b.url_mobile && <source media="(max-width: 639px)" srcSet={b.url_mobile} />}
                  <img
                    src={b.url} alt={b.alt || ''} loading="lazy"
                    className="w-full object-cover block"
                    style={{ maxHeight: destacada ? 540 : 440, objectPosition }}
                  />
                </picture>
              </div>
            </div>
            {b.epigrafe?.trim() && (
              <figcaption
                className="max-w-3xl mx-auto w-full px-6 mt-3 text-xs md:text-sm italic"
                style={{ color: textoSecundarioColor, fontFamily }}
              >
                {b.epigrafe}
              </figcaption>
            )}
          </motion.figure>
        );
      })}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { TemaGlobal } from '../../hooks/useThemeGlobal';
import {
  estiloHeredado, heredaDeBloque, resolverBotones, paddingVertical,
  HeroImg, FOCO_POS, FADE_UP, STAGGER, T, VIEWPORT,
} from './HomeSecciones';

// ─────────────────────────────────────────────────────────────────────────────
// media_texto — carrusel de imágenes de un lado + columna de texto del otro
// (eyebrow / título / subtítulo / cuerpo en Markdown / botones). Bloque
// genérico y reutilizable; primer uso: la franja "Nosotros / El Taller" del
// home, con el botón hacia /nosotros.
//
// Se carga con React.lazy desde el dispatcher de HomeSecciones para no meter
// react-markdown (~40 KB) en el bundle eager del home cuando no hay ningún
// bloque de este tipo. Reusa primitivas de HomeSecciones (HeroImg, FOCO_POS,
// resolverBotones, la cadena de herencia de estilo) — el carrusel es una
// copia lean, NO un refactor del hero (que está clavado por ~9 specs).
//
// Decisiones (revisión arquitecto / ux-reviewer / cm-marketing, 2026-09-10):
// - Mobile: SIEMPRE texto primero, sin toggle (el preview del editor es
//   desktop 1280px fijo — un ajuste "solo mobile" sería a ciegas).
// - Autoplay OFF por defecto; se respeta prefers-reduced-motion.
// - Sin contador "01/03" ni barra de progreso (son del hero). Dots + swipe +
//   flechas solo desktop.
// - Sin botón por defecto: es un bloque de contenido, no un CTA — si no hay
//   botones configurados no se renderiza nada.
// ─────────────────────────────────────────────────────────────────────────────

interface SlideMedia {
  imagen_url?: string;
  imagen_url_mobile?: string;
  imagen_foco?: string;
  alt?: string;
}

function justifyDe(alineacion?: string): string {
  return alineacion === 'center' ? 'center' : alineacion === 'right' ? 'flex-end' : 'flex-start';
}

// ── Carrusel (copia lean) ────────────────────────────────────────────────────
function CarruselImagenes({ slides, intervalo, autoplay, tc }: {
  slides: SlideMedia[]; intervalo: number; autoplay: boolean; tc: string;
}) {
  const reduceMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  const go = useCallback((idx: number) => setCurrent((idx + total) % total), [total]);
  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = () => go(current - 1);

  useEffect(() => {
    if (total <= 1 || !autoplay || paused || reduceMotion) return;
    const t = setInterval(next, Math.max(2, intervalo) * 1000);
    return () => clearInterval(t);
  }, [total, autoplay, paused, reduceMotion, next, intervalo]);

  // Swipe táctil / drag — el único gesto que suma sobre el hero (un strip de
  // fotos a mitad de página que no se puede deslizar se siente roto en celular).
  const startX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) <= 40) return;
    if (dx < 0) next(); else prev();
  };

  // `current` puede quedar fuera de rango si el admin quita imágenes — se
  // clampea al leer, sin un efecto extra que dispare re-render.
  const idx = Math.min(current, total - 1);
  const slide = slides[idx];
  const foco = FOCO_POS[slide.imagen_foco || 'centro'] || 'center';

  return (
    <div
      className="relative w-full aspect-[4/3] md:aspect-auto md:min-h-[320px] overflow-hidden rounded-xl select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={idx}
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeInOut' }}
        >
          <HeroImg desktop={slide.imagen_url} mobile={slide.imagen_url_mobile} objectPosition={foco} alt={slide.alt || ''} />
        </motion.div>
      </AnimatePresence>

      {total > 1 && (
        <>
          {[
            { fn: prev, Icon: ChevronLeft, side: 'left-3', label: 'Imagen anterior' },
            { fn: next, Icon: ChevronRight, side: 'right-3', label: 'Imagen siguiente' },
          ].map(({ fn, Icon, side, label }) => (
            <button key={side} type="button" onClick={fn} aria-label={label}
              className={`hidden sm:flex absolute ${side} top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full transition-opacity hover:opacity-80`}
              style={{ backgroundColor: `${tc}1f`, color: tc, backdropFilter: 'blur(6px)' }}>
              <Icon size={16} />
            </button>
          ))}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button key={i} type="button" onClick={() => go(i)} aria-label={`Ir a la imagen ${i + 1}`}
                className="rounded-full transition-all duration-300"
                style={{ width: i === idx ? 18 : 6, height: 6, backgroundColor: i === idx ? tc : `${tc}55` }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Bloque ───────────────────────────────────────────────────────────────────
export default function SeccionMediaTexto({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const reduceMotion = useReducedMotion();
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const accentColor = datos.accent_color || tema.accent_color;

  // Animación de entrada — se salta con prefers-reduced-motion (render
  // directo en estado final). `initial={false}` + animate="visible" hace que
  // los hijos con variants={FADE_UP} aparezcan ya visibles, sin stagger.
  const entrada = reduceMotion
    ? { initial: false as const, animate: 'visible' }
    : { initial: 'hidden', whileInView: 'visible', viewport: VIEWPORT };

  const slides: SlideMedia[] = (datos.slides ?? []).filter((s: SlideMedia) => !!s?.imagen_url);
  const botones = resolverBotones(datos); // sin fallback — bloque de contenido, no CTA
  const tieneTexto = !!(datos.eyebrow || datos.titulo || datos.subtitulo || datos.cuerpo_md || botones.length);

  // Sin nada que mostrar → no renderiza (estilo de la casa: nunca un
  // contenido default inventado).
  if (slides.length === 0 && !tieneTexto) return null;

  const mediaSide = datos.media_side === 'right' ? 'right' : 'left';
  const padding = paddingVertical(datos.padding, [4, 5], 'md');
  const textAlign: CSSProperties['textAlign'] = datos.alineacion || undefined;
  const justifyBotones = justifyDe(datos.alineacion);

  const titulo = heredaDeBloque({ texto_color: datos.titulo_color }, { bg, tc, fontFamily });
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color }, { bg, tc, fontFamily });
  const eyebrow = heredaDeBloque({ texto_color: datos.eyebrow_color }, { bg, tc, fontFamily });

  const defaultsBotonPrimario = { bg: datos.btn_color || tc, tc: datos.btn_texto_color || bg, fontFamily };
  const defaultsBotonSecundario = { bg: tc, tc, fontFamily };

  // Overrides de `prose` con las CSS vars de @tailwindcss/typography, para que
  // el Markdown respete el color de texto del bloque (bg/tc propios) en vez
  // del gris fijo del plugin. Mismo patrón alpha-hex-sobre-tc que todo
  // HomeSecciones.
  const proseVars = {
    '--tw-prose-body': `${tc}cc`,
    '--tw-prose-headings': tc,
    '--tw-prose-bold': tc,
    '--tw-prose-links': accentColor,
    '--tw-prose-bullets': `${tc}80`,
    '--tw-prose-counters': `${tc}99`,
    '--tw-prose-hr': `${tc}20`,
    '--tw-prose-quotes': `${tc}cc`,
    '--tw-prose-quote-borders': `${tc}20`,
  } as CSSProperties;

  const hayImagenes = slides.length > 0;

  const columnaTexto = (
    <motion.div
      className={`w-full flex flex-col justify-center px-6 md:px-10 py-10 md:py-14 ${hayImagenes ? 'md:w-1/2' : 'md:max-w-3xl md:mx-auto'}`}
      style={{ textAlign }}
      {...entrada} variants={STAGGER}
    >
      {!!datos.eyebrow && (
        <motion.p variants={FADE_UP} transition={T}
          className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: eyebrow.tc, fontFamily: eyebrow.fontFamily }}>
          {datos.eyebrow}
        </motion.p>
      )}

      {!!datos.titulo && (
        <motion.h2 variants={FADE_UP} transition={T}
          className="text-2xl md:text-3xl font-bold tracking-tight leading-tight"
          style={{ color: titulo.tc, fontFamily: titulo.fontFamily, marginBottom: datos.subtitulo || datos.cuerpo_md ? '0.75rem' : botones.length ? '1.5rem' : 0 }}>
          {datos.titulo}
        </motion.h2>
      )}

      {!!datos.subtitulo && (
        <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.05 }}
          className="text-sm md:text-base leading-relaxed"
          style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily, marginBottom: datos.cuerpo_md || botones.length ? '1rem' : 0 }}>
          {datos.subtitulo}
        </motion.p>
      )}

      {!!datos.cuerpo_md && (
        <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.1 }}
          className="prose prose-sm max-w-none"
          style={{ ...proseVars, fontFamily, marginBottom: botones.length ? '1.5rem' : 0 }}>
          <ReactMarkdown>{datos.cuerpo_md}</ReactMarkdown>
        </motion.div>
      )}

      {botones.length > 0 && (
        <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3" style={{ justifyContent: justifyBotones }}>
          {botones.map((boton, bi) => {
            const esPrimario = bi === 0;
            const r = heredaDeBloque(boton, esPrimario ? defaultsBotonPrimario : defaultsBotonSecundario);
            const tieneOverridePropio = !!boton.texto_color;
            return esPrimario ? (
              <Link key={bi} to={boton.link || '/'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: r.bg, color: r.tc, fontFamily: r.fontFamily }}>
                {boton.texto} <ArrowRight size={14} />
              </Link>
            ) : (
              <Link key={bi} to={boton.link || '/'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium border transition-opacity hover:opacity-60"
                style={{
                  borderColor: tieneOverridePropio ? r.tc : `${r.tc}25`,
                  color: tieneOverridePropio ? r.tc : `${r.tc}b0`,
                  fontFamily: r.fontFamily,
                }}>
                {boton.texto}
              </Link>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <section className="w-full" style={{ backgroundColor: bg, color: tc, fontFamily, minHeight, ...padding }}>
      <div className={`max-w-6xl mx-auto w-full flex flex-col ${mediaSide === 'left' ? 'md:flex-row-reverse' : 'md:flex-row'} md:items-stretch`}>
        {columnaTexto}
        {hayImagenes && (
          <div className="w-full md:w-1/2 px-6 md:px-10 py-6 md:py-14 flex">
            <CarruselImagenes
              slides={slides}
              intervalo={datos.intervalo ?? 5}
              autoplay={datos.autoplay === true}
              tc={tc}
            />
          </div>
        )}
      </div>
    </section>
  );
}

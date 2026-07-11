import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { useCarritoStore } from '../../store/carrito.store';
import { useToastStore } from '../../store/toast.store';
import type { Producto, Categoria } from '../../types/index';
import ProductGrid from '../ui/ProductGrid';
import type { TemaGlobal } from '../../hooks/useThemeGlobal';

// Todo el motor de renderizado de las secciones del homepage (hero, banners,
// stats, etc.) vive acá — lo comparten la página pública (Home.tsx, que
// siempre pinta el PUBLICADO) y el preview en vivo del editor admin
// (Configuracion.tsx, que pinta el BORRADOR sin necesidad de guardar antes).

// Resuelve el estilo efectivo de un bloque: si no define su propio
// bg_color/texto_color/font_family, hereda del tema global. min_height es
// el resize del bloque (Fase 2) — 'auto' o vacío = altura natural.
function estiloHeredado(datos: Record<string, any>, tema: TemaGlobal) {
  return {
    bg: datos.bg_color || tema.bg_color,
    tc: datos.texto_color || tema.texto_color,
    fontFamily: datos.font_family || tema.font_family || undefined,
    minHeight: datos.min_height && datos.min_height !== 'auto' ? `${datos.min_height}px` : undefined,
  };
}

// ── Bugfix: campos de EditorEstilo que no impactaban el render ──────────────
// padding/alineación/titulo_size/etc se guardaban pero nunca se leían acá.
// Para no romper el aspecto de secciones ya existentes (varias traen estos
// campos precargados por TIPO_DEFAULTS, ej. padding:'md'), se escala en
// forma RELATIVA a la opción que ya representaba el diseño actual, así que
// dejar el valor "de siempre" no cambia nada y elegir otro sí tiene efecto.
const ESCALA_TAMANO: Record<string, number> = {
  xs: 0.55, sm: 0.7, base: 0.85, lg: 1, xl: 1.15, '2xl': 1.3, '3xl': 1.5, '4xl': 1.75,
};
function escalaTamano(valor: string | undefined, opcionBase = 'lg'): number {
  if (!valor) return 1;
  return (ESCALA_TAMANO[valor] ?? 1) / (ESCALA_TAMANO[opcionBase] ?? 1);
}

const SIZE_REM: Record<string, string> = {
  xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem',
  '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
};

const PESO_NUM: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };

const ESCALA_PADDING: Record<string, number> = { xs: 0.4, sm: 0.7, md: 1, lg: 1.35, xl: 1.7 };
function paddingVertical(padding: string | undefined, remBase: [number, number], opcionBase = 'md'): { paddingTop?: string; paddingBottom?: string } {
  if (!padding) return {};
  const factor = (ESCALA_PADDING[padding] ?? 1) / (ESCALA_PADDING[opcionBase] ?? 1);
  return { paddingTop: `${remBase[0] * factor}rem`, paddingBottom: `${remBase[1] * factor}rem` };
}

// Clases literales (no template dinámico) para que Tailwind las genere.
const COL_CLASS: Record<number, string> = {
  2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5',
};

function justifyDeAlineacion(alineacion?: string): string | undefined {
  if (!alineacion) return undefined;
  return alineacion === 'center' ? 'center' : alineacion === 'right' ? 'flex-end' : 'flex-start';
}

// ── Herencia genérica: Tema → Bloque → Elemento (título/subtítulo/botón) ────
// Un solo mecanismo para toda la cadena: si el elemento no define su propio
// bg_color/texto_color/font_family, hereda del bloque (que a su vez ya
// resolvió su propia herencia del tema en estiloHeredado). Nada de defaults
// alfa-blend por tipo de bloque — siempre el mismo cálculo.
interface EstiloBloque { bg: string; tc: string; fontFamily?: string }
interface EstiloPropio { bg_color?: string; texto_color?: string; font_family?: string }
function heredaDeBloque(propio: EstiloPropio | undefined, bloque: EstiloBloque) {
  return {
    bg: propio?.bg_color || bloque.bg,
    tc: propio?.texto_color || bloque.tc,
    fontFamily: propio?.font_family || bloque.fontFamily,
  };
}

// Botones extra dentro de un bloque (Fase 3). Un bloque puede definir
// datos.botones: {texto, link}[] con cualquier cantidad de botones. Si no
// lo define, se sintetizan desde los campos legacy btn_texto/btn_link +
// btn2_texto/btn2_link (compat con secciones creadas antes de esta fase).
interface Boton extends EstiloPropio { texto: string; link: string }

function resolverBotones(datos: Record<string, any>): Boton[] {
  if (Array.isArray(datos.botones) && datos.botones.length > 0) return datos.botones;
  const legacy: Boton[] = [];
  if (datos.btn_texto && datos.btn_link) legacy.push({ texto: datos.btn_texto, link: datos.btn_link });
  if (datos.btn2_texto && datos.btn2_link) legacy.push({ texto: datos.btn2_texto, link: datos.btn2_link });
  return legacy;
}

// ── tipado ────────────────────────────────────────────────────────────────────
export interface Seccion {
  id: string; tipo: string; activo: boolean; orden: number; datos: Record<string, any>;
}

// ── animaciones — solo opacity + y, limpio ────────────────────────────────────
const FADE_UP = {
  hidden: { opacity: 0, y: 20 } as const,
  visible: { opacity: 1, y: 0 } as const,
};
const FADE = {
  hidden: { opacity: 0 } as const,
  visible: { opacity: 1 } as const,
};
const STAGGER = { visible: { transition: { staggerChildren: 0.1, delayChildren: 0.04 } } };
const T = { duration: 0.6, ease: 'easeOut' as const };
const VIEWPORT = { once: true, margin: '-60px' };

// ── Google Fonts ──────────────────────────────────────────────────────────────
const GOOGLE_FONTS = ['Poppins','Montserrat','Lato','Raleway','Oswald','Playfair Display','Merriweather','Nunito'];
export function useFonts(secciones: Seccion[]) {
  useEffect(() => {
    secciones.forEach(s => {
      const ff = s.datos?.font_family;
      if (!ff) return;
      const nombre = ff.split(',')[0].trim();
      if (!GOOGLE_FONTS.includes(nombre)) return;
      const id = `gfont-${nombre.replace(/\s/g, '-')}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${nombre.replace(/\s/g,'+')}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    });
  }, [secciones]);
}

// ── count-up ──────────────────────────────────────────────────────────────────
function useCountUp(target: string, inView: boolean) {
  const numStr = target.replace(/[^0-9.]/g, '');
  const suffix = target.replace(/[0-9.]/g, '');
  const num = parseFloat(numStr) || 0;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView || num === 0) return;
    const duration = 1400;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - t, 3)) * num));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, num]);
  return num === 0 ? target : `${count}${suffix}`;
}

// ── Label de sección ──────────────────────────────────────────────────────────
function SectionLabel({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <motion.p
      variants={FADE_UP} transition={T}
      className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
      style={{ color: light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}
    >
      {children}
    </motion.p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO — slider
// ─────────────────────────────────────────────────────────────────────────────
interface HeroSlide {
  titulo: string; subtitulo?: string; eyebrow?: string; imagen_url?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  botones?: Boton[];
  bg_color?: string; texto_color?: string;
}

// Overlay configurable sobre la imagen del hero — reemplaza por completo el
// blend lateral hardcodeado y el viejo par overlay_color/overlay_opacidad.
// Siempre usa el color base resuelto del bloque (bg), nunca un color propio:
// "direction" define la forma, "intensity" la opacidad máxima en el punto
// más fuerte del degradé (o la opacidad uniforme en el modo "full").
function HeroOverlay({ direction, intensity, bg }: { direction: string; intensity: number; bg: string }) {
  if (direction === 'none') return null;
  const opacity = Math.max(0, Math.min(100, intensity)) / 100;
  let background: string;
  switch (direction) {
    case 'right': background = `linear-gradient(to left, ${bg}, transparent)`; break;
    case 'top': background = `linear-gradient(to bottom, ${bg}, transparent)`; break;
    case 'bottom': background = `linear-gradient(to top, ${bg}, transparent)`; break;
    case 'radial': background = `radial-gradient(circle at center, ${bg} 0%, transparent 70%)`; break;
    case 'full': background = bg; break;
    case 'left':
    default: background = `linear-gradient(to right, ${bg}, transparent)`; break;
  }
  return <div className="absolute inset-0 pointer-events-none" style={{ background, opacity }} />;
}

// Migración de compatibilidad: heroes creados antes de overlay_direction
// solo tenían el blend lateral izquierdo hardcodeado (siempre activo) y,
// opcionalmente, overlay_color/overlay_opacidad como capa uniforme. Sin
// overlay_direction en datos, se reconstruye el efecto visual equivalente
// más cercano dentro del nuevo sistema, para que un Hero ya publicado no
// cambie de aspecto por esta reconstrucción.
function resolverOverlay(datos: Record<string, any>): { direction: string; intensity: number } {
  if (datos.overlay_direction) {
    return { direction: datos.overlay_direction, intensity: datos.overlay_intensity ?? 60 };
  }
  if (datos.overlay_color) {
    return { direction: 'full', intensity: datos.overlay_opacidad ?? 40 };
  }
  return { direction: 'left', intensity: 60 };
}

function HeroSlideContent({ slide, dir, bloque, datos }: {
  slide: HeroSlide; dir: number; bloque: EstiloBloque; datos: Record<string, any>;
}) {
  // Herencia: Slide → Bloque → Tema (mismo mecanismo heredaDeBloque que el
  // resto de la cadena; "bloque" ya resolvió su propia herencia del tema).
  const { bg, tc, fontFamily } = heredaDeBloque(slide, bloque);
  const titulo = slide.titulo || 'Mates únicos,\nhechos a tu medida';
  const lineas = titulo.split('\n');
  const tieneImagen = !!slide.imagen_url;
  const botonesResueltos = resolverBotones(slide);
  const botones = botonesResueltos.length ? botonesResueltos : [{ texto: 'Ver colección', link: '/productos' }];
  const imagePosition = datos.image_position || 'bleed';
  const overlay = resolverOverlay(datos);

  // Tipografía por elemento (eyebrow/título/subtítulo), configurable desde
  // el bloque y siempre resuelta con heredaDeBloque — el color por defecto
  // es SIEMPRE el texto primario del bloque (tc, ya heredado del tema); un
  // look más sutil se logra eligiendo texto_secundario_color a propósito,
  // nunca aplicando opacidad al elemento.
  const escalaTitulo = escalaTamano(datos.titulo_size);
  const tituloFontSize = `clamp(${2.4 * escalaTitulo}rem, ${5 * escalaTitulo}vw, ${4.5 * escalaTitulo}rem)`;
  const subtituloFontSize = datos.subtitulo_size ? SIZE_REM[datos.subtitulo_size] : undefined;
  const eyebrowFontSize = datos.eyebrow_size ? SIZE_REM[datos.eyebrow_size] : undefined;
  const titulo_ = heredaDeBloque({ texto_color: datos.titulo_color, font_family: datos.titulo_font_family }, { bg, tc, fontFamily });
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  const eyebrow = heredaDeBloque({ texto_color: datos.eyebrow_color, font_family: datos.eyebrow_font_family }, { bg, tc, fontFamily });
  const tituloFontWeight = datos.titulo_font_weight ? PESO_NUM[datos.titulo_font_weight] : 700;
  const subtituloFontWeight = datos.subtitulo_font_weight ? PESO_NUM[datos.subtitulo_font_weight] : undefined;
  const eyebrowFontWeight = datos.eyebrow_font_weight ? PESO_NUM[datos.eyebrow_font_weight] : 600;

  // Botones: cada uno hereda Botón → Bloque (btn_color/btn_texto_color) →
  // Tema (ya resuelto en bg/tc). El primero es el CTA sólido; el resto son
  // secundarios en outline con el texto_color del bloque como base.
  const defaultsBotonPrimario = { bg: datos.btn_color || tc, tc: datos.btn_texto_color || bg, fontFamily };
  const defaultsBotonSecundario = { bg: tc, tc, fontFamily };

  const enter = { opacity: 0, x: dir > 0 ? 48 : -48 };
  const exit  = { opacity: 0, x: dir > 0 ? -48 : 48 };

  const esBackground = imagePosition === 'background' && tieneImagen;

  const textoColumna = (
    <motion.div
      className={`flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20 ${esBackground ? 'relative z-10' : ''}`}
      style={{ textAlign: datos.alineacion || undefined }}
      initial="hidden" animate="visible" variants={STAGGER}
    >
      {!!slide.eyebrow && (
        <motion.p variants={FADE_UP} transition={T}
          className="text-[10px] uppercase tracking-[0.18em] mb-4"
          style={{ color: eyebrow.tc, fontFamily: eyebrow.fontFamily, fontWeight: eyebrowFontWeight, fontSize: eyebrowFontSize }}>
          {slide.eyebrow}
        </motion.p>
      )}

      <h1 className="leading-[1.04] tracking-tight mb-6"
        style={{ fontSize: tituloFontSize, fontWeight: tituloFontWeight, fontFamily: titulo_.fontFamily }}>
        {lineas.map((linea, li) => (
          <motion.span key={li} className="block" variants={FADE_UP}
            transition={{ ...T, delay: li * 0.1 }}
            style={{ color: titulo_.tc }}>
            {linea}
          </motion.span>
        ))}
      </h1>

      <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.2 }}
        className="leading-relaxed mb-10 max-w-xs"
        style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily, fontWeight: subtituloFontWeight, fontSize: subtituloFontSize }}>
        {slide.subtitulo || 'Personalizamos cada pieza con tu diseño.'}
      </motion.p>

      <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.3 }}
        className="flex flex-wrap gap-3" style={{ justifyContent: justifyDeAlineacion(datos.alineacion) }}>
        {botones.map((boton, bi) => {
          const esPrimario = bi === 0;
          const r = heredaDeBloque(boton, esPrimario ? defaultsBotonPrimario : defaultsBotonSecundario);
          const tieneOverridePropio = !!boton.texto_color;
          return esPrimario ? (
            <Link key={bi} to={boton.link || '/productos'}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: r.bg, color: r.tc, fontFamily: r.fontFamily }}>
              {boton.texto || 'Ver colección'} <ArrowRight size={14} />
            </Link>
          ) : (
            <Link key={bi} to={boton.link || '/'}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium border transition-opacity hover:opacity-60"
              style={{
                borderColor: tieneOverridePropio ? r.tc : `${r.tc}25`,
                color: tieneOverridePropio ? r.tc : `${r.tc}70`,
                fontFamily: r.fontFamily,
              }}>
              {boton.texto}
            </Link>
          );
        })}
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div
      className={`absolute inset-0 flex overflow-hidden ${esBackground ? 'flex-col' : 'flex-col md:flex-row'}`}
      style={{ backgroundColor: bg, color: tc, fontFamily }}
      initial={enter} animate={{ opacity: 1, x: 0 }} exit={exit}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
    >
      {esBackground ? (
        <>
          <motion.img
            key={slide.imagen_url}
            src={slide.imagen_url} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.05 }} animate={{ scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <HeroOverlay direction={overlay.direction} intensity={overlay.intensity} bg={bg} />
          {textoColumna}
        </>
      ) : (
        <>
          {textoColumna}

          {tieneImagen && (
            <div className={
              imagePosition === 'contained'
                ? 'relative md:w-[52%] max-h-[38vh] md:max-h-none md:min-h-full overflow-hidden flex-shrink-0 m-4 md:my-6 md:mr-6 rounded-xl shadow-sm'
                : 'relative md:w-[52%] max-h-[38vh] md:max-h-none md:min-h-full overflow-hidden flex-shrink-0'
            }>
              <motion.img
                key={slide.imagen_url}
                src={slide.imagen_url} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1.05 }} animate={{ scale: 1 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <HeroOverlay direction={overlay.direction} intensity={overlay.intensity} bg={bg} />
            </div>
          )}

          {/* Sin imagen: gran número decorativo */}
          {!tieneImagen && (
            <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:flex items-center justify-end pr-16 pointer-events-none select-none overflow-hidden">
              <span className="text-[18rem] font-black leading-none"
                style={{ color: `${tc}06`, letterSpacing: '-0.06em' }}>01</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function SeccionHero({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const slides: HeroSlide[] = datos.slides?.length
    ? datos.slides
    : [{ titulo: datos.titulo, subtitulo: datos.subtitulo, imagen_url: datos.imagen_url,
         btn_texto: datos.btn_texto, btn_link: datos.btn_link,
         btn2_texto: datos.btn2_texto, btn2_link: datos.btn2_link,
         bg_color: datos.bg_color, texto_color: datos.texto_color }];
  // Herencia: Slide → Bloque → Tema. "bloque" es el nivel intermedio que
  // antes faltaba (el slide saltaba directo al tema) — mismo estiloHeredado
  // que usa el resto de los tipos de sección.
  const bloque = estiloHeredado(datos, tema);
  const minHeight = datos.min_height && datos.min_height !== 'auto' ? `${datos.min_height}px` : '90vh';

  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const ms = (datos.intervalo ?? 5) * 1000;
  const total = slides.length;

  const goTo = useCallback((idx: number, d?: number) => {
    setDir(d ?? (idx > current ? 1 : -1));
    setCurrent(idx);
  }, [current]);

  const next = useCallback(() => goTo((current + 1) % total, 1), [current, goTo, total]);
  const prev = () => goTo((current - 1 + total) % total, -1);

  useEffect(() => {
    if (total <= 1 || paused) return;
    const t = setInterval(next, ms);
    return () => clearInterval(t);
  }, [total, paused, next, ms]);

  useEffect(() => {
    if (current >= total) setCurrent(0);
  }, [total, current]);

  const tc = slides[Math.min(current, total - 1)]?.texto_color || bloque.tc;

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      <AnimatePresence mode="sync">
        <HeroSlideContent key={current} slide={slides[Math.min(current, total - 1)]} dir={dir} bloque={bloque} datos={datos} />
      </AnimatePresence>

      {total > 1 && (
        <>
          {/* Flechas */}
          {[
            { fn: prev, Icon: ChevronLeft, side: 'left-5' },
            { fn: next, Icon: ChevronRight, side: 'right-5' },
          ].map(({ fn, Icon, side }) => (
            <button key={side} onClick={fn}
              className={`absolute ${side} top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center border transition-all`}
              style={{ borderColor: `${tc}25`, color: tc, backgroundColor: `${tc}08`, backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${tc}18`)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${tc}08`)}
            >
              <Icon size={16} />
            </button>
          ))}

          {/* Dots */}
          <div className="absolute bottom-8 left-8 z-20 flex items-center gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i === current ? 20 : 5, height: 5,
                  backgroundColor: i === current ? tc : `${tc}40` }} />
            ))}
          </div>

          {/* Progreso */}
          {!paused && (
            <div className="absolute bottom-0 left-0 right-0 h-px z-20" style={{ backgroundColor: `${tc}18` }}>
              <motion.div key={`${current}-p`} className="h-full"
                style={{ backgroundColor: `${tc}50` }}
                initial={{ width: '0%' }} animate={{ width: '100%' }}
                transition={{ duration: ms / 1000, ease: 'linear' }} />
            </div>
          )}

          {/* Número de slide */}
          <div className="absolute bottom-8 right-8 z-20 font-mono text-[11px]"
            style={{ color: `${tc}35` }}>
            {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BANNER TEXTO
// ─────────────────────────────────────────────────────────────────────────────
function SeccionBannerTexto({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const texto = datos.texto || '';
  // Bugfix: font_size/font_weight/padding se guardaban pero nunca se leían.
  // Anclado en 'sm' (11px) porque ese es el valor con el que ya nacían las
  // secciones existentes (TIPO_DEFAULTS) — así no cambia nada por defecto.
  const fontSize = datos.font_size ? `${0.6875 * escalaTamano(datos.font_size, 'sm')}rem` : undefined;
  const fontWeight = datos.font_weight ? PESO_NUM[datos.font_weight] : undefined;
  const padding = paddingVertical(datos.padding, [1.25, 1.25], 'sm');
  const justifyContent = justifyDeAlineacion(datos.alineacion) || 'center';

  if (datos.marquee) {
    return (
      <div className="w-full overflow-hidden py-2.5 border-y flex items-center"
        style={{ backgroundColor: bg, borderColor: `${tc}12`, fontFamily, minHeight }}>
        <motion.div className="flex whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}>
          {[...Array(12)].map((_, i) => (
            <span key={i} className="flex items-center text-[11px] tracking-widest uppercase px-8"
              style={{ color: `${tc}60`, fontSize, fontWeight: fontWeight ?? 500 }}>
              {texto}
              <span className="mx-8" style={{ color: `${tc}20` }}>—</span>
            </span>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.section className="w-full px-8 py-5 flex items-center"
      style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}
      initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={FADE}>
      <div className="max-w-6xl flex items-center gap-6" style={{ justifyContent }}>
        <div className="h-px flex-1" style={{ backgroundColor: tc, opacity: 0.1 }} />
        <p className="text-[11px] uppercase tracking-[0.2em] text-center"
          style={{ color: tc, opacity: 0.5, fontSize, fontWeight: fontWeight ?? 600 }}>
          {texto}
        </p>
        <div className="h-px flex-1" style={{ backgroundColor: tc, opacity: 0.1 }} />
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATS
// ─────────────────────────────────────────────────────────────────────────────
function StatItem({ valor, label, tc, borderClass }: { valor: string; label: string; tc: string; borderClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const display = useCountUp(valor, inView);
  return (
    <div ref={ref} className={`flex flex-col items-start px-8 py-8 border-b border-r last:border-r-0 md:border-b-0 ${borderClass}`}>
      <motion.span className="text-4xl md:text-5xl font-bold tracking-tight mb-2"
        style={{ color: tc }}
        initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={T}>
        {display}
      </motion.span>
      <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: `${tc}66` }}>{label}</span>
    </div>
  );
}

function SeccionStatsBarra({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const stats: { valor: string; label: string }[] = datos.stats ?? [
    { valor: '1200+', label: 'Mates entregados' },
    { valor: '98%', label: 'Clientes satisfechos' },
    { valor: '48hs', label: 'Tiempo de entrega' },
    { valor: '5★', label: 'Calificación' },
  ];

  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  // El fondo determina si el borde/línea divisoria queda clara u oscura
  // (contraste contra bg); el color de TEXTO ya no depende de esto — usa
  // siempre texto_color heredado (bugfix: antes hardcodeaba text-white/black).
  const bgEsClaro = bg === '#ffffff' || bg === '#f9f9f9' || bg === '#f8f8f8';
  const borderClass = bgEsClaro ? 'border-black/[0.06]' : 'border-white/[0.07]';
  // No tenía padding de sección históricamente (el alto venía solo del
  // padding de cada item) — se aplica solo si el admin lo configuró.
  const padding = paddingVertical(datos.padding, [2, 2], 'md');

  return (
    <section className={`w-full border-y ${bgEsClaro ? 'border-black/[0.05]' : 'border-white/10'} flex items-center`}
      style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 w-full">
        {stats.map((s, i) => <StatItem key={i} valor={s.valor} label={s.label} tc={tc} borderClass={borderClass} />)}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CATEGORÍAS GRID
// ─────────────────────────────────────────────────────────────────────────────
const ICONOS_FALLBACK = ['☕','🍃','✨','🎁','⚡','🪵','🔥','💫','🧉','🪄','🎨','📦'];
interface CatItem { id: number; icono: string; imagen_url?: string }

function SeccionCategoriasGrid({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { data: todasCategorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  const todasPlanas: Categoria[] = [];
  todasCategorias.forEach(c => {
    todasPlanas.push(c);
    ((c as any).other_categorias ?? []).forEach((h: Categoria) => todasPlanas.push(h));
  });

  const items: CatItem[] = datos.categorias_items ?? [];
  const idsFallback: number[] = datos.categorias_ids ?? [];
  type Entry = { cat: Categoria; icono: string; imagen_url?: string };

  let entries: Entry[];
  if (items.length > 0) {
    entries = items.map((item, i) => ({
      cat: todasPlanas.find(c => c.id === item.id)!,
      icono: item.icono || ICONOS_FALLBACK[i % ICONOS_FALLBACK.length],
      imagen_url: item.imagen_url,
    })).filter(e => !!e.cat);
  } else if (idsFallback.length > 0) {
    entries = todasCategorias.filter(c => idsFallback.includes(c.id))
      .map((cat, i) => ({ cat, icono: ICONOS_FALLBACK[i % ICONOS_FALLBACK.length] }));
  } else {
    entries = todasCategorias.filter(c => !c.padre_id)
      .map((cat, i) => ({ cat, icono: ICONOS_FALLBACK[i % ICONOS_FALLBACK.length] }));
  }

  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  // Bugfix: titulo_size/columnas/padding/alineación se guardaban pero nunca
  // se leían. Ancladas en 'lg'/4/'md' porque eran los valores con los que ya
  // nacían las secciones existentes (TIPO_DEFAULTS).
  const escalaTitulo = escalaTamano(datos.titulo_size);
  const tituloFontSize = `clamp(${1.5 * escalaTitulo}rem, ${3 * escalaTitulo}vw, ${1.875 * escalaTitulo}rem)`;
  // Tamaño del nombre de categoría dentro de cada card — campo propio
  // (item_titulo_size), distinto de titulo_size (que es el <h2> del bloque).
  // Nunca existió antes; default 'sm' reproduce el text-sm fijo de siempre.
  // Bugfix: a tamaños grandes en la columna angosta de 4 columnas, el título
  // wrappeaba a 2-3 líneas y se recortaba contra el overflow-hidden de la
  // card. Se resuelve con clamp() (mismo patrón que tituloFontSize del <h2>
  // del bloque) para que se achique en pantallas/columnas angostas sin
  // perder el tamaño elegido en desktop, más line-clamp-2 como red de
  // seguridad final para nombres extremadamente largos.
  const itemTituloRem = parseFloat(SIZE_REM[datos.item_titulo_size || 'sm']);
  const itemTituloFontSize = `clamp(${(itemTituloRem * 0.8).toFixed(3)}rem, ${(itemTituloRem * 1.6).toFixed(2)}vw, ${itemTituloRem}rem)`;
  // Tamaño del link "Ver productos" — antes fijo en 11px sin ningún control.
  // Mismo mecanismo heredable; default 'xs' (12px) es apenas más grande que
  // el histórico 11px pero sigue siendo claramente secundario frente al título.
  const itemLinkFontSize = SIZE_REM[datos.item_link_size || 'xs'];
  const padding = paddingVertical(datos.padding, [4, 5], 'md');
  const textAlign = datos.alineacion || undefined;
  // Herencia: Subtítulo → Bloque → Tema (mismo mecanismo en toda la cadena).
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  // Acento del link "Ver productos": Bloque (datos.accent_color) → Tema
  // (tema.accent_color) — mismo mecanismo de herencia, campo escalar simple
  // (no es un par bg/texto como heredaDeBloque, así que se resuelve directo).
  const accentColor = datos.accent_color || tema.accent_color;

  return (
    <section className="w-full px-8 py-16 md:py-20 flex items-center" style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
          {datos.titulo && (
            <div style={{ textAlign }} className="mb-10">
              <SectionLabel>Categorías</SectionLabel>
              <motion.h2 variants={FADE_UP} transition={T}
                className={`font-bold tracking-tight ${datos.subtitulo ? 'mb-2' : ''}`}
                style={{ fontSize: tituloFontSize, color: tc }}>
                {datos.titulo}
              </motion.h2>
              {datos.subtitulo && (
                <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.05 }}
                  className="text-sm max-w-md"
                  style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
                  {datos.subtitulo}
                </motion.p>
              )}
            </div>
          )}

          {/* Grid adaptable: CSS Grid solo dibuja las celdas que tienen
              contenido — con menos categorías que columnas, la fila queda
              incompleta sin huecos grises (no hay celdas "vacías" que pintar). */}
          <div className={`grid grid-cols-2 ${COL_CLASS[datos.columnas ?? 4] ?? 'md:grid-cols-4'} gap-3`}>
            {entries.map(({ cat, icono, imagen_url }, i) => (
              <motion.div key={cat.id} variants={FADE_UP} transition={{ ...T, delay: i * 0.05 }}>
                <Link to={`/productos?categoria_id=${cat.id}`}
                  className="group relative block w-full overflow-hidden rounded-xl"
                  style={{ aspectRatio: '4 / 5' }}>
                  {imagen_url ? (
                    <>
                      <img src={imagen_url} alt={cat.nombre}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
                      {/* Degradé para legibilidad del texto superpuesto, sin importar la imagen de fondo */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/[0.04]">
                      <span className="text-5xl transition-transform duration-500 ease-out group-hover:scale-105 inline-block">
                        {icono}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                    </div>
                  )}
                  {/* Overlay de texto — nombre + link, superpuestos abajo */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="font-semibold text-[#FAF7F3] mb-0.5 leading-tight line-clamp-2" style={{ fontSize: itemTituloFontSize }}>{cat.nombre}</div>
                    <div className="relative inline-flex items-center gap-1 font-medium transition-opacity group-hover:opacity-80"
                      style={{ color: accentColor, fontSize: itemLinkFontSize }}>
                      Ver productos <ArrowRight size={10} />
                      {/* Subrayado que se dibuja de izquierda a derecha al hover — CSS puro, reusa el acento ya usado en el link. */}
                      <span className="absolute left-0 right-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                        style={{ backgroundColor: accentColor }} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRODUCTOS DESTACADOS
// ─────────────────────────────────────────────────────────────────────────────
function SeccionProductosDestacados({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const agregar = useCarritoStore(s => s.agregar);
  const mostrarToast = useToastStore(s => s.agregar);
  const cantidad = datos.cantidad || 8;
  const ids: string[] = datos.productos_ids ?? [];
  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['productos-seccion', ids.join(',')],
    queryFn: () => ids.length > 0
      ? api.get(`/productos?ids=${ids.join(',')}`).then(r => r.data.data)
      : Promise.resolve([]),
    enabled: ids.length > 0,
  });

  const handleAgregar = (p: Producto) => {
    agregar({ producto_id: p.id, nombre_producto: p.nombre, precio_unitario: Number(p.precio_base), cantidad: 1,
      imagen_url: p.imagenes_producto?.[0]?.url, stock: p.stock });
    mostrarToast(p.nombre, p.imagenes_producto?.[0]?.url);
  };

  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  // Bugfix: titulo_size/padding/alineación se guardaban pero nunca se leían.
  const escalaTitulo = escalaTamano(datos.titulo_size);
  const tituloFontSize = `clamp(${1.5 * escalaTitulo}rem, ${3 * escalaTitulo}vw, ${1.875 * escalaTitulo}rem)`;
  const padding = paddingVertical(datos.padding, [4, 5], 'md');
  // Herencia: Subtítulo → Bloque → Tema (mismo mecanismo en toda la cadena).
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });

  return (
    <section className="w-full px-8 py-16 md:py-20 flex items-center" style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}
          className="flex items-end justify-between mb-10">
          <div style={{ textAlign: datos.alineacion || undefined }}>
            <SectionLabel>Colección</SectionLabel>
            <motion.h2 variants={FADE_UP} transition={T}
              className="font-bold tracking-tight"
              style={{ fontSize: tituloFontSize, color: tc }}>
              {datos.titulo || 'Más vendidos'}
            </motion.h2>
            {datos.subtitulo && (
              <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.05 }}
                className="text-sm mt-2 max-w-md"
                style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
                {datos.subtitulo}
              </motion.p>
            )}
          </div>
          <motion.div variants={FADE_UP} transition={T}>
            <Link to="/productos"
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-black/40 hover:text-black transition-colors">
              Ver todos <ArrowRight size={12} />
            </Link>
          </motion.div>
        </motion.div>

        <ProductGrid
          productos={(productos ?? []).slice(0, cantidad)}
          onAgregar={handleAgregar}
          cols={(datos.columnas ?? 3) as 2 | 3 | 4}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CÓMO FUNCIONA
// ─────────────────────────────────────────────────────────────────────────────
const PASOS_DEFAULT = [
  { icono: '01', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' },
  { icono: '02', titulo: 'Aprobás el arte', desc: 'Te enviamos una previsualización del grabado para tu visto bueno.' },
  { icono: '03', titulo: 'Grabamos tu pieza', desc: 'Láser de precisión sobre acero inoxidable, madera o acrílico.' },
  { icono: '04', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real.' },
];

function SeccionComoFunciona({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const pasos: { icono: string; titulo: string; desc: string }[] = datos.pasos ?? PASOS_DEFAULT;
  // Bugfix: padding/alineación se guardaban pero nunca se leían.
  const padding = paddingVertical(datos.padding, [5, 7], 'md');
  // Bugfix: el subtítulo ya existía en TIPO_DEFAULTS y en el editor, pero
  // nunca se renderizaba. Su color/tipografía heredan del bloque (Subtítulo
  // → Bloque → Tema) con el mismo mecanismo que el resto de la cadena.
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });

  return (
    <section className="w-full px-8 py-20 md:py-28 flex items-center" style={{ backgroundColor: bg, color: tc, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER} style={{ textAlign: datos.alineacion || undefined }}>
          <SectionLabel light>Proceso</SectionLabel>
          <div className="mb-16">
            <motion.h2 variants={FADE_UP} transition={T}
              className={`text-2xl md:text-3xl font-bold tracking-tight ${datos.subtitulo ? 'mb-2' : ''}`}>
              {datos.titulo || '¿Cómo funciona?'}
            </motion.h2>
            {datos.subtitulo && (
              <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.05 }}
                className="text-sm max-w-md"
                style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
                {datos.subtitulo}
              </motion.p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-t" style={{ borderColor: `${tc}10` }}>
            {pasos.map((paso, i) => (
              <motion.div key={i} variants={FADE_UP} transition={{ ...T, delay: i * 0.1 }}
                className="relative pt-8 pr-8 pb-8 border-b md:border-b-0 md:border-r last:border-r-0"
                style={{ borderColor: `${tc}10` }}>
                {/* Número grande decorativo */}
                <span className="block text-[3.5rem] font-black leading-none mb-6 tracking-tight"
                  style={{ color: `${tc}08` }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="text-sm font-bold mb-2" style={{ color: tc }}>{paso.titulo}</div>
                <div className="text-xs leading-relaxed" style={{ color: `${tc}45` }}>{paso.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────
function SeccionCtaBanner({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const botonesResueltos = resolverBotones(datos);
  const botones = botonesResueltos.length ? botonesResueltos : [{ texto: 'Ver colección', link: '/productos' }];
  // Bugfix: padding/alineación se guardaban pero nunca se leían.
  const padding = paddingVertical(datos.padding, [5, 7], 'md');
  // Herencia: Subtítulo → Bloque → Tema (mismo mecanismo que como_funciona).
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  // Botones: cada uno hereda Botón → Bloque (btn_color/btn_texto_color) →
  // Tema (ya resuelto en bg/tc) — mismo mecanismo que en el hero.
  const defaultsBotonPrimario = { bg: datos.btn_color || tc, tc: datos.btn_texto_color || bg, fontFamily };
  const defaultsBotonSecundario = { bg: tc, tc, fontFamily };

  return (
    <section className="w-full px-8 py-8" style={{ backgroundColor: datos.outer_bg || '#f9f9f9' }}>
      <motion.div
        className="max-w-6xl mx-auto relative overflow-hidden px-10 md:px-20 py-20 md:py-28 flex flex-col md:flex-row items-start md:items-end justify-between gap-10"
        style={{ backgroundColor: bg, color: tc, fontFamily, minHeight, ...padding }}
        initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}
      >
        {/* Texto */}
        <div className="flex-1" style={{ textAlign: datos.alineacion || undefined }}>
          {datos.eyebrow && (
            <motion.p variants={FADE_UP} transition={T}
              className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
              style={{ color: `${tc}35` }}>
              {datos.eyebrow}
            </motion.p>
          )}
          <motion.h2 variants={FADE_UP} transition={T}
            className="font-bold leading-[1.08] tracking-tight whitespace-pre-line"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
            {datos.titulo || '¿Listo para personalizar\ntu mate?'}
          </motion.h2>
          {datos.subtitulo && (
            <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.1 }}
              className="text-sm mt-4 max-w-sm" style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
              {datos.subtitulo}
            </motion.p>
          )}
        </div>

        {/* Botones */}
        <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          {botones.map((boton, bi) => {
            const esPrimario = bi === 0;
            const r = heredaDeBloque(boton, esPrimario ? defaultsBotonPrimario : defaultsBotonSecundario);
            const tieneOverridePropio = !!boton.texto_color;
            return esPrimario ? (
              <Link key={bi} to={boton.link || '/productos'}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: r.bg, color: r.tc, fontFamily: r.fontFamily }}>
                {boton.texto || 'Ver colección'} <ArrowRight size={14} />
              </Link>
            ) : (
              <Link key={bi} to={boton.link || '/'}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-medium border transition-opacity hover:opacity-60"
                style={{
                  borderColor: tieneOverridePropio ? r.tc : `${r.tc}25`,
                  color: tieneOverridePropio ? r.tc : `${r.tc}70`,
                  fontFamily: r.fontFamily,
                }}>
                {boton.texto}
              </Link>
            );
          })}
        </motion.div>

        {/* Línea decorativa */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: `${tc}08` }} />
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BANNER IMAGEN
// ─────────────────────────────────────────────────────────────────────────────
const BORDER_RADIUS_REM: Record<string, string> = { none: '0', md: '0.375rem', xl: '0.75rem', '2xl': '1rem' };

function SeccionBannerImagen({ datos }: { datos: Record<string, any> }) {
  if (!datos.imagen_url) return null;
  // Bugfix: object_fit/border_radius/padding se guardaban pero nunca se leían.
  const padding = paddingVertical(datos.padding, [1.5, 1.5], 'sm');
  const borderRadius = BORDER_RADIUS_REM[datos.border_radius] ?? BORDER_RADIUS_REM.xl;
  const img = (
    <motion.img src={datos.imagen_url} alt=""
      className="w-full"
      style={{ maxHeight: datos.max_height ? `${datos.max_height}px` : '380px', objectFit: datos.object_fit || 'cover' }}
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEWPORT} transition={T} />
  );
  return (
    <section className="w-full px-8 py-6" style={padding}>
      <div className="max-w-6xl mx-auto overflow-hidden" style={{ borderRadius }}>
        {datos.link ? <Link to={datos.link}>{img}</Link> : img}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TEXTO LIBRE
// ─────────────────────────────────────────────────────────────────────────────
function SeccionTextoLibre({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, fontFamily, minHeight } = estiloHeredado(datos, tema);
  // Bugfix: padding se guardaba pero nunca se leía.
  const padding = paddingVertical(datos.padding, [3, 4], 'md');
  return (
    <section className="w-full px-8 py-12 md:py-16 flex items-center" style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-3xl mx-auto w-full prose prose-sm max-w-none text-black/80"
        dangerouslySetInnerHTML={{ __html: datos.html || '' }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. BARRA DE FILTROS RÁPIDOS
// ─────────────────────────────────────────────────────────────────────────────
// Cada item es {id, tipo, label, config}: "tipo" decide qué config espera y
// cómo se arma la URL a /productos — mismo query params que ya lee la
// sidebar de filtros de Productos.tsx (categoria_id, apto_grabado). Nuevos
// tipos de filtro (ej. rango_precio, material) se suman como un caso más acá
// y en el editor del admin, sin tocar la forma del array ni migrar datos ya
// guardados de bloques existentes.
export interface FiltroItem {
  id: string;
  tipo: 'categoria' | 'apto_grabado';
  label: string;
  config: Record<string, any>;
}

export function urlDeFiltro(item: FiltroItem): string {
  switch (item.tipo) {
    case 'categoria': return `/productos?categoria_id=${item.config.categoria_id}`;
    case 'apto_grabado': return `/productos?apto_grabado=true`;
    default: return '/productos';
  }
}

function SeccionFiltrosRapidos({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const items: FiltroItem[] = datos.items ?? [];
  const padding = paddingVertical(datos.padding, [1.5, 1.5], 'sm');

  if (items.length === 0) return null;

  return (
    <section className="w-full px-8" style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full overflow-x-auto">
        <motion.div className="flex gap-2 w-max md:w-full md:flex-wrap"
          initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
          {items.map((item, i) => (
            <motion.div key={item.id} variants={FADE_UP} transition={{ ...T, delay: i * 0.04 }}>
              <Link to={urlDeFiltro(item)}
                className="inline-flex items-center whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                style={{ borderColor: `${tc}25`, color: tc }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = tema.accent_color; e.currentTarget.style.color = tema.accent_color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${tc}25`; e.currentTarget.style.color = tc; }}
              >
                {item.label}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Imágenes libres dentro de un bloque (Fase 4) — se ubican con x/y en % del
// espacio del bloque (posicionamiento libre reposicionable desde el admin) y
// escala en % del ancho del bloque. Capa decorativa por encima del contenido.
// ─────────────────────────────────────────────────────────────────────────────
interface ImagenLibre { id: string; url: string; x: number; y: number; escala: number }

function ImagenesLibres({ imagenes }: { imagenes?: ImagenLibre[] }) {
  if (!imagenes?.length) return null;
  return (
    <>
      {imagenes.map(img => (
        <img key={img.id} src={img.url} alt="" draggable={false}
          className="absolute pointer-events-none select-none max-w-none"
          style={{ left: `${img.x}%`, top: `${img.y}%`, width: `${img.escala}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccion(sec: Seccion, tema: TemaGlobal) {
  switch (sec.tipo) {
    case 'hero':                 return <SeccionHero key={sec.id} datos={sec.datos} tema={tema} />;
    case 'banner_texto':         return <SeccionBannerTexto key={sec.id} datos={sec.datos} tema={tema} />;
    case 'stats_barra':          return <SeccionStatsBarra key={sec.id} datos={sec.datos} tema={tema} />;
    case 'categorias_grid':      return <SeccionCategoriasGrid key={sec.id} datos={sec.datos} tema={tema} />;
    case 'productos_destacados': return <SeccionProductosDestacados key={sec.id} datos={sec.datos} tema={tema} />;
    case 'como_funciona':        return <SeccionComoFunciona key={sec.id} datos={sec.datos} tema={tema} />;
    case 'cta_banner':           return <SeccionCtaBanner key={sec.id} datos={sec.datos} tema={tema} />;
    case 'banner_imagen':        return <SeccionBannerImagen key={sec.id} datos={sec.datos} />;
    case 'texto_libre':          return <SeccionTextoLibre key={sec.id} datos={sec.datos} tema={tema} />;
    case 'filtros_rapidos':      return <SeccionFiltrosRapidos key={sec.id} datos={sec.datos} tema={tema} />;
    default:                     return null;
  }
}

// Componente compartido: recibe las secciones YA resueltas (activas, sin
// navbar) y el tema efectivo — no hace fetch propio. Home.tsx lo alimenta
// con el PUBLICADO; el preview en vivo del admin lo alimenta con el estado
// en memoria del BORRADOR (sin pasar por el backend).
export function HomeSecciones({ secciones, tema }: { secciones: Seccion[]; tema: TemaGlobal }) {
  useFonts(secciones);
  return (
    <div className="flex flex-col">
      {secciones.map(sec => (
        <div key={sec.id} className="relative">
          {renderSeccion(sec, tema)}
          <ImagenesLibres imagenes={sec.datos.imagenes} />
        </div>
      ))}
    </div>
  );
}

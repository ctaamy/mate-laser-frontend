import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import api from '../../lib/api';
import { useCarritoStore } from '../../store/carrito.store';
import { useToastStore } from '../../store/toast.store';
import type { Producto, Categoria } from '../../types/index';
import ProductGrid from '../ui/ProductGrid';
import { SIZE_REM, fontSizeClampItem, ImagenConOverlay, LinkAcentoConSubrayado, ComboImagenConOverlay, type Anclaje } from '../ui/CardOverlay';
import TransicionInferior from '../ui/TransicionInferior';
import { STAT_ICONS, STAT_ICON_FALLBACK, PASO_ICON_FALLBACK } from '../ui/StatIcons';
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

// clamp() que recorta el CRECIMIENTO por encima del tamaño base en viewports
// angostos (mismo mecanismo que ya usa tituloFontSize con vw, generalizado).
// Sin esto, un elemento con font-size/padding fijos en rem escalados por un
// factor grande (ej. boton_size "4xl") podía terminar más ancho que el
// propio viewport en mobile — no solo "grande", directamente desbordado
// fuera del bloque (contenido cortado por el overflow-hidden del hero).
// Con escala<=1 el clamp no hace nada: devuelve `${base}rem` fijo, así que
// el tamaño histórico (sin configurar, o "más chico que el default") queda
// bit a bit igual que antes de tener esta función.
function clampEscalado(baseRem: number, escala: number, coefVw: number): string {
  const extra = Math.max(0, escala - 1);
  if (extra === 0) return `${baseRem}rem`;
  return `clamp(${baseRem}rem, calc(${baseRem}rem + ${(extra * coefVw).toFixed(3)}vw), ${(baseRem * escala).toFixed(4)}rem)`;
}

// SIZE_REM, fontSizeClampItem, ImagenConOverlay, LinkAcentoConSubrayado
// viven en components/ui/CardOverlay.tsx (compartidas con ProductCard.tsx,
// que este archivo importa indirectamente vía ProductGrid — así se evita
// un import circular).

const PESO_NUM: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };

// Punto focal de la imagen del hero — a qué zona "agarrarse" cuando
// object-cover recorta (sobre todo en mobile: contenedor alto y angosto).
// Sin configurar → 'center' = comportamiento histórico.
const FOCO_POS: Record<string, string> = {
  centro: 'center', arriba: 'top', abajo: 'bottom', izquierda: 'left', derecha: 'right',
};

const ESCALA_PADDING: Record<string, number> = { xs: 0.4, sm: 0.7, md: 1, lg: 1.35, xl: 1.7 };
function paddingVertical(padding: string | undefined, remBase: [number, number], opcionBase = 'md'): { paddingTop?: string; paddingBottom?: string } {
  if (!padding) return {};
  const factor = (ESCALA_PADDING[padding] ?? 1) / (ESCALA_PADDING[opcionBase] ?? 1);
  return { paddingTop: `${remBase[0] * factor}rem`, paddingBottom: `${remBase[1] * factor}rem` };
}

// Espaciado vertical simple (un solo margen, no un par top/bottom) — mismo
// mecanismo de escala que paddingVertical, reusado para separaciones como
// título → subtítulo. opcionBase = la opción que reproduce el valor
// histórico hardcodeado, así "sin configurar" no cambia nada.
function gapVertical(valor: string | undefined, remBase: number, opcionBase = 'md'): string {
  const factor = (ESCALA_PADDING[valor || opcionBase] ?? 1) / (ESCALA_PADDING[opcionBase] ?? 1);
  return `${remBase * factor}rem`;
}

// Clases literales (no template dinámico) para que Tailwind las genere.
const COL_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6',
};

// Hero — pr reservado para que el CTA a la derecha no choque con la flecha
// "siguiente" / el número decorativo "01" (ver ctaVaADerecha/revertirEnMd/
// reforzarEnLg en HeroSlideContent). 2 niveles según boton_size: un botón
// más grande necesita más aire. Clases literales completas (no template
// dinámico) para que el JIT de Tailwind las genere — mismo motivo que
// COL_CLASS arriba.
//   conNumero:   sin imagen — reforzado en todos los breakpoints, más aún
//                en lg (compite también con el número decorativo).
//   soloMobile:  imagen apilada — reforzado solo <md; desde md el layout
//                pasa a columnas y el margen natural ya alcanza.
//   sinNumero:   imagen de fondo — reforzado en todos los breakpoints, pero
//                sin el extra de lg (no hay número decorativo que esquivar).
const PR_REFORZADO = [
  { // nivel 0: boton_size hasta 'lg' (comportamiento por defecto incluido)
    conNumero: 'pr-32 md:pr-32 lg:pr-[38%]',
    soloMobile: 'pr-32 md:pr-16 lg:pr-24',
    sinNumero: 'pr-32 md:pr-32 lg:pr-24',
  },
  { // nivel 1: boton_size 'xl' en adelante
    conNumero: 'pr-48 md:pr-48 lg:pr-[46%]',
    soloMobile: 'pr-48 md:pr-16 lg:pr-24',
    sinNumero: 'pr-48 md:pr-48 lg:pr-24',
  },
];

function justifyDeAlineacion(alineacion?: string): string | undefined {
  if (!alineacion) return undefined;
  return alineacion === 'center' ? 'center' : alineacion === 'right' ? 'flex-end' : 'flex-start';
}

// Fase 2 (hero): anclaje vertical del bloque de texto — antes fijo en
// "justify-center" (centrado siempre), sin forma de moverlo. Mismo mapeo que
// justifyDeAlineacion pero para el eje vertical, como clase Tailwind (no
// style inline) porque conviven en el mismo className que pt/pb/pl/pr.
// soloDesdeMd: cuando hay imagen apilada (ver "anclajeSoloDesdeMd" en
// HeroSlideContent), el anclaje elegido solo es seguro desde md: — en
// mobile se fuerza "center" (el comportamiento ya estable de antes de
// esta fase) sin importar lo configurado.
function justifyVerticalDeAnclaje(anclaje: string | undefined, soloDesdeMd: boolean): string {
  const clase = anclaje === 'top' ? 'justify-start' : anclaje === 'bottom' ? 'justify-end' : 'justify-center';
  if (!soloDesdeMd || clase === 'justify-center') return clase;
  return `justify-center md:${clase}`;
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
// delayMs: retardo antes de arrancar a contar. Lo usa stats_barra para que el
// número no empiece a subir hasta que su tarjeta terminó de aparecer en la
// entrada escalonada del grid (staggerChildren) — así las dos animaciones se
// encadenan en vez de pisarse. Sin delay (default 0) el comportamiento es el
// histórico.
function useCountUp(target: string, inView: boolean, delayMs = 0) {
  const numStr = target.replace(/[^0-9.]/g, '');
  const suffix = target.replace(/[0-9.]/g, '');
  const num = parseFloat(numStr) || 0;
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView || num === 0) return;
    const duration = 1400;
    let timer: ReturnType<typeof setInterval> | undefined;
    const arranque = setTimeout(() => {
      const start = Date.now();
      timer = setInterval(() => {
        const t = Math.min((Date.now() - start) / duration, 1);
        setCount(Math.floor((1 - Math.pow(1 - t, 3)) * num));
        if (t >= 1) clearInterval(timer);
      }, 16);
    }, delayMs);
    return () => { clearTimeout(arranque); clearInterval(timer); };
  }, [inView, num, delayMs]);
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
  // Imagen alternativa para pantallas chicas (recorte vertical/cuadrado del
  // mismo diseño). Sin esto, en mobile se usa `imagen_url` recortada según
  // `imagen_foco`.
  imagen_url_mobile?: string;
  imagen_foco?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  botones?: Boton[];
  bg_color?: string; texto_color?: string;
}

// Imagen del hero con soporte de versión mobile + punto focal. Sin imagen
// mobile propia renderiza UNA sola <img> con las clases históricas exactas
// — varios tests dependen de que el selector `img[src=...]` sea único.
function HeroImg({ desktop, mobile, objectPosition }: {
  desktop?: string; mobile?: string; objectPosition: string;
}) {
  const cls = 'absolute inset-0 w-full h-full object-cover';
  const common = {
    initial: { scale: 1.05 }, animate: { scale: 1 },
    transition: { duration: 1, ease: 'easeOut' as const },
    style: { objectPosition },
  };
  if (!mobile || mobile === desktop) {
    return <motion.img key={desktop} src={desktop} alt="" className={cls} {...common} />;
  }
  return (
    <>
      <motion.img key={`m-${mobile}`} src={mobile} alt="" className={`${cls} sm:hidden`} {...common} />
      <motion.img key={`d-${desktop}`} src={desktop} alt="" className={`${cls} hidden sm:block`} {...common} />
    </>
  );
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

function HeroSlideContent({ slide, dir, bloque, datos, total }: {
  slide: HeroSlide; dir: number; bloque: EstiloBloque; datos: Record<string, any>; total: number;
}) {
  // Herencia: Slide → Bloque → Tema (mismo mecanismo heredaDeBloque que el
  // resto de la cadena; "bloque" ya resolvió su propia herencia del tema).
  const { bg, tc, fontFamily } = heredaDeBloque(slide, bloque);
  // Sin fallback a un texto predefinido: un slide sin título/subtítulo debe
  // verse en blanco, no "recuperar" un placeholder — el default solo existe
  // una vez, al crear el slide (ver SLIDE_DEFAULT en Configuracion.tsx).
  const titulo = slide.titulo || '';
  const lineas = titulo ? titulo.split('\n') : [];
  const tieneImagen = !!slide.imagen_url;
  const objFoco = FOCO_POS[slide.imagen_foco || 'centro'] || 'center';
  const botonesResueltos = resolverBotones(slide);
  const botones = botonesResueltos.length ? botonesResueltos : [{ texto: 'Ver colección', link: '/productos' }];
  const imagePosition = datos.image_position || 'bleed';
  const overlay = resolverOverlay(datos);
  const justifyBotones = justifyDeAlineacion(datos.boton_posicion || datos.alineacion);

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

  // Fase 3: tamaño del CTA configurable — antes fijo en px-6 py-3 text-sm
  // (0.875rem), sin relación con titulo_size/subtitulo_size/eyebrow_size que
  // sí eran configurables. opcionBase 'sm' porque 0.875rem es exactamente
  // SIZE_REM.sm — sin configurar, no cambia nada. Escala texto Y padding
  // juntos y en la misma proporción (mismo mecanismo que escalaTamano ya usa
  // para el título) para que "más grande" se sienta como un botón más
  // grande, no solo texto más grande con el mismo padding. clampEscalado
  // (no un simple *escalaBoton) por boton_size grande: recorta el tamaño en
  // viewports angostos para que el botón no termine más ancho que el propio
  // hero — ver el comentario de la función.
  const escalaBoton = escalaTamano(datos.boton_size, 'sm');
  const botonFontSize = clampEscalado(0.875, escalaBoton, 2);
  const botonPadding = `${clampEscalado(0.75, escalaBoton, 1.5)} ${clampEscalado(1.5, escalaBoton, 3.5)}`;
  // 'xl' (1.643) en adelante pasa a nivel 1 — ver PR_REFORZADO.
  const nivelBoton = escalaBoton > 1.5 ? 1 : 0;

  const enter = { opacity: 0, x: dir > 0 ? 48 : -48 };
  const exit  = { opacity: 0, x: dir > 0 ? -48 : 48 };

  const esBackground = imagePosition === 'background' && tieneImagen;

  // Bugfix: con más de un slide, los controles del carrusel (flechas, dots,
  // contador) son absolutos y fijos sobre el hero — el bloque de texto no
  // reservaba espacio para ellos, así que el CTA podía quedar tapado sin
  // importar la posición elegida.
  //
  // ctaVaADerecha: en TODOS los breakpoints por debajo de "md" (768px) el
  // layout es flex-col — la columna de texto ocupa el 100% del ancho del
  // hero, CON o SIN imagen (si hay imagen, va apilada abajo, no al costado)
  // — así que un CTA a la derecha choca con la flecha "siguiente" en mobile
  // sin importar si hay imagen o no (verificado con overlap real: con
  // imagen + boton_size grande, el botón sí llegaba a tocar la flecha en
  // mobile — no es un caso hipotético). Recién desde "md" el layout con
  // imagen pasa a flex-row (columnas lado a lado) y ahí el margen natural
  // de la columna ya alcanza, así que ahí se revierte al padding normal.
  const ctaVaADerecha = justifyBotones === 'flex-end';
  const revertirEnMd = ctaVaADerecha && tieneImagen && !esBackground;
  // El número decorativo "01" (hidden lg:flex) solo compite cuando no hay
  // imagen — con imagen (apilada o de fondo) no existe.
  const reforzarEnLg = ctaVaADerecha && !tieneImagen;

  // Bugfix (Fase 2): con imagen apilada (no "background"), en mobile el
  // texto no tiene una altura propia fija — es "flex-1" compitiendo por
  // espacio contra la imagen (h-[42%], fija) dentro del alto total del
  // hero. Si el contenido del texto es más alto que ese ~58% teórico,
  // desborda; con anclaje_vertical "bottom" ese desborde empuja el CTA
  // hacia abajo, justo a la franja donde la flecha "siguiente" se
  // reposiciona para centrarse sobre la imagen (flechasSobreImagenMobile
  // en SeccionHero) — verificado con overlap real, no hipotético. En
  // desktop (md:flex-row) el texto tiene el alto completo del hero
  // (columna al lado de la imagen, sin competir por espacio), así que ahí
  // el anclaje elegido es seguro. Con imagen "background" tampoco aplica:
  // la imagen es absolute (no ocupa espacio en el flujo), el texto ya
  // tiene el 100% del alto en cualquier breakpoint.
  const anclajeSoloDesdeMd = tieneImagen && !esBackground;

  const textoColumna = (
    <motion.div
      className={[
        'flex-1 flex flex-col pt-10 md:pt-20',
        justifyVerticalDeAnclaje(datos.anclaje_vertical, anclajeSoloDesdeMd),
        'pl-6 md:pl-16 lg:pl-24',
        // pr por separado de pl (no como px-*): cuando hay que reforzarlo para
        // esquivar la flecha/el número decorativo, un pr-* extra conviviendo
        // con un px-* de igual especificidad no garantiza cuál gana en la
        // cascada de Tailwind (depende del orden interno de generación, no
        // del orden en el className) — separarlos evita que dos clases
        // compitan por la misma propiedad. Nivel de refuerzo según
        // boton_size (PR_REFORZADO más abajo): un botón más grande necesita
        // más aire hasta la flecha/número decorativo. Cubre bien hasta 'xl'
        // — 2xl/3xl/4xl combinado con boton_posicion "derecha" en mobile es
        // geométricamente ajustado (el botón en sí ya ocupa gran parte del
        // ancho del viewport) y puede necesitar ajuste manual del admin; el
        // preview en vivo del editor lo hace visible de inmediato.
        !ctaVaADerecha ? 'pr-6 md:pr-16 lg:pr-24'
          : revertirEnMd ? PR_REFORZADO[nivelBoton].soloMobile
          : reforzarEnLg ? PR_REFORZADO[nivelBoton].conNumero
          : PR_REFORZADO[nivelBoton].sinNumero,
        // pb extra: despeja la franja de dots/contador (bottom-8) cuando hay
        // carrusel — sin esto el CTA podía terminar tapado por esos controles.
        total > 1 ? 'pb-20 md:pb-28' : 'pb-10 md:pb-20',
        esBackground ? 'relative z-10' : '',
      ].filter(Boolean).join(' ')}
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

      {!!lineas.length && (
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
      )}

      {!!slide.subtitulo && (
        <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.2 }}
          className="leading-relaxed mb-10 max-w-xs"
          style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily, fontWeight: subtituloFontWeight, fontSize: subtituloFontSize }}>
          {slide.subtitulo}
        </motion.p>
      )}

      <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.3 }}
        // z-30: por encima del z-20 de los controles del carrusel (flechas/
        // dots/contador) — red de seguridad para que el CTA nunca quede
        // tapado si igual llegara a rozar esa franja.
        className="flex flex-col items-stretch sm:flex-row sm:flex-wrap sm:items-start gap-3 relative z-30" style={{ justifyContent: justifyBotones }}>
        {botones.map((boton, bi) => {
          const esPrimario = bi === 0;
          const r = heredaDeBloque(boton, esPrimario ? defaultsBotonPrimario : defaultsBotonSecundario);
          const tieneOverridePropio = !!boton.texto_color;
          return esPrimario ? (
            <Link key={bi} to={boton.link || '/productos'}
              className="inline-flex w-full sm:w-auto justify-center sm:justify-start items-center gap-2 font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: r.bg, color: r.tc, fontFamily: r.fontFamily, fontSize: botonFontSize, padding: botonPadding }}>
              {boton.texto} <ArrowRight size={14} />
            </Link>
          ) : (
            <Link key={bi} to={boton.link || '/'}
              className="inline-flex w-full sm:w-auto justify-center sm:justify-start items-center gap-2 font-medium border transition-opacity hover:opacity-60"
              style={{
                borderColor: tieneOverridePropio ? r.tc : `${r.tc}25`,
                color: tieneOverridePropio ? r.tc : `${r.tc}70`,
                fontFamily: r.fontFamily,
                fontSize: botonFontSize,
                padding: botonPadding,
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
          <HeroImg desktop={slide.imagen_url} mobile={slide.imagen_url_mobile} objectPosition={objFoco} />
          <HeroOverlay direction={overlay.direction} intensity={overlay.intensity} bg={bg} />
          {textoColumna}
        </>
      ) : (
        <>
          {textoColumna}

          {tieneImagen && (
            <div className={
              // h-[42%] (del hero, no del viewport) en vez de max-h: la imagen
              // es "absolute", no aporta altura propia al contenedor — con
              // solo un max-height el contenedor colapsaba a 0 en mobile
              // (flex-col). Porcentaje y no vh: así funciona igual si el
              // admin puso un "Alto mínimo" propio en px en vez del 90vh
              // default. En md+ el layout pasa a fila y min-h-full la estira
              // contra el hero.
              imagePosition === 'contained'
                ? 'relative h-[42%] md:h-auto md:w-[52%] md:min-h-full overflow-hidden flex-shrink-0 m-4 md:my-6 md:mr-6 rounded-xl shadow-sm'
                : 'relative h-[42%] md:h-auto md:w-[52%] md:min-h-full overflow-hidden flex-shrink-0'
            }>
              <HeroImg desktop={slide.imagen_url} mobile={slide.imagen_url_mobile} objectPosition={objFoco} />
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
         imagen_url_mobile: datos.imagen_url_mobile, imagen_foco: datos.imagen_foco,
         btn_texto: datos.btn_texto, btn_link: datos.btn_link,
         btn2_texto: datos.btn2_texto, btn2_link: datos.btn2_link,
         bg_color: datos.bg_color, texto_color: datos.texto_color }];
  // Herencia: Slide → Bloque → Tema. "bloque" es el nivel intermedio que
  // antes faltaba (el slide saltaba directo al tema) — mismo estiloHeredado
  // que usa el resto de los tipos de sección.
  const bloque = estiloHeredado(datos, tema);
  const minHeight = datos.min_height && datos.min_height !== 'auto' ? `${datos.min_height}px` : '90vh';
  // Alto propio en mobile (opcional): sin esto, mobile usa el mismo alto que
  // desktop (comportamiento histórico). Vía variables CSS + clases
  // responsive en vez de un solo `style.minHeight` — un inline style siempre
  // gana contra cualquier clase, así que la única forma de que "md:" pueda
  // pisar el valor de mobile es que los dos lados sean clases (min-h-[var(...)])
  // referenciando cada una su propia variable.
  const minHeightMobile = datos.min_height_mobile ? `${datos.min_height_mobile}px` : minHeight;

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

  const slideActual = slides[Math.min(current, total - 1)];
  const tc = slideActual?.texto_color || bloque.tc;
  // Solo compensar la posición de las flechas cuando el slide activo realmente
  // apila una imagen abajo en mobile — con "background" la imagen ya cubre
  // todo el alto (top-1/2 normal sirve), y sin imagen no hay nada contra qué centrar.
  const esFondoCompleto = (datos.image_position || 'bleed') === 'background';
  const flechasSobreImagenMobile = !!slideActual?.imagen_url && !esFondoCompleto;
  // "Fondo": la imagen cubre TODO el bloque con object-cover a min_height fijo
  // (por defecto 90vh, o el "Alto mínimo" que haya puesto el admin en px).
  // Con un alto fijo en px, cuanto más ancha la pantalla más panorámico queda
  // el recorte — en un monitor grande object-cover termina recortando mucho
  // más verticalmente que en el preview del admin (que renderiza angosto).
  // Tope de relación de aspecto: el alto real usado es el máximo entre
  // min_height y ancho/2.4 — en pantallas angostas no cambia nada (gana
  // min_height), en pantallas muy anchas el bloque crece en vez de recortar.
  const conTopeDeAspecto = esFondoCompleto && !!slideActual?.imagen_url;

  return (
    <div
      className={`relative w-full overflow-hidden min-h-[var(--hero-min-h-mobile)] md:min-h-[var(--hero-min-h-desktop)] ${conTopeDeAspecto ? 'aspect-[12/5]' : ''}`}
      style={{ '--hero-min-h-mobile': minHeightMobile, '--hero-min-h-desktop': minHeight } as CSSProperties}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      <AnimatePresence mode="sync">
        <HeroSlideContent key={current} slide={slides[Math.min(current, total - 1)]} dir={dir} bloque={bloque} datos={datos} total={total} />
      </AnimatePresence>

      {total > 1 && (
        <>
          {/* Flechas */}
          {[
            { fn: prev, Icon: ChevronLeft, side: 'left-5' },
            { fn: next, Icon: ChevronRight, side: 'right-5' },
          ].map(({ fn, Icon, side }) => (
            // En mobile el layout apila texto arriba / imagen abajo (h-[42%]):
            // centradas a top-1/2 de todo el bloque quedaban a mitad de camino
            // entre texto e imagen, tapando el botón. Se centran contra la
            // imagen (el 42% inferior) en mobile, y contra todo el alto en md+.
            <button key={side} onClick={fn}
              className={`absolute ${side} ${flechasSobreImagenMobile ? 'top-[calc(100%-21%)] md:top-1/2' : 'top-1/2'} -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center border transition-all`}
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
  // Compat: secciones viejas guardaban un único "texto" en vez de la lista
  // "items" (múltiples textos, editable desde el admin). Se descartan los
  // vacíos para no mostrar un separador colgando sin nada al lado.
  const items: string[] = (datos.items?.length ? datos.items : (datos.texto ? [datos.texto] : []))
    .filter((t: string) => t?.trim());
  if (items.length === 0) return null;

  const separador = datos.separador || '—';
  // Bugfix: font_size/font_weight/padding se guardaban pero nunca se leían.
  // Anclado en 'sm' (11px) porque ese es el valor con el que ya nacían las
  // secciones existentes (TIPO_DEFAULTS) — así no cambia nada por defecto.
  const fontSize = datos.font_size ? `${0.6875 * escalaTamano(datos.font_size, 'sm')}rem` : undefined;
  const fontWeight = datos.font_weight ? PESO_NUM[datos.font_weight] : undefined;
  const padding = paddingVertical(datos.padding, [1.25, 1.25], 'sm');
  const justifyContent = justifyDeAlineacion(datos.alineacion) || 'center';
  // Bugfix: antes se forzaba una opacidad fija (60/FF hex en el ticker,
  // 0.5 en el modo estático) sin importar el peso elegido — un texto en
  // negrita seguía viéndose lavado. Ahora es 100% (texto sólido) por
  // defecto y editable en el tab Estilo; el separador decorativo queda
  // siempre un poco más sutil que el texto, en proporción a esa opacidad.
  const opacidad = (datos.opacidad ?? 100) / 100;
  const velocidad = datos.velocidad || 28;

  if (datos.marquee) {
    // El bloque de items se repite varias veces para llenar pantallas
    // anchas, y ese tramo repetido se duplica una vez más: al animar de 0%
    // a -50% la segunda copia entra justo cuando la primera termina de
    // salir, dando un loop continuo sin salto — funciona con cualquier
    // cantidad de textos, no solo con uno repetido.
    const REPETICIONES = 6;
    const bloque = Array.from({ length: REPETICIONES }, () => items).flat();
    return (
      <div className="w-full overflow-hidden py-2.5 border-y flex items-center"
        style={{ backgroundColor: bg, borderColor: `${tc}12`, fontFamily, minHeight }}>
        <motion.div className="flex whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: velocidad, repeat: Infinity, ease: 'linear' }}>
          {[0, 1].map(copia => (
            <div key={copia} className="flex items-center">
              {bloque.map((item, i) => (
                <span key={i} className="flex items-center text-[11px] tracking-widest uppercase px-8"
                  style={{ color: tc, opacity: opacidad, fontSize, fontWeight: fontWeight ?? 500 }}>
                  {item}
                  <span className="mx-8" style={{ color: tc, opacity: opacidad * 0.3 }}>{separador}</span>
                </span>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.section className="w-full px-8 py-5 flex items-center"
      style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}
      initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={FADE}>
      {/* flex-wrap: en mobile o con varios textos largos, se acomodan en
          más de una línea en vez de comprimirse contra las líneas
          decorativas — esas se ocultan bajo sm para no robarles espacio. */}
      <div className="max-w-6xl w-full flex flex-wrap items-center gap-x-5 gap-y-2" style={{ justifyContent }}>
        <div className="h-px flex-1 hidden sm:block" style={{ backgroundColor: tc, opacity: 0.1 }} />
        {items.flatMap((item, i) => [
          i > 0 && (
            <span key={`sep-${i}`} aria-hidden className="text-[11px]" style={{ color: tc, opacity: opacidad * 0.3 }}>
              {separador}
            </span>
          ),
          <span key={`item-${i}`} className="text-[11px] uppercase tracking-[0.2em] text-center"
            style={{ color: tc, opacity: opacidad, fontSize, fontWeight: fontWeight ?? 600 }}>
            {item}
          </span>,
        ])}
        <div className="h-px flex-1 hidden sm:block" style={{ backgroundColor: tc, opacity: 0.1 }} />
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATS
// ─────────────────────────────────────────────────────────────────────────────
function StatItem({ valor, label, icono, tc, iconColor, borderClass, escala, index }: {
  valor: string; label: string; icono?: string; tc: string; iconColor: string; borderClass: string; escala: number; index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  // El número arranca a contar después del retardo de entrada de su tarjeta
  // (staggerChildren 0.1s en el grid), no todos a la vez.
  const display = useCountUp(valor, inView, index * 100);
  const Icon = icono ? STAT_ICONS[icono] : undefined;
  // Escala general: multiplica tamaño de número/label/ícono y el padding
  // del item, todo junto y proporcional — no hay mínimo hardcodeado que
  // bloquee achicar más allá de lo que permitía antes (escala < 1).
  const valorFontSize = `clamp(${(2.25 * escala).toFixed(3)}rem, ${(5 * escala).toFixed(2)}vw, ${(3 * escala).toFixed(3)}rem)`;
  // Label: 0.75rem (12px) y opacidad 70% del texto. Antes era 0.625rem (10px)
  // al 40% — quedaba demasiado chico y lavado para leerse de un vistazo, que
  // es justo lo que tiene que hacer un trust signal. Sigue siendo claramente
  // secundario frente al número (100% de opacidad, mucho más grande).
  const labelFontSize = `${(0.75 * escala).toFixed(3)}rem`;
  const iconSize = 28 * escala;
  return (
    <motion.div ref={ref} variants={FADE_UP} transition={T}
      className={`flex flex-col items-start border-b border-r last:border-r-0 md:border-b-0 ${borderClass}`}
      style={{ paddingLeft: `${2 * escala}rem`, paddingRight: `${2 * escala}rem`, paddingTop: `${2 * escala}rem`, paddingBottom: `${2 * escala}rem` }}>
      {Icon && <Icon size={iconSize} style={{ color: iconColor, marginBottom: `${0.5 * escala}rem` }} />}
      <span className="font-bold tracking-tight"
        style={{ color: tc, fontSize: valorFontSize, marginBottom: `${0.5 * escala}rem` }}>
        {display}
      </span>
      <span className="uppercase tracking-widest font-semibold" style={{ color: `${tc}b3`, fontSize: labelFontSize }}>{label}</span>
    </motion.div>
  );
}

function SeccionStatsBarra({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const stats: { valor: string; label: string; icono?: string }[] = datos.stats ?? [
    { valor: '1200+', label: 'Mates entregados', icono: 'Truck' },
    { valor: '98%', label: 'Clientes satisfechos', icono: 'BadgeCheck' },
    { valor: '48hs', label: 'Tiempo de entrega', icono: 'Clock' },
    { valor: '5★', label: 'Calificación', icono: 'Star' },
  ];
  if (stats.length === 0) return null;

  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  // El fondo determina si el borde/línea divisoria queda clara u oscura
  // (contraste contra bg); el color de TEXTO ya no depende de esto — usa
  // siempre texto_color heredado (bugfix: antes hardcodeaba text-white/black).
  const bgEsClaro = bg === '#ffffff' || bg === '#f9f9f9' || bg === '#f8f8f8';
  const borderClass = bgEsClaro ? 'border-black/[0.06]' : 'border-white/[0.07]';
  // No tenía padding de sección históricamente (el alto venía solo del
  // padding de cada item) — se aplica solo si el admin lo configuró.
  const padding = paddingVertical(datos.padding, [2, 2], 'md');
  // Ícono: color propio configurable (datos.icon_color), default heredado
  // de texto_color del bloque — mismo mecanismo que accent_color en
  // categorias_grid/productos_destacados (campo escalar simple).
  const iconColor = datos.icon_color || tc;
  // Escala general del bloque completo: multiplicador proporcional sobre
  // número/label/ícono/padding — sin mínimo hardcodeado, default 1
  // reproduce exacto el tamaño histórico.
  const escala = datos.escala ?? 1;
  // Grid adaptable a la cantidad real de items (2, 3, 4, 5+) — mismo
  // criterio que categorias_grid: en mobile 1 columna si hay un solo item,
  // si no 2; en desktop tantas columnas como estadísticas haya.
  const colsMobile = stats.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const colsDesktop = COL_CLASS[stats.length] ?? 'md:grid-cols-4';

  return (
    <section className={`w-full border-y ${bgEsClaro ? 'border-black/[0.05]' : 'border-white/10'} flex items-center`}
      style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <motion.div className={`max-w-6xl mx-auto grid ${colsMobile} ${colsDesktop} w-full`}
        initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
        {stats.map((s, i) => (
          <StatItem key={i} index={i} valor={s.valor} label={s.label}
            icono={s.icono || STAT_ICON_FALLBACK[i % STAT_ICON_FALLBACK.length]}
            tc={tc} iconColor={iconColor} borderClass={borderClass} escala={escala} />
        ))}
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CATEGORÍAS GRID
// ─────────────────────────────────────────────────────────────────────────────
const ICONOS_FALLBACK = ['☕','🍃','✨','🎁','⚡','🪵','🔥','💫','🧉','🪄','🎨','📦'];
interface CatItem { id: number; icono: string; imagen_url?: string; titulo?: string; link?: string }

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
  type Entry = { cat: Categoria; icono: string; imagen_url?: string; titulo?: string; link?: string };

  let entries: Entry[];
  if (items.length > 0) {
    entries = items.map((item, i) => ({
      cat: todasPlanas.find(c => c.id === item.id)!,
      icono: item.icono || ICONOS_FALLBACK[i % ICONOS_FALLBACK.length],
      imagen_url: item.imagen_url,
      titulo: item.titulo,
      link: item.link,
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
  // card. Se resuelve con clamp() (fontSizeClampItem, compartida con
  // productos_destacados) para que se achique en pantallas/columnas angostas
  // sin perder el tamaño elegido en desktop, más line-clamp-2 como red de
  // seguridad final para nombres extremadamente largos.
  const itemTituloFontSize = fontSizeClampItem(datos.item_titulo_size, 'sm');
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
              incompleta sin huecos grises (no hay celdas "vacías" que pintar).
              Mobile (< sm): carrusel horizontal con scroll-snap — cada card
              al 72% del viewport para que se asome la siguiente y sea
              evidente que hay más contenido a los costados. Desde sm: vuelve
              al grid de siempre, sin tocar el comportamiento desktop. */}
          <div className={`flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-8 px-8 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none ${COL_CLASS[datos.columnas ?? 4] ?? 'md:grid-cols-4'}`}>
            {entries.map(({ cat, icono, imagen_url, titulo, link }, i) => (
              <motion.div key={cat.id} variants={FADE_UP} transition={{ ...T, delay: i * 0.05 }}
                className="w-[72%] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:snap-none">
                <Link to={link || `/productos?categoria_id=${cat.id}`}
                  className="group relative block w-full overflow-hidden rounded-xl"
                  style={{ aspectRatio: '4 / 5' }}>
                  {imagen_url ? (
                    <ImagenConOverlay src={imagen_url} alt={titulo || cat.nombre} />
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
                    <div className="font-semibold text-[#FAF7F3] mb-0.5 leading-tight line-clamp-2" style={{ fontSize: itemTituloFontSize }}>{titulo || cat.nombre}</div>
                    <LinkAcentoConSubrayado color={accentColor} fontSize={itemLinkFontSize}>
                      Ver productos <ArrowRight size={10} />
                    </LinkAcentoConSubrayado>
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
  // Mismo lenguaje visual que categorias_grid: overlay + acento + tamaños
  // configurables por elemento (nombre del producto / precio-CTA), para no
  // repetir el bug de texto sin control de tamaño.
  const accentColor = datos.accent_color || tema.accent_color;
  const itemTituloFontSize = fontSizeClampItem(datos.item_titulo_size, 'sm');
  const itemLinkFontSize = SIZE_REM[datos.item_link_size || 'xs'];
  // layout "carrusel" (default, look histórico): cards overlay con scroll
  // horizontal en mobile. layout "grid": cards tipo catálogo (imagen arriba,
  // texto debajo, badge de descuento arriba a la derecha), siempre 2
  // columnas fijas sin scroll — para tener ambos estilos disponibles y
  // poder combinar dos bloques de productos_destacados, uno de cada tipo.
  const esCarrusel = (datos.layout || 'carrusel') === 'carrusel';

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
          variant={esCarrusel ? 'overlay' : 'grid'}
          scroll={esCarrusel}
          accentColor={accentColor}
          tituloFontSize={itemTituloFontSize}
          linkFontSize={itemLinkFontSize}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CÓMO FUNCIONA
// ─────────────────────────────────────────────────────────────────────────────
const PASOS_DEFAULT = [
  { icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' },
  { icono: 'CheckCircle2', titulo: 'Aprobás el arte', desc: 'Te enviamos una previsualización del grabado para tu visto bueno.' },
  { icono: 'Zap', titulo: 'Grabamos tu pieza', desc: 'Láser de precisión sobre acero inoxidable, madera o acrílico.' },
  { icono: 'Package', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real.' },
];

function SeccionComoFunciona({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const pasos: { icono?: string; titulo: string; desc: string }[] = datos.pasos ?? PASOS_DEFAULT;
  // Bugfix: padding/alineación se guardaban pero nunca se leían.
  const padding = paddingVertical(datos.padding, [5, 7], 'md');
  // Bugfix: el subtítulo ya existía en TIPO_DEFAULTS y en el editor, pero
  // nunca se renderizaba. Su color/tipografía heredan del bloque (Subtítulo
  // → Bloque → Tema) con el mismo mecanismo que el resto de la cadena.
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  // Acento del ícono/línea conectora: Bloque (datos.accent_color) → Tema —
  // mismo mecanismo escalar simple que categorias_grid/productos_destacados.
  const accentColor = datos.accent_color || tema.accent_color;
  // Bugfix: el eyebrow "Proceso" estaba hardcodeado en el JSX, sin ningún
  // campo detrás. Mismo campo/mecanismo que el eyebrow del Hero: opcional,
  // si no se configura no se renderiza nada (nunca un valor por defecto
  // inventado).
  const eyebrow = datos.eyebrow;
  // Bugfix: la separación título → subtítulo estaba fija en "mb-2" (0.5rem)
  // sin ningún control — mismo mecanismo de escala que el resto de los
  // espaciados verticales del sitio (paddingVertical/gapVertical), default
  // reproduce ese 0.5rem histórico.
  const gapTituloSubtitulo = gapVertical(datos.titulo_subtitulo_gap, 0.5, 'sm');

  return (
    <section className="w-full px-8 py-20 md:py-28 flex items-center" style={{ backgroundColor: bg, color: tc, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER} style={{ textAlign: datos.alineacion || undefined }}>
          {eyebrow && <SectionLabel light>{eyebrow}</SectionLabel>}
          <div className="mb-16">
            <motion.h2 variants={FADE_UP} transition={T}
              className="text-2xl md:text-3xl font-bold tracking-tight"
              style={{ marginBottom: datos.subtitulo ? gapTituloSubtitulo : undefined }}>
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

          {/* Bugfix: el ícono de cada paso se guardaba (emoji, editable en
              el admin) pero nunca se renderizaba. Ahora usa la misma
              librería lucide-react que stats_barra (STAT_ICONS), con
              fallback por posición si el paso no tiene ícono propio. */}
          <div className="relative">
            {/* Línea conectora sutil en acento — solo desktop, detrás de las burbujas de ícono */}
            <div className="hidden md:block absolute left-0 right-0 h-px" style={{ top: '1.375rem', backgroundColor: `${accentColor}30` }} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {pasos.map((paso, i) => {
                const Icon = STAT_ICONS[paso.icono || ''] ?? STAT_ICONS[PASO_ICON_FALLBACK[i % PASO_ICON_FALLBACK.length]];
                return (
                  <motion.div key={i} variants={FADE_UP} transition={{ ...T, delay: i * 0.1 }}
                    className="group relative rounded-xl p-6 border transition-transform duration-300 ease-out hover:-translate-y-1"
                    style={{ backgroundColor: `${tc}08`, borderColor: `${tc}12` }}>
                    <span className="absolute top-4 right-4 text-[11px] font-bold tracking-wide" style={{ color: `${tc}35` }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="relative z-10 w-11 h-11 rounded-full flex items-center justify-center mb-4"
                      style={{ backgroundColor: accentColor }}>
                      <Icon size={20} color="#fff" className="transition-transform duration-300 ease-out group-hover:scale-110" />
                    </div>
                    <div className="text-sm font-bold mb-2" style={{ color: tc }}>{paso.titulo}</div>
                    <div className="text-xs leading-relaxed" style={{ color: `${tc}70` }}>{paso.desc}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GALERÍA DE COMBOS — combos armados a través del configurador "Diseñá tu
// mate" v2 (combo_id, Fase 5), agrupados por el backend en
// GET /configurador/galeria-combos. Reusa el mismo lenguaje visual y los
// mismos componentes que categorias_grid/productos_destacados
// (ImagenConOverlay/LinkAcentoConSubrayado/CardOverlay.tsx) — nada nuevo
// acá. Mientras no haya combos reales de clientes, el backend completa con
// combos "de ejemplo" cargados por el admin (es_ejemplo_admin: true),
// mostrados exactamente igual pero sin contarse como uso real.
// ─────────────────────────────────────────────────────────────────────────────
interface Combo {
  id: string; es_ejemplo_admin: boolean; producto_id: string; variante_id: string | null;
  producto_nombre: string; mate_imagen: string | null;
  bombilla_producto_id: string | null; bombilla_imagen: string | null;
  grabado_texto: string | null; anclaje: Anclaje | null;
}

function SeccionGaleriaCombos({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const cantidad = datos.cantidad || 6;
  const { data: combos = [] } = useQuery<Combo[]>({
    queryKey: ['galeria-combos', cantidad],
    queryFn: () => api.get(`/configurador/galeria-combos?limit=${cantidad}`).then(r => r.data),
  });

  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const escalaTitulo = escalaTamano(datos.titulo_size);
  const tituloFontSize = `clamp(${1.5 * escalaTitulo}rem, ${3 * escalaTitulo}vw, ${1.875 * escalaTitulo}rem)`;
  const padding = paddingVertical(datos.padding, [4, 5], 'md');
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  const accentColor = datos.accent_color || tema.accent_color;
  const itemTituloFontSize = fontSizeClampItem(datos.item_titulo_size, 'sm');
  const itemLinkFontSize = SIZE_REM[datos.item_link_size || 'xs'];

  if (combos.length === 0) return null;

  return (
    <section className="w-full px-8 py-16 md:py-20 flex items-center" style={{ backgroundColor: bg, fontFamily, minHeight, ...padding }}>
      <div className="max-w-6xl mx-auto w-full">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
          {datos.titulo && (
            <div style={{ textAlign: datos.alineacion || undefined }} className="mb-10">
              <SectionLabel>Inspiración</SectionLabel>
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

          {/* Mismo patrón de carrusel mobile que categorias_grid — ver
              comentario ahí para el detalle del breakpoint sm. */}
          <div className={`flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-8 px-8 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none ${COL_CLASS[combos.length] ?? 'md:grid-cols-4'}`}>
            {combos.map((combo, i) => (
              <motion.div key={combo.id} variants={FADE_UP} transition={{ ...T, delay: i * 0.05 }}
                className="w-[72%] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:snap-none">
                <Link to={`/disena-tu-mate-v2?combo=${combo.id}`}
                  className="group relative block w-full overflow-hidden rounded-xl"
                  style={{ aspectRatio: '4 / 5' }}>
                  {combo.mate_imagen ? (
                    <ComboImagenConOverlay mateImg={combo.mate_imagen} bombillaImg={combo.bombilla_imagen} anclaje={combo.anclaje} alt={combo.producto_nombre} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/[0.04]">
                      <span className="text-5xl">🧉</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="font-semibold text-[#FAF7F3] mb-0.5 leading-tight line-clamp-2" style={{ fontSize: itemTituloFontSize }}>
                      {combo.producto_nombre}
                    </div>
                    {combo.grabado_texto && (
                      <div className="text-[11px] text-[#FAF7F3]/70 italic mb-1 line-clamp-1">"{combo.grabado_texto}"</div>
                    )}
                    <LinkAcentoConSubrayado color={accentColor} fontSize={itemLinkFontSize}>
                      Armá el tuyo <ArrowRight size={10} />
                    </LinkAcentoConSubrayado>
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
                {boton.texto} <ArrowRight size={14} />
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
// 7b. NEWSLETTER
// ─────────────────────────────────────────────────────────────────────────────
function SeccionNewsletter({ datos, tema }: { datos: Record<string, any>; tema: TemaGlobal }) {
  const { bg, tc, fontFamily, minHeight } = estiloHeredado(datos, tema);
  const padding = paddingVertical(datos.padding, [4, 5], 'md');
  const subtitulo = heredaDeBloque({ texto_color: datos.subtitulo_color, font_family: datos.subtitulo_font_family }, { bg, tc, fontFamily });
  const btn = heredaDeBloque({ bg_color: datos.btn_color, texto_color: datos.btn_texto_color }, { bg: tc, tc: bg, fontFamily });

  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'pendiente' | 'ya_suscripto' | 'error'>('idle');
  // Cooldown del botón "reenviármelo" — evita golpear un mail ajeno.
  const [reenvioCooldown, setReenvioCooldown] = useState(0);

  useEffect(() => {
    if (reenvioCooldown <= 0) return;
    const t = setTimeout(() => setReenvioCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioCooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (estado === 'cargando') return;
    setEstado('cargando');
    try {
      const { data } = await api.post('/newsletter/suscribir', { email, origen: 'newsletter' });
      setEstado(data?.estado === 'ya_suscripto' ? 'ya_suscripto' : 'pendiente');
    } catch {
      setEstado('error');
    }
  };

  const reenviar = async () => {
    if (reenvioCooldown > 0) return;
    setReenvioCooldown(60);
    try {
      await api.post('/newsletter/reenviar', { email });
    } catch {
      /* respuesta genérica del backend igual — no mostramos error acá */
    }
  };

  const reintentar = () => {
    setEstado('idle');
    setEmail('');
  };

  return (
    <section className="w-full px-8" style={{ backgroundColor: bg, color: tc, fontFamily, minHeight, ...padding }}>
      <motion.div className="max-w-xl mx-auto flex flex-col items-center text-center gap-4"
        style={{ textAlign: datos.alineacion || 'center' }}
        initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
        <motion.h2 variants={FADE_UP} transition={T} className="font-bold text-2xl md:text-3xl tracking-tight">
          {datos.titulo || 'Sumate a la comunidad'}
        </motion.h2>
        {datos.subtitulo && (
          <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.1 }} className="text-sm max-w-sm"
            style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
            {datos.subtitulo}
          </motion.p>
        )}
        {estado === 'pendiente' ? (
          <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.15 }}
            className="w-full max-w-md mt-2 flex flex-col items-center gap-2">
            <p className="text-sm" style={{ color: subtitulo.tc, fontFamily: subtitulo.fontFamily }}>
              Casi listo. Te mandamos un mail a <strong>{email}</strong> para confirmar tu suscripción.
              Revisá también spam o la pestaña Promociones.
            </p>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={reenviar} disabled={reenvioCooldown > 0}
                className="underline hover:opacity-80 disabled:opacity-50 disabled:no-underline">
                {reenvioCooldown > 0 ? `Reenviar en 0:${String(reenvioCooldown).padStart(2, '0')}` : 'Reenviármelo'}
              </button>
              <button type="button" onClick={reintentar} className="underline hover:opacity-80">
                Me equivoqué de mail
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.form variants={FADE_UP} transition={{ ...T, delay: 0.15 }} onSubmit={submit}
              className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder={datos.placeholder || 'Tu email'}
                className="flex-1 px-4 py-3 text-sm rounded-lg border focus:outline-none"
                style={{ borderColor: `${tc}25`, color: tc, backgroundColor: `${tc}08` }} />
              <button type="submit" disabled={estado === 'cargando'}
                className="px-6 py-3 text-sm font-bold rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: btn.bg, color: btn.tc, fontFamily: btn.fontFamily }}>
                {datos.btn_texto || 'Suscribirme'}
              </button>
            </motion.form>
            {(estado === 'ya_suscripto' || estado === 'error') && (
              <p className="text-xs" style={{ color: estado === 'error' ? '#e05252' : subtitulo.tc }}>
                {estado === 'ya_suscripto' ? 'Ese mail ya está en la lista 🧉' : 'No pudimos suscribirte, intentá de nuevo.'}
              </p>
            )}
          </>
        )}
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
        <img key={img.id} src={img.url} alt="" draggable={false} loading="lazy"
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
    case 'newsletter':           return <SeccionNewsletter key={sec.id} datos={sec.datos} tema={tema} />;
    case 'banner_imagen':        return <SeccionBannerImagen key={sec.id} datos={sec.datos} />;
    case 'texto_libre':          return <SeccionTextoLibre key={sec.id} datos={sec.datos} tema={tema} />;
    case 'filtros_rapidos':      return <SeccionFiltrosRapidos key={sec.id} datos={sec.datos} tema={tema} />;
    case 'galeria_combos':       return <SeccionGaleriaCombos key={sec.id} datos={sec.datos} tema={tema} />;
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
      {secciones.map((sec, i) => {
        // Transición inferior: se pinta con el color propio del bloque
        // (mismo estiloHeredado que ya resuelve bg/tc para el bloque),
        // extendida sobre el bloque siguiente — por eso el z-index
        // explícito y descendente: sin esto, el bloque siguiente (más
        // abajo en el DOM) pintaría encima y la transición quedaría oculta.
        const { bg } = estiloHeredado(sec.datos, tema);
        return (
          <div key={sec.id} className="relative" style={{ zIndex: secciones.length - i }}>
            {renderSeccion(sec, tema)}
            <ImagenesLibres imagenes={sec.datos.imagenes} />
            <TransicionInferior tipo={sec.datos.transicion_inferior} color={bg} />
          </div>
        );
      })}
    </div>
  );
}

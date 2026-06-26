import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import type { Producto, Categoria } from '../types/index';
import ProductGrid from '../components/ui/ProductGrid';

// ── tipado ────────────────────────────────────────────────────────────────────
interface Seccion {
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
function useFonts(secciones: Seccion[]) {
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
  titulo: string; subtitulo?: string; imagen_url?: string;
  btn_texto?: string; btn_link?: string; btn2_texto?: string; btn2_link?: string;
  bg_color?: string; texto_color?: string;
}

function HeroSlideContent({ slide, dir }: { slide: HeroSlide; dir: number }) {
  const bg = slide.bg_color || '#0a0a0a';
  const tc = slide.texto_color || '#ffffff';
  const titulo = slide.titulo || 'Mates únicos,\nhechos a tu medida';
  const lineas = titulo.split('\n');
  const tieneImagen = !!slide.imagen_url;

  const enter = { opacity: 0, x: dir > 0 ? 48 : -48 };
  const exit  = { opacity: 0, x: dir > 0 ? -48 : 48 };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col md:flex-row overflow-hidden"
      style={{ backgroundColor: bg, color: tc }}
      initial={enter} animate={{ opacity: 1, x: 0 }} exit={exit}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Texto */}
      <motion.div
        className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20 z-10"
        initial="hidden" animate="visible" variants={STAGGER}
      >
        <SectionLabel light>Grabado láser de precisión</SectionLabel>

        <h1 className="font-bold leading-[1.04] tracking-tight mb-6"
          style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}>
          {lineas.map((linea, li) => (
            <motion.span key={li} className="block" variants={FADE_UP}
              transition={{ ...T, delay: li * 0.1 }}
              style={{ color: li === lineas.length - 1 ? `${tc}44` : tc }}>
              {linea}
            </motion.span>
          ))}
        </h1>

        <motion.p variants={FADE_UP} transition={{ ...T, delay: 0.2 }}
          className="text-sm leading-relaxed mb-10 max-w-xs"
          style={{ color: `${tc}60` }}>
          {slide.subtitulo || 'Personalizamos cada pieza con tu diseño.'}
        </motion.p>

        <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.3 }} className="flex flex-wrap gap-3">
          <Link to={slide.btn_link || '/productos'}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: tc, color: bg }}>
            {slide.btn_texto || 'Ver colección'} <ArrowRight size={14} />
          </Link>
          {slide.btn2_link && (
            <Link to={slide.btn2_link}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium border transition-opacity hover:opacity-60"
              style={{ borderColor: `${tc}25`, color: `${tc}70` }}>
              {slide.btn2_texto || 'Cómo funciona'}
            </Link>
          )}
        </motion.div>
      </motion.div>

      {/* Imagen */}
      {tieneImagen && (
        <div className="relative md:w-[52%] min-h-[45vh] md:min-h-full overflow-hidden flex-shrink-0">
          <motion.img
            key={slide.imagen_url}
            src={slide.imagen_url} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.05 }} animate={{ scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {/* Blend lateral */}
          <div className="absolute inset-y-0 left-0 w-32 pointer-events-none"
            style={{ background: `linear-gradient(to right, ${bg}, transparent)` }} />
        </div>
      )}

      {/* Sin imagen: gran número decorativo */}
      {!tieneImagen && (
        <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:flex items-center justify-end pr-16 pointer-events-none select-none overflow-hidden">
          <span className="text-[18rem] font-black leading-none"
            style={{ color: `${tc}06`, letterSpacing: '-0.06em' }}>01</span>
        </div>
      )}
    </motion.div>
  );
}

function SeccionHero({ datos }: { datos: Record<string, any> }) {
  const slides: HeroSlide[] = datos.slides?.length
    ? datos.slides
    : [{ titulo: datos.titulo, subtitulo: datos.subtitulo, imagen_url: datos.imagen_url,
         btn_texto: datos.btn_texto, btn_link: datos.btn_link,
         btn2_texto: datos.btn2_texto, btn2_link: datos.btn2_link,
         bg_color: datos.bg_color, texto_color: datos.texto_color }];

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

  const tc = slides[current].texto_color || '#ffffff';

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: '90vh' }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      <AnimatePresence mode="sync">
        <HeroSlideContent key={current} slide={slides[current]} dir={dir} />
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
function SeccionBannerTexto({ datos }: { datos: Record<string, any> }) {
  const bg = datos.bg_color || '#0a0a0a';
  const tc = datos.texto_color || '#ffffff';
  const texto = datos.texto || '';

  if (datos.marquee) {
    return (
      <div className="w-full overflow-hidden py-2.5 border-y"
        style={{ backgroundColor: bg, borderColor: `${tc}12` }}>
        <motion.div className="flex whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}>
          {[...Array(12)].map((_, i) => (
            <span key={i} className="flex items-center text-[11px] font-medium tracking-widest uppercase px-8"
              style={{ color: `${tc}60` }}>
              {texto}
              <span className="mx-8" style={{ color: `${tc}20` }}>—</span>
            </span>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.section className="w-full px-8 py-5"
      style={{ backgroundColor: bg || '#f9f9f9' }}
      initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={FADE}>
      <div className="max-w-6xl mx-auto flex items-center gap-6">
        <div className="h-px flex-1" style={{ backgroundColor: tc || '#111', opacity: 0.1 }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-center"
          style={{ color: tc || '#111', opacity: 0.5 }}>
          {texto}
        </p>
        <div className="h-px flex-1" style={{ backgroundColor: tc || '#111', opacity: 0.1 }} />
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATS
// ─────────────────────────────────────────────────────────────────────────────
function StatItem({ valor, label }: { valor: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const display = useCountUp(valor, inView);
  return (
    <div ref={ref} className="flex flex-col items-start px-8 py-8 border-b border-r border-black/[0.06] last:border-r-0">
      <motion.span className="text-4xl md:text-5xl font-bold tracking-tight mb-2 text-black"
        initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={T}>
        {display}
      </motion.span>
      <span className="text-[10px] uppercase tracking-widest text-black/40 font-medium">{label}</span>
    </div>
  );
}

function SeccionStatsBarra({ datos }: { datos: Record<string, any> }) {
  const stats: { valor: string; label: string }[] = datos.stats ?? [
    { valor: '1200+', label: 'Mates entregados' },
    { valor: '98%', label: 'Clientes satisfechos' },
    { valor: '48hs', label: 'Tiempo de entrega' },
    { valor: '5★', label: 'Calificación' },
  ];

  const bg = datos.bg_color || '#ffffff';
  const dark = bg === '#ffffff' || bg === '#f9f9f9' || bg === '#f8f8f8';

  if (!dark) {
    // Versión oscura
    return (
      <section className="w-full border-y border-white/10" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="px-8 py-8 border-b border-r border-white/[0.07] md:border-b-0 last:border-r-0">
              <div className="text-4xl md:text-5xl font-bold tracking-tight mb-2 text-white">{s.valor}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-white border-y border-black/[0.05]">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => <StatItem key={i} valor={s.valor} label={s.label} />)}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CATEGORÍAS GRID
// ─────────────────────────────────────────────────────────────────────────────
const ICONOS_FALLBACK = ['☕','🍃','✨','🎁','⚡','🪵','🔥','💫','🧉','🪄','🎨','📦'];
interface CatItem { id: number; icono: string }

function SeccionCategoriasGrid({ datos }: { datos: Record<string, any> }) {
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
  type Entry = { cat: Categoria; icono: string };

  let entries: Entry[];
  if (items.length > 0) {
    entries = items.map((item, i) => ({
      cat: todasPlanas.find(c => c.id === item.id)!,
      icono: item.icono || ICONOS_FALLBACK[i % ICONOS_FALLBACK.length],
    })).filter(e => !!e.cat);
  } else if (idsFallback.length > 0) {
    entries = todasCategorias.filter(c => idsFallback.includes(c.id))
      .map((cat, i) => ({ cat, icono: ICONOS_FALLBACK[i % ICONOS_FALLBACK.length] }));
  } else {
    entries = todasCategorias.filter(c => !c.padre_id)
      .map((cat, i) => ({ cat, icono: ICONOS_FALLBACK[i % ICONOS_FALLBACK.length] }));
  }

  const bg = datos.bg_color || '#f9f9f9';

  return (
    <section className="w-full px-8 py-16 md:py-20" style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
          {datos.titulo && (
            <>
              <SectionLabel>Categorías</SectionLabel>
              <motion.h2 variants={FADE_UP} transition={T}
                className="text-2xl md:text-3xl font-bold tracking-tight text-black mb-10">
                {datos.titulo}
              </motion.h2>
            </>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/[0.06]">
            {entries.map(({ cat, icono }, i) => (
              <motion.div key={cat.id} variants={FADE_UP} transition={{ ...T, delay: i * 0.05 }}>
                <Link to={`/productos?categoria_id=${cat.id}`}
                  className="group flex flex-col gap-3 bg-white p-6 transition-colors hover:bg-black hover:text-white">
                  <span className="text-2xl transition-transform duration-300 group-hover:scale-105 inline-block">
                    {icono}
                  </span>
                  <div>
                    <div className="text-sm font-semibold mb-0.5">{cat.nombre}</div>
                    <div className="flex items-center gap-1 text-[11px] text-black/30 group-hover:text-white/50 transition-colors">
                      Ver productos <ArrowRight size={10} />
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
function SeccionProductosDestacados({ datos }: { datos: Record<string, any> }) {
  const agregar = useCarritoStore(s => s.agregar);
  const cantidad = datos.cantidad || 8;
  const ids: string[] = datos.productos_ids ?? [];
  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['productos-seccion', ids.length > 0 ? ids.join(',') : `destacado-${cantidad}`],
    queryFn: () => ids.length > 0
      ? api.get(`/productos?ids=${ids.join(',')}`).then(r => r.data.data)
      : api.get(`/productos?destacado=true&limit=${cantidad}`).then(r => r.data.data),
  });

  const handleAgregar = (p: Producto) =>
    agregar({ producto_id: p.id, nombre_producto: p.nombre, precio_unitario: Number(p.precio_base), cantidad: 1,
      imagen_url: p.imagenes_producto?.[0]?.url });

  const bg = datos.bg_color || '#ffffff';

  return (
    <section className="w-full px-8 py-16 md:py-20" style={{ backgroundColor: bg }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}
          className="flex items-end justify-between mb-10">
          <div>
            <SectionLabel>Colección</SectionLabel>
            <motion.h2 variants={FADE_UP} transition={T}
              className="text-2xl md:text-3xl font-bold tracking-tight text-black">
              {datos.titulo || 'Más vendidos'}
            </motion.h2>
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

function SeccionComoFunciona({ datos }: { datos: Record<string, any> }) {
  const bg = datos.bg_color || '#0a0a0a';
  const tc = datos.texto_color || '#ffffff';
  const pasos: { icono: string; titulo: string; desc: string }[] = datos.pasos ?? PASOS_DEFAULT;

  return (
    <section className="w-full px-8 py-20 md:py-28" style={{ backgroundColor: bg, color: tc }}>
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}>
          <SectionLabel light>Proceso</SectionLabel>
          <motion.h2 variants={FADE_UP} transition={T}
            className="text-2xl md:text-3xl font-bold tracking-tight mb-16">
            {datos.titulo || '¿Cómo funciona?'}
          </motion.h2>

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
function SeccionCtaBanner({ datos }: { datos: Record<string, any> }) {
  const bg = datos.bg_color || '#0a0a0a';
  const tc = datos.texto_color || '#ffffff';

  return (
    <section className="w-full px-8 py-8" style={{ backgroundColor: datos.outer_bg || '#f9f9f9' }}>
      <motion.div
        className="max-w-6xl mx-auto relative overflow-hidden px-10 md:px-20 py-20 md:py-28 flex flex-col md:flex-row items-start md:items-end justify-between gap-10"
        style={{ backgroundColor: bg, color: tc }}
        initial="hidden" whileInView="visible" viewport={VIEWPORT} variants={STAGGER}
      >
        {/* Texto */}
        <div className="flex-1">
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
              className="text-sm mt-4 max-w-sm" style={{ color: `${tc}50` }}>
              {datos.subtitulo}
            </motion.p>
          )}
        </div>

        {/* Botones */}
        <motion.div variants={FADE_UP} transition={{ ...T, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <Link to={datos.btn_link || '/productos'}
            className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: tc, color: bg }}>
            {datos.btn_texto || 'Ver colección'} <ArrowRight size={14} />
          </Link>
          {datos.btn2_link && (
            <Link to={datos.btn2_link}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-medium border transition-opacity hover:opacity-60"
              style={{ borderColor: `${tc}25`, color: `${tc}70` }}>
              {datos.btn2_texto}
            </Link>
          )}
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
function SeccionBannerImagen({ datos }: { datos: Record<string, any> }) {
  if (!datos.imagen_url) return null;
  const img = (
    <motion.img src={datos.imagen_url} alt=""
      className="w-full object-cover"
      style={{ maxHeight: datos.max_height ? `${datos.max_height}px` : '380px' }}
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEWPORT} transition={T} />
  );
  return (
    <section className="w-full px-8 py-6">
      <div className="max-w-6xl mx-auto overflow-hidden">
        {datos.link ? <Link to={datos.link}>{img}</Link> : img}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TEXTO LIBRE
// ─────────────────────────────────────────────────────────────────────────────
function SeccionTextoLibre({ datos }: { datos: Record<string, any> }) {
  return (
    <section className="w-full px-8 py-12 md:py-16" style={{ backgroundColor: datos.bg_color || '#ffffff' }}>
      <div className="max-w-3xl mx-auto prose prose-sm max-w-none text-black/80"
        dangerouslySetInnerHTML={{ __html: datos.html || '' }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function renderSeccion(sec: Seccion) {
  switch (sec.tipo) {
    case 'hero':                 return <SeccionHero key={sec.id} datos={sec.datos} />;
    case 'banner_texto':         return <SeccionBannerTexto key={sec.id} datos={sec.datos} />;
    case 'stats_barra':          return <SeccionStatsBarra key={sec.id} datos={sec.datos} />;
    case 'categorias_grid':      return <SeccionCategoriasGrid key={sec.id} datos={sec.datos} />;
    case 'productos_destacados': return <SeccionProductosDestacados key={sec.id} datos={sec.datos} />;
    case 'como_funciona':        return <SeccionComoFunciona key={sec.id} datos={sec.datos} />;
    case 'cta_banner':           return <SeccionCtaBanner key={sec.id} datos={sec.datos} />;
    case 'banner_imagen':        return <SeccionBannerImagen key={sec.id} datos={sec.datos} />;
    case 'texto_libre':          return <SeccionTextoLibre key={sec.id} datos={sec.datos} />;
    default:                     return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// raíz
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: secciones, isLoading } = useQuery<Seccion[]>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/configuracion/homepage').then(r => r.data),
  });

  useFonts(secciones ?? []);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        className="w-6 h-6 border border-black border-t-transparent rounded-full"
      />
    </div>
  );

  const activas = (secciones ?? []).filter(s => s.activo);
  return <div className="flex flex-col">{activas.map(sec => renderSeccion(sec))}</div>;
}

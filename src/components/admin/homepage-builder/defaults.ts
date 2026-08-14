import type { TipoSeccion, HeroSlide } from './types';

// Links del navbar — mismos defaults que ya usa el sitio público
// (DEFAULT_LINKS en Navbar.tsx) para que la migración no cambie nada.
export const NAV_LINKS_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Personalizado', href: '/productos?personalizado=true' },
  { label: 'Nosotros', href: '/#nosotros' },
];

// Defaults del footer — calcados de lo que hoy está hardcodeado en
// Footer.tsx, para que la migración a sección no cambie nada visualmente
// hasta que el admin edite algo.
export const FOOTER_REDES_DEFAULT = [
  { label: '@matelaserstudio', href: 'https://instagram.com/matelaserstudio' },
];
export const FOOTER_TAGLINE_DEFAULT = 'Grabado láser personalizado · Todo Argentina';
export const FOOTER_COPYRIGHT_DEFAULT = '© 2025 Mate Laser Studio';
// Grupos de links del footer: Tienda / Ayuda / Legal, reemplazan el antiguo
// "links" plano + "links_legales" separado. "Seguimiento de pedido" queda
// afuera de Tienda por ahora — el dato de tracking no es consultable
// end-to-end todavía (ver auditoría de envíos).
export const FOOTER_GRUPO_TIENDA_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
];
export const FOOTER_GRUPO_AYUDA_DEFAULT = [
  { label: 'Preguntas frecuentes', href: '/faq' },
  { label: 'Envíos y devoluciones', href: '/envios-y-devoluciones' },
  { label: 'Contacto', href: '/#contacto' },
];
export const FOOTER_GRUPO_LEGAL_DEFAULT = [
  { label: 'Términos y condiciones', href: '/terminos' },
  { label: 'Política de privacidad', href: '/privacidad' },
];
export const METODOS_PAGO_DISPONIBLES = [
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'Amex' },
];
export const FOOTER_METODOS_PAGO_DEFAULT = ['mercadopago', 'visa', 'mastercard'];

export const TIPO_LABELS: Record<TipoSeccion, string> = {
  hero: 'Hero',
  banner_texto: 'Banner de texto',
  productos_destacados: 'Productos destacados',
  categorias_grid: 'Grilla de categorías',
  texto_libre: 'Texto libre (HTML)',
  banner_imagen: 'Banner imagen',
  stats_barra: 'Barra de estadísticas',
  como_funciona: 'Cómo funciona',
  cta_banner: 'CTA / Llamada a la acción',
  filtros_rapidos: 'Barra de filtros rápidos',
  galeria_combos: 'Galería de combos (configurador)',
  newsletter: 'Newsletter (suscripción por email)',
};

// Defaults de contenido + estilo por tipo
export const TIPO_DEFAULTS: Record<TipoSeccion, Record<string, any>> = {
  hero: {
    // El slide NO trae bg_color/texto_color propios: así hereda del bloque
    // (abajo) por defecto, y el bloque es lo que se edita en el tab Estilo.
    // Si se le pone color acá, el slide lo tapa y "Estilo" deja de tener
    // efecto — por eso el color va solo a nivel de bloque.
    slides: [
      { titulo: 'Mates únicos,\nhechos a tu medida', subtitulo: 'Diseño exclusivo para cada cliente.', imagen_url: '', btn_texto: 'Ver colección', btn_link: '/productos' },
    ],
    intervalo: 5,
    bg_color: '#111111', texto_color: '#ffffff',
  },
  banner_texto: {
    texto: '',
    bg_color: '#1D9E75', texto_color: '#ffffff',
    font_size: 'sm', font_weight: 'medium', alineacion: 'center', padding: 'sm',
  },
  productos_destacados: {
    titulo: 'Lo más vendido', cantidad: 8,
    bg_color: '#ffffff', texto_color: '#111111',
    titulo_size: 'lg', columnas: 3, padding: 'md', alineacion: 'left',
    layout: 'carrusel',
  },
  categorias_grid: {
    titulo: 'Categorías', categorias_items: [],
    bg_color: '#f9fafb', texto_color: '#111111',
    titulo_size: 'lg', columnas: 4, padding: 'md', alineacion: 'left',
  },
  texto_libre: {
    html: '',
    bg_color: '#ffffff', padding: 'md',
  },
  banner_imagen: {
    imagen_url: '', link: '',
    border_radius: 'xl', max_height: '300', padding: 'sm', object_fit: 'cover',
  },
  stats_barra: {
    stats: [
      { valor: '1200+', label: 'Mates entregados', icono: 'Truck' },
      { valor: '98%', label: 'Clientes satisfechos', icono: 'BadgeCheck' },
      { valor: '48hs', label: 'Tiempo de entrega', icono: 'Clock' },
      { valor: '5★', label: 'Calificación', icono: 'Star' },
    ],
    bg_color: '#1D9E75', texto_color: '#ffffff',
  },
  como_funciona: {
    titulo: '¿Cómo funciona?',
    subtitulo: 'En 4 simples pasos tenés tu mate personalizado',
    pasos: [
      { icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' },
      { icono: 'CheckCircle2', titulo: 'Aprobás el arte', desc: 'Te enviamos una previsualización del grabado para tu visto bueno.' },
      { icono: 'Zap', titulo: 'Grabamos tu pieza', desc: 'Láser de precisión sobre acero inoxidable, madera o acrílico.' },
      { icono: 'Package', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real.' },
    ],
    bg_color: '#0a2218', texto_color: '#ffffff',
  },
  cta_banner: {
    titulo: '¿Listo para personalizar tu mate?',
    subtitulo: 'Hablamos, diseñamos y grabamos. Sin límites de creatividad.',
    eyebrow: '¿Tenés una idea en mente?',
    btn_texto: 'Ver colección', btn_link: '/productos',
    bg_color: '#1D9E75', texto_color: '#ffffff',
  },
  filtros_rapidos: {
    items: [],
    bg_color: '#ffffff', texto_color: '#111111',
    padding: 'sm',
  },
  galeria_combos: {
    titulo: 'Inspirate con estos combos',
    subtitulo: 'Armados por otros clientes a través del configurador',
    cantidad: 6,
    bg_color: '#ffffff', texto_color: '#111111',
    titulo_size: 'lg', columnas: 4, padding: 'md', alineacion: 'left',
  },
  newsletter: {
    titulo: 'Sumate a la comunidad',
    subtitulo: 'Enterate primero de nuevos diseños y descuentos',
    placeholder: 'Tu email',
    btn_texto: 'Suscribirme',
    bg_color: '#1D9E75', texto_color: '#ffffff',
    padding: 'md', alineacion: 'center',
  },
};

// ── Selector de ícono: emojis default para la grilla de categorías ───────────
export const ICONOS_DEFAULT = ['☕', '🍃', '✨', '🎁', '⚡', '🪵', '🔥', '💫', '🧉', '🪄', '🎨', '📦'];

// Sin bg_color/texto_color: un slide nuevo hereda del bloque por defecto
// (ver comentario en TIPO_DEFAULTS.hero más arriba).
export const SLIDE_DEFAULT: HeroSlide = {
  titulo: 'Mates únicos,\nhechos a tu medida',
  subtitulo: 'Diseño exclusivo para cada cliente.',
  imagen_url: '',
  btn_texto: 'Ver colección',
  btn_link: '/productos',
};

// ── "Aplicar a todo" / "Aplicar" (tab Tema) ──────────────────────────────────
// Recorren toda la cadena de herencia (bloque → título/subtítulo → botón) y
// BORRAN la clave de override (no la dejan en '') para que ese elemento
// vuelva a heredar del nivel de arriba — nunca escriben el valor del tema
// como fijo, así si el tema cambia después, estos elementos lo siguen.
//
// 'todo': borra siempre, tenga o no override.
// 'solo_vacios': borra solo si el valor YA era falsy (undefined o '') — es
// decir, normaliza "sin override representado como ''" a "clave ausente",
// sin tocar nada que el admin haya personalizado a mano.
export const ESTILO_KEYS = ['bg_color', 'texto_color', 'font_family'];

export function limpiarClaves<T extends Record<string, any>>(obj: T, keys: string[], modo: 'todo' | 'solo_vacios'): T {
  const copia = { ...obj };
  for (const k of keys) {
    const yaVacio = !copia[k];
    if (modo === 'todo' || yaVacio) delete copia[k];
  }
  return copia;
}

export function limpiarBotones(botones: any, modo: 'todo' | 'solo_vacios') {
  if (!Array.isArray(botones)) return botones;
  return botones.map((b: any) => limpiarClaves(b, ESTILO_KEYS, modo));
}

export function limpiarDatosSeccion(datos: Record<string, any>, modo: 'todo' | 'solo_vacios'): Record<string, any> {
  // Bloque: bg_color/texto_color/font_family, más btn_color/btn_texto_color
  // (el nivel "Bloque" de la cadena para botones, mismos 3 campos con otro
  // nombre) y subtitulo_color/subtitulo_font_family (nivel Subtítulo).
  let d = limpiarClaves(datos, [...ESTILO_KEYS, 'btn_color', 'btn_texto_color'], modo);
  d = limpiarClaves(d, ['subtitulo_color', 'subtitulo_font_family'], modo);
  if (Array.isArray(d.botones)) d.botones = limpiarBotones(d.botones, modo);
  // Hero: cada slide es su propio nivel de Bloque para bg/texto, con sus
  // propios botones.
  if (Array.isArray(d.slides)) {
    d.slides = d.slides.map((s: any) => {
      const ns = limpiarClaves(s, ESTILO_KEYS, modo);
      if (Array.isArray(ns.botones)) ns.botones = limpiarBotones(ns.botones, modo);
      return ns;
    });
  }
  return d;
}

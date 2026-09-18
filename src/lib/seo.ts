// Helpers de SEO — puros (sin React ni import.meta.env) para poder testearlos
// desde e2e/seo-utils.spec.ts y, en la Fase 2, reusarlos del lado servidor.
//
// Por qué existe: el sitio es una SPA y hasta acá el <head> era el mismo para
// todas las URLs. Cada página arma acá su PageMeta y lo aplica usePageMeta.
// Las plantillas de title/description salen de la consulta con cm-marketing
// (2026-09-18): title ≤ 60, description ≤ 155, sin nombres de personas/marcas
// registradas (Messi, Maradona, Selección) en los titles.
import type { Producto } from '../types';

// Canónico fijo = dominio raíz (www responde 200 pero es duplicado; ver
// docs/seo.md). No se deriva de window.location a propósito: un preview o el
// host www no deben declararse a sí mismos como la versión canónica.
export const SITE_URL = 'https://matelaserstudio.com.ar';
export const SITE_NAME = 'Mate Laser Studio';

export const TITULO_HOME = `${SITE_NAME} | Mates grabados a láser en Buenos Aires`;
// Debe coincidir con <title>/<meta description> de index.html (lo verifica
// e2e/seo-utils.spec.ts): es lo que ven los crawlers que no ejecutan JS.
export const DESCRIPCION_HOME =
  'Taller de grabado láser en Buenos Aires: mates, bombillas y accesorios personalizados. Elegí un diseño o personalizalo. Envíos a todo el país.';

export const MAX_TITULO = 60;
export const MAX_DESCRIPCION = 155;

export interface PageMeta {
  title: string;
  description?: string;
  /** URL absoluta. Si no hay, la página no declara canonical. */
  canonical?: string;
  /** No combinar con canonical: son señales contradictorias para Google. */
  noindex?: boolean;
  /** URL absoluta https. */
  image?: string;
  ogType?: 'website' | 'product';
  jsonLd?: Record<string, unknown>[];
}

// ── Texto ────────────────────────────────────────────────────────────────

/** Corta en el último espacio antes de `max` y agrega "…". Nunca supera `max`. */
export function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const base = ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte;
  return `${base.replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Markdown/HTML → texto plano de una línea (para meta description y JSON-LD). */
export function aTextoPlano(md?: string | null): string {
  if (!md) return '';
  return md
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|\*|_|`|~~)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esTodoMayusculas(s: string): boolean {
  const letras = s.replace(/[^\p{L}]/gu, '');
  return letras.length > 3 && letras === letras.toUpperCase();
}

/**
 * Para usar en <title>: saca emojis y pasa "TODO EN MAYÚSCULAS" a oración
 * ("EL TALLER Y NOSOTROS ❤️" → "El taller y nosotros"). Los nombres del
 * catálogo/admin vienen tal cual los cargó el negocio.
 */
export function limpiarTituloSeo(titulo: string): string {
  const sinEmoji = titulo
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!esTodoMayusculas(sinEmoji)) return sinEmoji;
  const min = sinEmoji.toLowerCase();
  return min.charAt(0).toUpperCase() + min.slice(1);
}

/**
 * Devuelve el primer candidato que entra en 60 caracteres (pasarlos de más a
 * menos preferido: primero con marca, al final el núcleo). Si ninguno entra,
 * recorta el último — la marca se sacrifica antes que el nombre del producto.
 */
export function armarTitulo(...candidatos: string[]): string {
  for (const c of candidatos) if (c.length <= MAX_TITULO) return c;
  return recortar(candidatos[candidatos.length - 1], MAX_TITULO);
}

export function urlAbsoluta(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Escape para meter JSON-LD dentro de un <script> (uso servidor en Fase 2). */
export function serializarJsonLd(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

const esHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u);

// ── Metas por tipo de página ─────────────────────────────────────────────

export const metaHome = (): PageMeta => ({
  title: TITULO_HOME,
  description: DESCRIPCION_HOME,
  canonical: urlAbsoluta('/'),
  ogType: 'website',
});

export const metaCatalogo = (): PageMeta => ({
  title: armarTitulo(`Mates y bombillas con grabado láser | ${SITE_NAME}`),
  description:
    'Catálogo de mates, bombillas y accesorios con grabado láser. Elegí un diseño o personalizalo. Envíos a todo el país.',
  canonical: urlAbsoluta('/productos'),
  ogType: 'website',
});

/** conGrabado: que la categoría tenga al menos un producto apto para grabado — no prometemos láser donde no hay. */
export function metaCategoria(nombre: string, id: number | string, conGrabado: boolean): PageMeta {
  const n = limpiarTituloSeo(nombre);
  const sufijo = conGrabado ? ' con grabado láser' : '';
  return {
    title: armarTitulo(
      `${n}${sufijo} | ${SITE_NAME}`,
      `${n}${sufijo}`,
      `${n} | ${SITE_NAME}`,
      n,
    ),
    description: recortar(
      conGrabado
        ? `${n}: elegí un diseño o personalizalo con grabado láser en nuestro taller de Buenos Aires. Envíos a todo el país.`
        : `${n} de ${SITE_NAME}. Comprá online con envíos a todo el país.`,
      MAX_DESCRIPCION,
    ),
    canonical: urlAbsoluta(`/productos?categoria_id=${id}`),
    ogType: 'website',
  };
}

/** Resultados de búsqueda interna (?q=): no se indexan — duplican el catálogo. */
export const metaBusqueda = (): PageMeta => ({
  title: `Búsqueda | ${SITE_NAME}`,
  noindex: true,
});

export const metaNoEncontrado = (que: 'pagina' | 'producto'): PageMeta => ({
  title: `${que === 'pagina' ? 'Página no encontrada' : 'Producto no encontrado'} | ${SITE_NAME}`,
  noindex: true,
});

export function metaPaginaEstatica(titulo: string, descripcion: string | undefined, pathname: string): PageMeta {
  const t = limpiarTituloSeo(titulo);
  const ruta = pathname.replace(/\/+$/, '') || '/';
  return {
    title: armarTitulo(`${t} | ${SITE_NAME}`, t),
    description: descripcion ? recortar(descripcion, MAX_DESCRIPCION) : undefined,
    canonical: urlAbsoluta(ruta),
    ogType: 'website',
  };
}

// ── Producto ─────────────────────────────────────────────────────────────

/**
 * Oferta para JSON-LD con el MISMO criterio de precio que la PDP
 * (ProductoDetalle.tsx): precio_override de la variante si tiene, si no el
 * precio_base. Sin variantes → Offer simple; con dispersión de precio entre
 * las comprables → AggregateOffer (rango). No suma bombilla ni grabado: son
 * add-ons opcionales, no el precio del producto.
 */
function ofertaProducto(p: Producto, url: string): Record<string, unknown> {
  const base = Number(p.precio_base);
  const tieneVariantes = (p.tipos_opcion?.length ?? 0) > 0;
  const variantes = tieneVariantes ? (p.variantes_producto ?? []) : [];
  const efectivo = (v: { precio_override?: number | null }) =>
    v.precio_override != null ? Number(v.precio_override) : base;

  const comprables = variantes.filter((v) => v.disponible ?? false);
  const disponible = tieneVariantes ? comprables.length > 0 : (p.disponible ?? false);
  const fuente = tieneVariantes && variantes.length ? (comprables.length ? comprables : variantes) : [];
  const precios = fuente.length ? fuente.map(efectivo) : [base];
  const bajo = Math.min(...precios);
  const alto = Math.max(...precios);

  const comun = {
    priceCurrency: 'ARS',
    availability: `https://schema.org/${disponible ? 'InStock' : 'OutOfStock'}`,
    itemCondition: 'https://schema.org/NewCondition',
    url,
  };
  return bajo === alto
    ? { '@type': 'Offer', price: bajo, ...comun }
    : { '@type': 'AggregateOffer', lowPrice: bajo, highPrice: alto, offerCount: fuente.length, ...comun };
}

export function metaProducto(p: Producto): PageMeta {
  const nombre = limpiarTituloSeo(p.nombre);
  const plano = aTextoPlano(p.descripcion);
  const tieneDescripcion = plano.length >= 40;
  const apto = !!p.apto_grabado;
  const categoria = p.categorias?.nombre ? limpiarTituloSeo(p.categorias.nombre) : '';
  const url = urlAbsoluta(`/productos/${encodeURIComponent(p.slug)}`);

  const sufijo = apto && !tieneDescripcion ? ' con grabado láser' : '';
  const descripcion = tieneDescripcion
    ? recortar(plano, MAX_DESCRIPCION)
    : recortar(
        apto
          ? `${recortar(nombre, 70)}. Grabado láser personalizado en nuestro taller de Buenos Aires. Envíos a todo el país.`
          : `${recortar(nombre, 70)}. Comprá online en ${SITE_NAME}. Envíos a todo el país.`,
        MAX_DESCRIPCION,
      );

  const imagenes = (p.imagenes_producto ?? []).map((i) => i.url).filter(esHttps);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    description: tieneDescripcion ? recortar(plano, 500) : descripcion,
    url,
    offers: ofertaProducto(p, url),
  };
  if (imagenes.length) jsonLd.image = imagenes.slice(0, 5);
  if (categoria) jsonLd.category = categoria;
  if (p.material) jsonLd.material = p.material;

  return {
    title: armarTitulo(
      `${nombre}${sufijo} | ${SITE_NAME}`,
      `${nombre}${sufijo}`,
      `${nombre} | ${SITE_NAME}`,
      nombre,
    ),
    description: descripcion,
    canonical: url,
    image: imagenes[0],
    ogType: 'product',
    jsonLd: [jsonLd],
  };
}

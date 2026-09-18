#!/usr/bin/env node
// Genera el sitemap.xml con las URLs públicas reales (productos y categorías
// de la API) y lo escribe en dist/sitemap.xml.
//
// Se corre en el Dockerfile DESPUÉS de `npm run build` (no dentro del build de
// Vite): así un fallo de red nunca rompe el build ni el deploy. Reglas:
//   - Siempre sale con código 0.
//   - Si la API no responde, tarda más de TIMEOUT_MS o devuelve 0 productos,
//     NO toca nada: queda el public/sitemap.xml commiteado (rutas fijas).
//   - El sitemap solo se actualiza en cada deploy; la Fase 2 de docs/seo.md lo
//     hace dinámico.
//
// Uso: VITE_API_URL=https://api.../api/v1 node scripts/sitemap.mjs [salida]
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE_URL = process.env.SITE_URL || 'https://matelaserstudio.com.ar';
const TIMEOUT_MS = 8000;
const MAX_PAGINAS = 20; // tope de seguridad del loop de paginación

// Páginas de contenido indexables. Las rutas privadas/transaccionales NO van
// (ver public/robots.txt).
export const RUTAS_FIJAS = ['/', '/productos', '/nosotros', '/envios-y-devoluciones', '/faq'];

const escXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fechaISO = (valor) => {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};

/** Pura: arma el XML a partir de los datos ya cargados. */
export function construirSitemap({ productos = [], categorias = [], siteUrl = SITE_URL } = {}) {
  const urls = RUTAS_FIJAS.map((ruta) => ({ loc: `${siteUrl}${ruta}` }));

  // Categoría con productos = propios o de una subcategoría directa (mismo
  // criterio que el filtro del backend, idsConSubcategorias).
  const conProductos = new Set(productos.map((p) => p.categoria_id).filter((id) => id != null));
  for (const c of categorias) {
    if (c.activo === false) continue;
    const hijaConProductos = categorias.some((h) => h.padre_id === c.id && conProductos.has(h.id));
    if (conProductos.has(c.id) || hijaConProductos) {
      urls.push({ loc: `${siteUrl}/productos?categoria_id=${c.id}` });
    }
  }

  // lastmod solo del producto (actualizado_en es real). Las demás URLs no lo
  // llevan: un lastmod inventado le enseña a Google a ignorarlo.
  for (const p of productos) {
    if (!p.slug) continue;
    urls.push({ loc: `${siteUrl}/productos/${encodeURIComponent(p.slug)}`, lastmod: fechaISO(p.actualizado_en) });
  }

  const filas = urls.map(
    (u) => `  <url><loc>${escXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas.join('\n')}\n</urlset>\n`;
}

async function getJson(apiUrl, ruta) {
  const res = await fetch(`${apiUrl}${ruta}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${ruta} → HTTP ${res.status}`);
  return res.json();
}

export async function obtenerCatalogo(apiUrl) {
  const productos = [];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const r = await getJson(apiUrl, `/productos?limit=100&page=${page}`);
    productos.push(...(r.data ?? []));
    if (page >= (r.totalPages ?? 1)) break;
  }
  const categorias = await getJson(apiUrl, '/categorias');
  return { productos, categorias: Array.isArray(categorias) ? categorias : [] };
}

async function main() {
  const apiUrl = (process.env.VITE_API_URL || '').replace(/\/+$/, '');
  const salida = resolve(process.argv[2] || 'dist/sitemap.xml');

  if (!apiUrl) {
    console.warn('[sitemap] VITE_API_URL no está definida — queda el sitemap estático.');
    return;
  }
  if (!existsSync(dirname(salida))) {
    console.warn(`[sitemap] no existe ${dirname(salida)} — ¿corrió el build? Queda el sitemap estático.`);
    return;
  }
  try {
    const { productos, categorias } = await obtenerCatalogo(apiUrl);
    if (productos.length === 0) {
      console.warn('[sitemap] la API devolvió 0 productos — queda el sitemap estático.');
      return;
    }
    const xml = construirSitemap({ productos, categorias });
    writeFileSync(salida, xml);
    console.log(`[sitemap] ${(xml.match(/<url>/g) ?? []).length} URLs → ${salida}`);
  } catch (err) {
    console.warn(`[sitemap] no se pudo consultar la API (${err?.message ?? err}) — queda el sitemap estático.`);
  }
}

// Solo ejecuta main() al correrlo directo (no al importarlo desde los tests).
// Sin process.exit(): en Windows + Node reciente, salir con requests de fetch
// todavía cerrándose aborta con un assertion de libuv (exit ≠ 0). main() ya
// atrapa todo; se deja que el event loop drene solo.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => console.warn(`[sitemap] error inesperado (${err?.message ?? err}) — queda el sitemap estático.`));
}

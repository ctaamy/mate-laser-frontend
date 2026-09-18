import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construirSitemap, RUTAS_FIJAS } from '../scripts/sitemap.mjs';

// SEO Fase 1 — scripts/sitemap.mjs (se corre en el Dockerfile después del
// build). Lo crítico: NUNCA rompe el deploy. Ante cualquier fallo de la API sale
// con código 0 y deja intacto el public/sitemap.xml estático.

const SCRIPT = join(process.cwd(), 'scripts', 'sitemap.mjs');
const SENTINELA = '<!-- sitemap estático de respaldo -->';

const prod = (id: string, slug: string, categoria_id: number, extra: Record<string, unknown> = {}) => ({
  id,
  slug,
  categoria_id,
  actualizado_en: '2026-09-09T13:45:00.000Z',
  ...extra,
});

test.describe('construirSitemap (puro)', () => {
  test('incluye las rutas fijas, las categorías con productos y los productos', () => {
    const xml = construirSitemap({
      productos: [prod('1', 'mate-a', 6), prod('2', 'bombilla-b', 12)],
      categorias: [
        { id: 6, activo: true },
        { id: 12, activo: true },
        { id: 99, activo: true }, // sin productos: no va
      ],
      siteUrl: 'https://ejemplo.com',
    });
    for (const ruta of RUTAS_FIJAS) expect(xml).toContain(`<loc>https://ejemplo.com${ruta}</loc>`);
    expect(xml).toContain('<loc>https://ejemplo.com/productos?categoria_id=6</loc>');
    expect(xml).toContain('<loc>https://ejemplo.com/productos?categoria_id=12</loc>');
    expect(xml).not.toContain('categoria_id=99');
    expect(xml).toContain('<loc>https://ejemplo.com/productos/mate-a</loc><lastmod>2026-09-09</lastmod>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  test('una categoría padre cuenta si tiene productos en una subcategoría directa (como el filtro del backend)', () => {
    const xml = construirSitemap({
      productos: [prod('1', 'mate-a', 6)],
      categorias: [
        { id: 1, activo: true }, // padre, sin productos propios
        { id: 6, activo: true, padre_id: 1 },
      ],
      siteUrl: 'https://ejemplo.com',
    });
    expect(xml).toContain('categoria_id=1<');
    expect(xml).toContain('categoria_id=6<');
  });

  test('excluye categorías inactivas', () => {
    const xml = construirSitemap({
      productos: [prod('1', 'mate-a', 6)],
      categorias: [{ id: 6, activo: false }],
      siteUrl: 'https://ejemplo.com',
    });
    expect(xml).not.toContain('categoria_id=6');
  });

  test('escapa XML y codifica el slug; sin lastmod si la fecha no es válida; salta productos sin slug', () => {
    const xml = construirSitemap({
      productos: [
        prod('1', 'a&b<c>', 6, { actualizado_en: 'no-es-fecha' }),
        prod('2', '', 6),
        { id: '3', categoria_id: 6 },
      ],
      categorias: [],
      siteUrl: 'https://ejemplo.com',
    });
    // encodeURIComponent no deja &, < ni > crudos en la URL.
    expect(xml).toContain('<loc>https://ejemplo.com/productos/a%26b%3Cc%3E</loc></url>');
    expect(xml).not.toMatch(/<lastmod>no-es-fecha/);
    expect(xml.match(/<url>/g)).toHaveLength(RUTAS_FIJAS.length + 1);
  });

  test('las rutas privadas nunca aparecen', () => {
    const xml = construirSitemap({ productos: [prod('1', 'mate-a', 6)], categorias: [] });
    for (const privada of ['/admin', '/carrito', '/checkout', '/pago', '/confirmacion', '/mi-cuenta', '/login']) {
      expect(xml).not.toContain(`${privada}<`);
      expect(xml).not.toContain(`${privada}/`);
    }
  });
});

test.describe('scripts/sitemap.mjs (proceso real contra una API falsa)', () => {
  let servidor: Server;
  let apiUrl: string;
  // Comportamiento de la API falsa, configurable por test.
  let modo: 'ok' | 'paginado' | '500' | 'vacio' = 'ok';

  test.beforeAll(async () => {
    servidor = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const json = (status: number, cuerpo: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(cuerpo));
      };
      if (modo === '500') return json(500, { message: 'boom' });
      if (url.pathname === '/api/v1/categorias') return json(200, [{ id: 6, activo: true }]);
      if (url.pathname === '/api/v1/productos') {
        if (modo === 'vacio') return json(200, { data: [], total: 0, page: 1, totalPages: 1 });
        if (modo === 'paginado') {
          const page = Number(url.searchParams.get('page') ?? '1');
          return json(200, {
            data: [prod(`p${page}`, `producto-pagina-${page}`, 6)],
            total: 2,
            page,
            totalPages: 2,
          });
        }
        return json(200, { data: [prod('1', 'mate-real', 6)], total: 1, page: 1, totalPages: 1 });
      }
      return json(404, {});
    });
    await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
    apiUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/v1`;
  });

  test.afterAll(async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
  });

  // Asíncrono a propósito: la API falsa corre en este mismo proceso, y un
  // spawnSync bloquearía el event loop y la dejaría sin responder.
  function correr(api: string | undefined) {
    const dir = mkdtempSync(join(tmpdir(), 'sitemap-'));
    const salida = join(dir, 'sitemap.xml');
    writeFileSync(salida, SENTINELA);
    const env = { ...process.env };
    delete env.VITE_API_URL;
    if (api !== undefined) env.VITE_API_URL = api;
    return new Promise<{ status: number | null; consola: string; contenido: string }>((resolver) => {
      const hijo = spawn(process.execPath, [SCRIPT, salida], { env });
      let consola = '';
      hijo.stdout.on('data', (d) => (consola += d));
      hijo.stderr.on('data', (d) => (consola += d));
      const corte = setTimeout(() => hijo.kill(), 30_000);
      hijo.on('close', (status) => {
        clearTimeout(corte);
        resolver({ status, consola, contenido: readFileSync(salida, 'utf8') });
      });
    });
  }

  test('caso feliz: reemplaza el archivo con los productos reales', async () => {
    modo = 'ok';
    const { status, contenido } = await correr(apiUrl);
    expect(status).toBe(0);
    expect(contenido).toContain('<loc>https://matelaserstudio.com.ar/productos/mate-real</loc>');
    expect(contenido).toContain('categoria_id=6');
    expect(contenido).not.toContain(SENTINELA);
  });

  test('pagina hasta totalPages', async () => {
    modo = 'paginado';
    const { status, contenido } = await correr(apiUrl);
    expect(status).toBe(0);
    expect(contenido).toContain('/productos/producto-pagina-1<');
    expect(contenido).toContain('/productos/producto-pagina-2<');
  });

  test('API responde 500: sale con 0 y no toca el archivo', async () => {
    modo = '500';
    const { status, consola, contenido } = await correr(apiUrl);
    expect(status).toBe(0);
    expect(contenido).toBe(SENTINELA);
    expect(consola).toContain('[sitemap]');
  });

  test('API devuelve 0 productos: sale con 0 y no toca el archivo', async () => {
    modo = 'vacio';
    const { status, contenido } = await correr(apiUrl);
    expect(status).toBe(0);
    expect(contenido).toBe(SENTINELA);
  });

  test('API caída (puerto cerrado): sale con 0 y no toca el archivo', async () => {
    const cerrado = createServer();
    await new Promise<void>((ok) => cerrado.listen(0, '127.0.0.1', ok));
    const puerto = (cerrado.address() as AddressInfo).port;
    await new Promise<void>((ok) => cerrado.close(() => ok()));

    const { status, contenido } = await correr(`http://127.0.0.1:${puerto}/api/v1`);
    expect(status).toBe(0);
    expect(contenido).toBe(SENTINELA);
  });

  test('sin VITE_API_URL: sale con 0 y no toca el archivo', async () => {
    const { status, contenido } = await correr(undefined);
    expect(status).toBe(0);
    expect(contenido).toBe(SENTINELA);
  });
});

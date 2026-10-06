import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// public/serve.json: cabeceras del servidor estático (serve). Los assets de Vite
// llevan hash en el nombre, así que pueden cachearse "para siempre"; el HTML no,
// porque es el que apunta a los assets del deploy vigente. Sin esto Cloudflare
// aplicaba su default de 4 h a los assets y el navegador revalidaba el HTML a ciegas.

type Regla = { source: string; headers: { key: string; value: string }[] };
const reglas: Regla[] = JSON.parse(readFileSync(join(process.cwd(), 'public', 'serve.json'), 'utf8')).headers;
const valor = (source: string, key: string) =>
  reglas.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value;

test.describe('serve.json', () => {
  test('los assets con hash son inmutables por un año', () => {
    expect(valor('assets/**', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  test('index.html siempre se revalida', () => {
    expect(valor('index.html', 'Cache-Control')).toBe('no-cache');
  });

  test('las cabeceras de seguridad para todo siguen intactas', () => {
    for (const k of ['X-Frame-Options', 'X-Content-Type-Options', 'Strict-Transport-Security', 'Referrer-Policy', 'Content-Security-Policy']) {
      expect(valor('**/*', k), k).toBeTruthy();
    }
  });
});

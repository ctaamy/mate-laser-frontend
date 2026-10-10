import type { Page } from '@playwright/test';

// GET /configuracion/pagina/:slug (contenido de /terminos, /nosotros…). Se arma
// a partir de las mismas claves `pagina_<slug>_{titulo,markdown,contenido}` que
// guarda la tabla, para que cada test describa la página como siempre.
export async function mockPaginas(
  page: Page,
  config: Record<string, unknown>,
  opts: { demoraMs?: number } = {},
) {
  await page.route(/\/api\/v1\/configuracion\/pagina\/[^/?]+$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const slug = new URL(route.request().url()).pathname.split('/').pop();
    if (opts.demoraMs) await new Promise((r) => setTimeout(r, opts.demoraMs));
    return route.fulfill({
      json: {
        titulo: config[`pagina_${slug}_titulo`] ?? null,
        markdown: config[`pagina_${slug}_markdown`] ?? null,
        contenido: config[`pagina_${slug}_contenido`] ?? null,
      },
    });
  });
}

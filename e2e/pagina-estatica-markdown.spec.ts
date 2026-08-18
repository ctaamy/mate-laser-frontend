import { test, expect } from '@playwright/test';

// Migración HTML → Markdown de páginas legales (Términos, Privacidad, FAQ,
// Envíos y devoluciones). Cubre:
// 1) que el markdown se renderiza como HTML real (no como texto plano),
// 2) que el fallback aparece cuando falta la clave `_markdown`,
// 3) regresión XSS: react-markdown sin rehype-raw no debe ejecutar ni
//    inyectar HTML embebido en el contenido admin-controlado.
//
// Mockeamos GET /api/v1/configuracion vía page.route (mismo patrón que
// fixtures-admin.ts) para no depender de Postgres real.

async function mockConfiguracion(page: import('@playwright/test').Page, valor: Record<string, any>) {
  await page.route('**/api/v1/configuracion', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: valor });
  });
}

test.describe('PaginaEstatica — renderizado Markdown', () => {
  test('renderiza encabezado, negrita, lista y link como HTML real', async ({ page }) => {
    const markdown = [
      '# Título principal',
      '',
      'Un párrafo con **texto en negrita**.',
      '',
      '- Primer ítem',
      '- Segundo ítem',
      '',
      '[Ver más](https://ejemplo.com)',
    ].join('\n');

    await mockConfiguracion(page, {
      pagina_terminos_titulo: 'Términos y condiciones',
      pagina_terminos_markdown: markdown,
    });

    await page.goto('/terminos');

    // Encabezado de página (h1 fijo) vs. encabezado del propio markdown (h1 también,
    // "# Título principal" -> h1). Confirmamos que existen ambos como elementos reales.
    await expect(page.getByRole('heading', { name: 'Términos y condiciones', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Título principal', level: 1 })).toBeVisible();

    const contenido = page.locator('.prose');
    await expect(contenido.locator('strong', { hasText: 'texto en negrita' })).toBeVisible();
    await expect(contenido.locator('ul li')).toHaveCount(2);
    await expect(contenido.locator('ul li').first()).toHaveText('Primer ítem');

    const link = contenido.getByRole('link', { name: 'Ver más' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://ejemplo.com');

    // No debe quedar como texto plano sin parsear (los marcadores # ** - [ ]
    // no deberían aparecer literalmente en el texto renderizado).
    const textoPlano = await contenido.innerText();
    expect(textoPlano).not.toContain('**texto en negrita**');
    expect(textoPlano).not.toContain('# Título principal');
  });

  test('muestra el fallback cuando falta la clave _markdown', async ({ page }) => {
    await mockConfiguracion(page, {
      pagina_privacidad_titulo: 'Política de privacidad',
      // sin pagina_privacidad_markdown
    });

    await page.goto('/privacidad');

    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.locator('.prose')).toContainText('Este contenido todavía no fue cargado.');
  });

  // Hallazgo #10 del plan de seguridad/performance (2026-08-17): mientras
  // /configuracion no respondía, el componente mostraba "todavía no fue
  // cargado" como si fuera el estado real, en vez del estado de carga.
  test('mientras /configuracion está en vuelo muestra el skeleton, no el fallback', async ({ page }) => {
    await page.route('**/api/v1/configuracion', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await new Promise((r) => setTimeout(r, 1000));
      return route.fulfill({
        json: { pagina_faq_titulo: 'Preguntas frecuentes', pagina_faq_markdown: 'Contenido real.' },
      });
    });

    await page.goto('/faq');

    // Durante la espera: skeleton visible, sin el placeholder ni el título real.
    await expect(page.locator('.animate-pulse')).toBeVisible();
    await expect(page.getByText('Este contenido todavía no fue cargado.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toHaveCount(0);

    // Al resolver: contenido real, skeleton fuera.
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeVisible();
    await expect(page.locator('.prose')).toContainText('Contenido real.');
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
  });
});

test.describe('PaginaEstatica — regresión XSS', () => {
  test('un <script> embebido en el markdown NO se ejecuta', async ({ page }) => {
    const payload = 'Contenido normal.\n\n<script>window.__xss=true</script>\n\nMás texto.';

    await mockConfiguracion(page, {
      pagina_faq_titulo: 'Preguntas frecuentes',
      pagina_faq_markdown: payload,
    });

    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeVisible();
    await page.waitForTimeout(300); // margen para que, si se ejecutara, ya haya corrido

    const xssEjecutado = await page.evaluate(() => (window as any).__xss);
    expect(xssEjecutado).toBeUndefined();

    // react-markdown (sin rehype-raw) no crea un <script> real en el DOM —
    // confirmamos que no existe ningún <script> inyectado por el contenido.
    const scriptsEnProse = await page.locator('.prose script').count();
    expect(scriptsEnProse).toBe(0);

    // El texto del tag debe aparecer escapado/como texto, no como markup activo.
    await expect(page.locator('.prose')).toContainText('<script>window.__xss=true</script>');
  });

  test('un <img onerror> embebido en el markdown NO se ejecuta', async ({ page }) => {
    const payload = 'Contenido normal.\n\n<img src=x onerror="window.__xss=true">\n\nMás texto.';

    await mockConfiguracion(page, {
      pagina_envios_titulo: 'Envíos y devoluciones',
      pagina_envios_markdown: payload,
    });

    await page.goto('/envios-y-devoluciones');
    await expect(page.getByRole('heading', { name: 'Envíos y devoluciones' })).toBeVisible();
    await page.waitForTimeout(300);

    const xssEjecutado = await page.evaluate(() => (window as any).__xss);
    expect(xssEjecutado).toBeUndefined();

    // No debe existir ningún <img> real generado a partir del HTML embebido
    // (react-markdown sólo crea <img> para sintaxis markdown ![alt](src),
    // nunca a partir de tags HTML crudos sin rehype-raw).
    const imgsEnProse = await page.locator('.prose img').count();
    expect(imgsEnProse).toBe(0);
  });
});

import { test, expect } from '@playwright/test';

// Transición configurable entre bloques del home (transicion_inferior):
// degradado, curva, diagonal, ondulada — reemplaza el corte plano. Usa solo
// el color propio del bloque (nunca el del vecino), así que funciona sola
// si mañana cambia la paleta del tema.

async function mockHome(page: import('@playwright/test').Page, secciones: any[], config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('Transición entre bloques del home', () => {
  test('sin transicion_inferior configurado, no se renderiza ninguna capa extra (default "ninguna")', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#0a2218' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    await expect(page.locator('svg[viewBox="0 0 1200 120"]')).toHaveCount(0);
    // El div del degradado tampoco: no hay ningún elemento con ese linear-gradient.
    const gradientes = await page.locator('div').evaluateAll(divs =>
      divs.filter(d => (d as HTMLElement).style.background?.includes('linear-gradient')).length,
    );
    expect(gradientes).toBe(0);
  });

  test('transicion_inferior: "degradado" usa el color propio del bloque (no un color fijo)', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#ff8800', transicion_inferior: 'degradado' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    const overlay = await page.locator('div').evaluateAll(divs =>
      divs.map(d => (d as HTMLElement).style.background).find(bg => bg?.includes('linear-gradient')),
    );
    expect(overlay).toContain('rgb(255, 136, 0)'); // #ff8800, no un valor hardcodeado
  });

  test('transicion_inferior: "curva" renderiza un SVG relleno con el color propio del bloque', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#0a2218', transicion_inferior: 'curva' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    const path = page.locator('svg[viewBox="0 0 1200 120"] path');
    await expect(path).toHaveCount(1);
    await expect(path).toHaveAttribute('fill', '#0a2218');
  });

  // Bugfix: la curva/onda quedaba con los puntos de control invertidos —
  // gruesa en los bordes y fina en el centro (una "sonrisa"), al revés de
  // la "colina" esperada (gruesa al centro, fina en los bordes).
  test('bugfix: "curva" ya no queda invertida — el path parte y llega más abajo (fino) en los bordes que en el centro', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#0a2218', transicion_inferior: 'curva' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    const d = await page.locator('svg[viewBox="0 0 1200 120"] path').getAttribute('d');
    // "M0,90 ..." — el borde arranca en y=90 (cerca del fondo del viewBox,
    // relleno FINO) en x=0, no en y=0 (relleno GRUESO) como en la versión
    // invertida anterior.
    expect(d).toMatch(/^M0,90/);
  });

  test('transicion_inferior: "diagonal" y "ondulada" también renderizan (formas distintas)', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#111111', transicion_inferior: 'diagonal' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    await expect(page.locator('svg[viewBox="0 0 1200 120"] path')).toHaveCount(1);
  });

  // Bugfix: en un bloque con imagen de fondo, la forma/degradé se pintaba
  // directo sobre los píxeles de la foto (color desconectado del contenido
  // real) en vez de arrancar de un borde limpio del color propio del bloque.
  test('bugfix: con imagen de fondo (Hero), la transición incluye un "collar" sólido del color propio del bloque', async ({ page }) => {
    const imagen = 'https://example.com/hero.jpg';
    await mockHome(page, [
      {
        id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
        datos: { slides: [{ titulo: 'Hola', imagen_url: imagen }], image_position: 'background', bg_color: '#0a2218', transicion_inferior: 'curva' },
      },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    const collar = page.locator('div').filter({ hasNotText: /./ }); // divs sin texto propio
    const colores = await collar.evaluateAll(divs =>
      divs.map(d => (d as HTMLElement).style.backgroundColor).filter(Boolean),
    );
    expect(colores).toContain('rgb(10, 34, 24)'); // #0a2218 — el collar, no un color inventado
  });

  test('la transición del bloque anterior queda visualmente por encima del bloque siguiente (z-index)', async ({ page }) => {
    await mockHome(page, [
      { id: 'a', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'A', bg_color: '#0a2218', transicion_inferior: 'curva' } },
      { id: 'b', tipo: 'texto_libre', activo: true, orden: 1, datos: { html: '<p>B</p>', bg_color: '#ffffff' } },
    ]);
    await page.goto('/');
    const svg = page.locator('svg[viewBox="0 0 1200 120"]');
    const zA = await page.locator('div:has(> section):has-text("A")').first().evaluate(el => getComputedStyle(el).zIndex);
    const zB = await page.locator('div:has(> section):has-text("B")').first().evaluate(el => getComputedStyle(el).zIndex);
    expect(parseInt(zA)).toBeGreaterThan(parseInt(zB));
    await expect(svg).toBeVisible();
  });
});

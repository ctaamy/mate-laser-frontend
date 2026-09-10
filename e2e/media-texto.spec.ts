import { test, expect } from '@playwright/test';

// Bloque media_texto: carrusel de imágenes de un lado + columna de texto del
// otro (eyebrow / título / subtítulo / cuerpo en Markdown / botones). Ver
// src/components/home/SeccionMediaTexto.tsx. El bloque se carga con
// React.lazy desde el dispatcher — Playwright espera solo al assertar.

const IMG_A = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
);
const IMG_B = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#2d4a3e"/></svg>',
);

async function mockHome(
  page: import('@playwright/test').Page,
  secciones: any[],
  config: Record<string, any> = {},
) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

const BLOQUE = {
  id: 'mt-1', tipo: 'media_texto', activo: true, orden: 0,
  datos: {
    media_side: 'left',
    slides: [
      { imagen_url: IMG_A, alt: 'El taller' },
      { imagen_url: IMG_B, alt: 'Grabado láser' },
    ],
    eyebrow: 'El taller',
    titulo: 'Grabamos cada mate a mano',
    subtitulo: 'Uno por uno, con láser.',
    cuerpo_md: 'Trabajamos sobre **acero, madera y acrílico**.\n\n- Envíos a todo el país\n- Retiro por el taller',
    botones: [{ texto: 'Conocé el taller', link: '/nosotros' }],
  },
};

test.describe('Bloque media_texto', () => {
  test('renderiza carrusel + eyebrow/título/subtítulo + Markdown como HTML real + botón a /nosotros', async ({ page }) => {
    await mockHome(page, [BLOQUE]);
    await page.goto('/');

    await expect(page.getByText('El taller', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Grabamos cada mate a mano' })).toBeVisible();
    await expect(page.getByText('Uno por uno, con láser.')).toBeVisible();

    // Markdown → HTML real, no texto plano con los marcadores
    const prose = page.locator('.prose');
    await expect(prose.locator('strong', { hasText: 'acero, madera y acrílico' })).toBeVisible();
    await expect(prose.locator('ul li')).toHaveCount(2);
    expect(await prose.innerText()).not.toContain('**acero');

    await expect(page.locator(`img[src="${IMG_A}"]`).first()).toBeVisible();

    const btn = page.getByRole('link', { name: /Conocé el taller/ });
    await expect(btn).toHaveAttribute('href', '/nosotros');
  });

  test('con 2+ imágenes muestra flechas (desktop) y dots; con una sola, ninguno', async ({ page }) => {
    await mockHome(page, [BLOQUE]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Imagen siguiente' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ir a la imagen/ })).toHaveCount(2);

    await mockHome(page, [{ ...BLOQUE, datos: { ...BLOQUE.datos, slides: [{ imagen_url: IMG_A }] } }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Grabamos cada mate a mano' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imagen siguiente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Ir a la imagen/ })).toHaveCount(0);
  });

  test('en mobile el texto va antes que la imagen (apilado texto-primero, sin toggle)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockHome(page, [BLOQUE]);
    await page.goto('/');

    const titulo = page.getByRole('heading', { name: 'Grabamos cada mate a mano' });
    const img = page.locator(`img[src="${IMG_A}"]`).first();
    await expect(titulo).toBeVisible();
    await expect(img).toBeVisible();
    const tBox = await titulo.boundingBox();
    const iBox = await img.boundingBox();
    expect(tBox!.y).toBeLessThan(iBox!.y);
  });

  test('media_side controla el lado de la imagen en desktop', async ({ page }) => {
    await mockHome(page, [{ ...BLOQUE, datos: { ...BLOQUE.datos, media_side: 'left' } }]);
    await page.goto('/');
    let tBox = await page.getByRole('heading', { name: 'Grabamos cada mate a mano' }).boundingBox();
    let iBox = await page.locator(`img[src="${IMG_A}"]`).first().boundingBox();
    expect(iBox!.x).toBeLessThan(tBox!.x);

    await mockHome(page, [{ ...BLOQUE, datos: { ...BLOQUE.datos, media_side: 'right' } }]);
    await page.goto('/');
    tBox = await page.getByRole('heading', { name: 'Grabamos cada mate a mano' }).boundingBox();
    iBox = await page.locator(`img[src="${IMG_A}"]`).first().boundingBox();
    expect(iBox!.x).toBeGreaterThan(tBox!.x);
  });

  test('sin imágenes pero con texto: renderiza el texto a lo ancho, sin romper', async ({ page }) => {
    await mockHome(page, [{
      id: 'mt-2', tipo: 'media_texto', activo: true, orden: 0,
      datos: { titulo: 'Solo texto', cuerpo_md: 'Un párrafo.', botones: [] },
    }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Solo texto' })).toBeVisible();
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('sin nada configurado el bloque no renderiza (estilo de la casa)', async ({ page }) => {
    await mockHome(page, [
      { id: 'mt-3', tipo: 'media_texto', activo: true, orden: 0, datos: {} },
      { id: 'bt-1', tipo: 'banner_texto', activo: true, orden: 1, datos: { texto: 'ancla-visible' } },
    ]);
    await page.goto('/');
    await expect(page.getByText('ancla-visible')).toBeVisible();
    await expect(page.locator('.prose')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Ir a la imagen/ })).toHaveCount(0);
  });

  test('regresión XSS: un <script> en cuerpo_md no se ejecuta ni entra al DOM', async ({ page }) => {
    await mockHome(page, [{
      id: 'mt-x', tipo: 'media_texto', activo: true, orden: 0,
      datos: { titulo: 'X', cuerpo_md: 'Antes.\n\n<script>window.__xss=true</script>\n\nDespués.' },
    }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'X' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await page.locator('.prose script').count()).toBe(0);
    await expect(page.locator('.prose')).toContainText('<script>window.__xss=true</script>');
  });
});

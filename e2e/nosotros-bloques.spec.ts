import { test, expect } from '@playwright/test';

// Página /nosotros editorial: contenido por bloques (párrafo Markdown + foto
// interpolados). Renderer: src/components/ui/ContenidoBloques.tsx, integrado
// en PaginaEstatica cuando existe `pagina_nosotros_contenido`. Si no, cae al
// Markdown plano (las 4 páginas legales nunca tienen esa clave).

const IMG_A = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#8a5a3c"/></svg>',
);
const IMG_B = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#2d4a3e"/></svg>',
);

async function mockConfig(page: import('@playwright/test').Page, valor: Record<string, any>) {
  await page.route('**/api/v1/configuracion', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: valor });
  });
}

const CONTENIDO = [
  { id: 'p1', tipo: 'parrafo', md: 'Somos un **taller de grabado láser** en Buenos Aires.\n\n- Envíos a todo el país\n- Retiro por el taller' },
  { id: 'i1', tipo: 'imagen', url: IMG_A, alt: 'El láser grabando un mate', layout: 'destacada', epigrafe: 'El láser en pleno grabado.' },
  { id: 'p2', tipo: 'parrafo', md: '## Cómo lo hacemos\n\nTe mostramos cómo queda antes de grabar.' },
  { id: 'i2', tipo: 'imagen', url: IMG_B, alt: 'Macro del grabado terminado', layout: 'ancho_lectura' },
];

test.describe('Página /nosotros — contenido por bloques', () => {
  test('renderiza los bloques en orden: párrafo → foto → párrafo → foto', async ({ page }) => {
    await mockConfig(page, { pagina_nosotros_titulo: 'El Taller', pagina_nosotros_contenido: CONTENIDO });
    await page.goto('/nosotros');

    await expect(page.getByRole('heading', { name: 'El Taller', level: 1 })).toBeVisible();

    const p1 = page.getByText('Somos un', { exact: false });
    const img1 = page.locator(`img[src="${IMG_A}"]`);
    const p2 = page.getByRole('heading', { name: 'Cómo lo hacemos' });
    const img2 = page.locator(`img[src="${IMG_B}"]`);

    for (const loc of [p1, img1, p2, img2]) await expect(loc).toBeVisible();
    const ys = await Promise.all([p1, img1, p2, img2].map(async l => (await l.boundingBox())!.y));
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[2]).toBeLessThan(ys[3]);
  });

  test('el párrafo se renderiza como HTML real (negrita, lista) y # se degrada a h2', async ({ page }) => {
    await mockConfig(page, {
      pagina_nosotros_contenido: [
        { id: 'p1', tipo: 'parrafo', md: 'Un **taller** chico.\n\n- uno\n- dos' },
        { id: 'p2', tipo: 'parrafo', md: '# Titular que no debería ser h1' },
      ],
    });
    await page.goto('/nosotros');

    await expect(page.locator('.prose strong', { hasText: 'taller' })).toBeVisible();
    await expect(page.locator('.prose ul li')).toHaveCount(2);
    // "# ..." NO debe crear un segundo h1 (el h1 de la página ya existe con el título default).
    await expect(page.getByRole('heading', { name: 'Titular que no debería ser h1', level: 1 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Titular que no debería ser h1', level: 2 })).toBeVisible();
  });

  test('la foto lleva alt y el epígrafe se ve debajo', async ({ page }) => {
    await mockConfig(page, { pagina_nosotros_contenido: CONTENIDO });
    await page.goto('/nosotros');

    const img = page.locator(`img[src="${IMG_A}"]`);
    await expect(img).toHaveAttribute('alt', 'El láser grabando un mate');
    const cap = page.locator('figcaption', { hasText: 'El láser en pleno grabado.' });
    await expect(cap).toBeVisible();
    expect((await cap.boundingBox())!.y).toBeGreaterThan((await img.boundingBox())!.y);
  });

  test('"destacada" es más ancha que "ancho_lectura"; el epígrafe se alinea a la columna de texto', async ({ page }) => {
    await mockConfig(page, { pagina_nosotros_contenido: CONTENIDO });
    await page.goto('/nosotros');

    const imgDestacada = page.locator(`img[src="${IMG_A}"]`);
    const imgLectura = page.locator(`img[src="${IMG_B}"]`);
    // La columna de texto: el contenedor .prose del primer párrafo (max-w-3xl).
    const columnaTexto = page.locator('.prose').first();

    const [bD, bL, bCol, bCap] = await Promise.all([
      imgDestacada.boundingBox(), imgLectura.boundingBox(), columnaTexto.boundingBox(),
      page.locator('figcaption', { hasText: 'El láser' }).boundingBox(),
    ]);
    expect(bD!.width).toBeGreaterThan(bL!.width + 40);
    // El epígrafe de la foto ancha arranca en el mismo margen izquierdo que la
    // columna de texto (misma clase max-w-3xl mx-auto), no bajo el borde de la
    // foto ancha.
    expect(Math.abs(bCap!.x - bCol!.x)).toBeLessThan(4);
  });

  test('regresión XSS: un <script> en el md de un párrafo no se ejecuta ni entra al DOM', async ({ page }) => {
    await mockConfig(page, {
      pagina_nosotros_contenido: [
        { id: 'p1', tipo: 'parrafo', md: 'Antes.\n\n<script>window.__xss=true</script>\n\nDespués.' },
      ],
    });
    await page.goto('/nosotros');
    await expect(page.locator('.prose')).toContainText('Antes.');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await page.locator('.prose script').count()).toBe(0);
    await expect(page.locator('.prose')).toContainText('<script>window.__xss=true</script>');
  });

  test('fallback: sin bloques (array vacío) usa el Markdown plano', async ({ page }) => {
    await mockConfig(page, {
      pagina_nosotros_titulo: 'Nosotros',
      pagina_nosotros_contenido: [],
      pagina_nosotros_markdown: 'Contenido viejo en **Markdown**.',
    });
    await page.goto('/nosotros');
    await expect(page.locator('.prose')).toContainText('Contenido viejo en Markdown.');
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('fallback: sin la clave _contenido, /nosotros sigue mostrando el texto de arranque', async ({ page }) => {
    await mockConfig(page, {}); // ni contenido ni markdown
    await page.goto('/nosotros');
    await expect(page.getByRole('heading', { name: 'Nosotros', level: 1 })).toBeVisible();
    await expect(page.locator('.prose')).toContainText('taller de grabado láser en Buenos Aires');
  });
});

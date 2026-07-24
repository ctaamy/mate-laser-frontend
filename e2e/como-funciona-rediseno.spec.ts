import { test, expect } from '@playwright/test';

// Rediseño de como_funciona: cards con ícono (lucide-react, reemplaza el
// número gigante semi-transparente) + número chico + línea conectora sutil
// en acento. Bugfix: el ícono se guardaba (antes emoji) pero nunca se
// renderizaba — ahora se muestra siempre, con fallback por posición.

async function mockHome(page: import('@playwright/test').Page, secciones: any[], config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

const BASE = { id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0 };

test.describe('como_funciona rediseñado — íconos', () => {
  test('cada paso renderiza el ícono configurado (bugfix: antes se guardaba pero nunca se mostraba)', async ({ page }) => {
    await mockHome(page, [{
      ...BASE,
      datos: { pasos: [{ icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Desc' }, { icono: 'Zap', titulo: 'Grabamos', desc: 'Desc' }] },
    }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-palette')).toBeVisible();
    await expect(page.locator('svg.lucide-zap')).toBeVisible();
  });

  test('sin ícono configurado en un paso, usa el fallback histórico por posición', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { pasos: [{ titulo: 'Elegís el diseño', desc: 'Desc' }] } }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-palette')).toBeVisible();
  });

  test('accent_color propio se aplica a la burbuja del ícono', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { pasos: [{ icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Desc' }], accent_color: '#ff8800' } }]);
    await page.goto('/');
    const burbuja = page.locator('svg.lucide-palette').locator('..');
    await expect(burbuja).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  });

  test('sin accent_color propio, hereda el accent_color del tema', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { pasos: [{ icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Desc' }] } }], { tema_accent_color: '#00aaff' });
    await page.goto('/');
    const burbuja = page.locator('svg.lucide-palette').locator('..');
    await expect(burbuja).toHaveCSS('background-color', 'rgb(0, 170, 255)');
  });

  test('sin datos.pasos, usa los 4 pasos default con sus íconos (no queda vacío)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: {} }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-palette')).toBeVisible();
    await expect(page.locator('svg.lucide-circle-check')).toBeVisible();
    await expect(page.locator('svg.lucide-zap')).toBeVisible();
    await expect(page.locator('svg.lucide-package')).toBeVisible();
  });
});

test.describe('como_funciona — eyebrow configurable (bugfix: antes "Proceso" hardcodeado)', () => {
  test('sin datos.eyebrow, no se renderiza ningún texto "Proceso" hardcodeado', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { titulo: 'Título', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    await expect(page.getByText('Proceso', { exact: true })).toHaveCount(0);
  });

  test('con datos.eyebrow, se renderiza tal cual (mismo mecanismo que el eyebrow del Hero: opcional, sin default hardcodeado)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { eyebrow: 'Nuestro proceso', titulo: 'Título', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    await expect(page.getByText('Nuestro proceso', { exact: true })).toBeVisible();
  });
});

test.describe('como_funciona — espaciado título/subtítulo y alineación configurables', () => {
  test('bugfix: titulo_subtitulo_gap cambia la separación entre título y subtítulo', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { titulo: 'Título', subtitulo: 'Subtítulo', titulo_subtitulo_gap: 'xs', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    const gapChico = await page.getByRole('heading', { name: 'Título' }).evaluate(el => parseFloat(getComputedStyle(el).marginBottom));

    await mockHome(page, [{ ...BASE, datos: { titulo: 'Título', subtitulo: 'Subtítulo', titulo_subtitulo_gap: 'xl', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    const gapGrande = await page.getByRole('heading', { name: 'Título' }).evaluate(el => parseFloat(getComputedStyle(el).marginBottom));

    expect(gapGrande).toBeGreaterThan(gapChico);
  });

  test('sin titulo_subtitulo_gap configurado, reproduce el espaciado histórico (0.5rem / 8px)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { titulo: 'Título', subtitulo: 'Subtítulo', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Título' })).toHaveCSS('margin-bottom', '8px');
  });

  test('confirmado: alineacion ya se aplica al bloque de título/subtítulo/eyebrow (no es un bug, ya funciona)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { titulo: 'Título centrado', alineacion: 'center', pasos: [{ icono: 'Palette', titulo: 'Paso', desc: 'Desc' }] } }]);
    await page.goto('/');
    const contenedor = page.getByRole('heading', { name: 'Título centrado' }).locator('xpath=ancestor::div[1]/..');
    await expect(contenedor).toHaveCSS('text-align', 'center');
  });
});

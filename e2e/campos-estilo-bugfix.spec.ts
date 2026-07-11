import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// BUG reportado: en el editor de Estilo del Hero, cambiar valores no
// impactaba el sitio público. Al investigar se encontró que el problema era
// generalizado: la mayoría de los campos de EditorEstilo (padding,
// alineación, titulo_size, subtitulo_size, subtitulo_color, btn_color,
// btn_texto_color, overlay_color/opacidad, font_size, font_weight, columnas,
// object_fit, border_radius) se guardaban en datos pero Home.tsx nunca los
// leía al renderizar. Se corrigió bloque por bloque — ver estiloHeredado,
// escalaTamano, paddingVertical, justifyDeAlineacion en Home.tsx.
//
// Los valores usados en cada test son deliberadamente muy distintos del
// default histórico de cada tipo, para que el efecto sea inequívoco.

async function mockHome(page: import('@playwright/test').Page, seccion: any, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('Bugfix — campos de Estilo del Hero ahora impactan el render', () => {
  test('titulo_size cambia el tamaño del título', async ({ page }) => {
    const base = { id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola' }] } };
    await mockHome(page, { ...base, datos: { ...base.datos, titulo_size: 'xs' } });
    await page.goto('/');
    const fsChico = await page.getByRole('heading', { level: 1 }).evaluate(el => getComputedStyle(el).fontSize);

    await mockHome(page, { ...base, datos: { ...base.datos, titulo_size: '4xl' } });
    await page.goto('/');
    const fsGrande = await page.getByRole('heading', { level: 1 }).evaluate(el => getComputedStyle(el).fontSize);

    expect(parseFloat(fsGrande)).toBeGreaterThan(parseFloat(fsChico));
  });

  test('subtitulo_color se aplica al subtítulo', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', subtitulo: 'Un subtítulo' }], subtitulo_color: '#ff8800' },
    });
    await page.goto('/');
    const subtitulo = page.getByText('Un subtítulo');
    await expect(subtitulo).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('btn_color y btn_texto_color se aplican al botón principal', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', btn_texto: 'Comprar', btn_link: '/productos' }], btn_color: '#ff8800', btn_texto_color: '#000011' },
    });
    await page.goto('/');
    const boton = page.getByRole('main').getByRole('link', { name: /Comprar/ });
    await expect(boton).toHaveCSS('background-color', 'rgb(255, 136, 0)');
    await expect(boton).toHaveCSS('color', 'rgb(0, 0, 17)');
  });

  // overlay_color/overlay_opacidad fueron reemplazados por completo por
  // overlay_direction/overlay_intensity (ver hero-overlay-reconstruccion.spec.ts).
  // Un hero viejo que ya tenía overlay_color configurado migra a un overlay
  // "full" usando el color base resuelto del bloque (nunca el overlay_color
  // original), para no depender de un campo de color que ya no existe.
  test('migración: overlay_color/overlay_opacidad legacy migran a overlay "full" con el color base del bloque', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: {
        slides: [{ titulo: 'Hola', imagen_url: 'https://example.com/hero.jpg', bg_color: '#123456' }],
        overlay_color: '#ff0000', overlay_opacidad: 60,
      },
    });
    await page.goto('/');
    const overlay = page.locator('img[src="https://example.com/hero.jpg"]').locator('..').locator('div').last();
    await expect(overlay).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(overlay).toHaveCSS('opacity', '0.6');
  });

  test('sin overlay configurado, se renderiza el overlay direccional por defecto (left, 60%)', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: 'https://example.com/hero.jpg' }] },
    });
    await page.goto('/');
    const contenedorImagen = page.locator('img[src="https://example.com/hero.jpg"]').locator('..');
    await expect(contenedorImagen.locator('> div')).toHaveCount(1);
  });

  test('overlay_direction: "none" no renderiza ninguna capa extra', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: 'https://example.com/hero.jpg' }], overlay_direction: 'none' },
    });
    await page.goto('/');
    const contenedorImagen = page.locator('img[src="https://example.com/hero.jpg"]').locator('..');
    await expect(contenedorImagen.locator('> div')).toHaveCount(0);
  });
});

test.describe('Bugfix — campos de Estilo en otros bloques', () => {
  test('banner_texto: font_size, font_weight y alineación se aplican', async ({ page }) => {
    await mockHome(page, {
      id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0,
      datos: { texto: 'Oferta especial', font_size: '3xl', font_weight: 'bold', alineacion: 'left' },
    });
    await page.goto('/');
    const texto = page.getByText('Oferta especial');
    await expect(texto).toHaveCSS('font-weight', '700');
    const fs = await texto.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThan(20); // muy por encima de los ~11px históricos
  });

  test('categorias_grid: columnas cambia la grilla y titulo_size el tamaño del título', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Mates', padre_id: null }] }));
    await mockHome(page, {
      id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
      datos: { titulo: 'Nuestras categorías', columnas: 2, titulo_size: '4xl', categorias_items: [] },
    });
    await page.goto('/');
    const grid = page.getByText('Ver productos').first().locator('xpath=ancestor::div[contains(@class,"grid")][1]');
    await expect(grid).toHaveClass(/md:grid-cols-2/);

    const titulo = page.getByRole('heading', { name: 'Nuestras categorías' });
    const fs = await titulo.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThan(30); // por encima del ~30px (text-3xl) histórico máximo
  });

  test('categorias_grid: item_titulo_size cambia el tamaño del nombre de categoría dentro de la card (antes sin ningún control conectado)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Mates', padre_id: null }] }));
    const base = { id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { categorias_items: [{ id: 1, icono: '🧉' }] } };

    await mockHome(page, { ...base, datos: { ...base.datos, item_titulo_size: 'xs' } });
    await page.goto('/');
    const fsChico = await page.getByText('Mates', { exact: true }).evaluate(el => getComputedStyle(el).fontSize);

    await mockHome(page, { ...base, datos: { ...base.datos, item_titulo_size: '3xl' } });
    await page.goto('/');
    const fsGrande = await page.getByText('Mates', { exact: true }).evaluate(el => getComputedStyle(el).fontSize);

    expect(parseFloat(fsGrande)).toBeGreaterThan(parseFloat(fsChico));
  });

  test('categorias_grid: sin item_titulo_size, el nombre de categoría usa el tamaño histórico (14px / text-sm)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Mates', padre_id: null }] }));
    await mockHome(page, {
      id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
      datos: { categorias_items: [{ id: 1, icono: '🧉' }] },
    });
    await page.goto('/');
    await expect(page.getByText('Mates', { exact: true })).toHaveCSS('font-size', '14px');
  });

  test('categorias_grid: item_link_size cambia el tamaño del link "Ver productos" (antes fijo en 11px, sin control)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Mates', padre_id: null }] }));
    const base = { id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { categorias_items: [{ id: 1, icono: '🧉' }] } };

    await mockHome(page, { ...base, datos: { ...base.datos, item_link_size: 'xs' } });
    await page.goto('/');
    const fsChico = await page.getByText('Ver productos').evaluate(el => getComputedStyle(el).fontSize);

    await mockHome(page, { ...base, datos: { ...base.datos, item_link_size: 'xl' } });
    await page.goto('/');
    const fsGrande = await page.getByText('Ver productos').evaluate(el => getComputedStyle(el).fontSize);

    expect(parseFloat(fsGrande)).toBeGreaterThan(parseFloat(fsChico));
  });

  test('categorias_grid: sin item_link_size, el link "Ver productos" usa el nuevo default legible (12px)', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Mates', padre_id: null }] }));
    await mockHome(page, {
      id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
      datos: { categorias_items: [{ id: 1, icono: '🧉' }] },
    });
    await page.goto('/');
    await expect(page.getByText('Ver productos')).toHaveCSS('font-size', '12px');
  });

  test('categorias_grid: bugfix — un nombre de categoría largo en grilla de 4 columnas no se corta a mitad de palabra', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [{ id: 1, nombre: 'Bombillas/Bombillones', padre_id: null }] }));
    await mockHome(page, {
      id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
      datos: { columnas: 4, item_titulo_size: '2xl', categorias_items: [{ id: 1, icono: '🧉' }] },
    });
    await page.goto('/');
    const titulo = page.getByText('Bombillas/Bombillones', { exact: true });
    await expect(titulo).toBeVisible();
    await expect(titulo).toHaveCSS('overflow', 'hidden');
    const webkitLineClamp = await titulo.evaluate(el => getComputedStyle(el).webkitLineClamp);
    expect(webkitLineClamp).toBe('2');
  });

  test('productos_destacados: titulo_size cambia el tamaño del título', async ({ page }) => {
    await mockHome(page, {
      id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
      datos: { titulo: 'Lo más vendido', titulo_size: 'xs', cantidad: 4 },
    });
    await page.goto('/');
    const titulo = page.getByRole('heading', { name: 'Lo más vendido' });
    const fs = await titulo.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeLessThan(20); // muy por debajo del ~24-30px histórico
  });

  test('banner_imagen: object_fit y border_radius se aplican', async ({ page }) => {
    await mockHome(page, {
      id: 'img-1', tipo: 'banner_imagen', activo: true, orden: 0,
      datos: { imagen_url: 'https://example.com/banner.jpg', object_fit: 'contain', border_radius: 'none' },
    });
    await page.goto('/');
    const img = page.locator('img[src="https://example.com/banner.jpg"]');
    await expect(img).toHaveCSS('object-fit', 'contain');
    const wrapper = img.locator('..');
    await expect(wrapper).toHaveCSS('border-radius', '0px');
  });

  test('padding "xl" produce más espacio vertical que "xs" en texto_libre', async ({ page }) => {
    await mockHome(page, {
      id: 'txt-1', tipo: 'texto_libre', activo: true, orden: 0,
      datos: { html: '<p>Hola</p>', padding: 'xs' },
    });
    await page.goto('/');
    const ptChico = await page.getByText('Hola').locator('xpath=ancestor::section[1]')
      .evaluate(el => parseFloat(getComputedStyle(el).paddingTop));

    await mockHome(page, {
      id: 'txt-1', tipo: 'texto_libre', activo: true, orden: 0,
      datos: { html: '<p>Hola</p>', padding: 'xl' },
    });
    await page.goto('/');
    const ptGrande = await page.getByText('Hola').locator('xpath=ancestor::section[1]')
      .evaluate(el => parseFloat(getComputedStyle(el).paddingTop));

    expect(ptGrande).toBeGreaterThan(ptChico);
  });
});

test.describe('Bugfix — flujo completo admin → sitio público', () => {
  test('cambiar "Tamaño título" y "Color subtítulo" del Hero en el admin y guardar impacta el sitio', async ({ page }) => {
    await loginComoAdmin(page);
    let seccionesGuardadas: any[] | null = null;
    const heroInicial = {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', subtitulo: 'Un subtítulo' }] },
    };
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        seccionesGuardadas = route.request().postDataJSON().secciones;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: seccionesGuardadas ?? [heroInicial] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const tituloSizeSelect = page.getByText('Tamaño título', { exact: true }).locator('..').locator('select');
    await tituloSizeSelect.selectOption('4xl');
    const subtituloInput = page.getByText('Color subtítulo', { exact: true }).locator('..').locator('input:not([type="color"])');
    await subtituloInput.fill('#ff8800');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(seccionesGuardadas![0].datos.titulo_size).toBe('4xl');
    expect(seccionesGuardadas![0].datos.subtitulo_color).toBe('#ff8800');

    // Recargar el sitio público — debe reflejar lo recién guardado.
    await page.goto('/');
    const subtitulo = page.getByText('Un subtítulo');
    await expect(subtitulo).toHaveCSS('color', 'rgb(255, 136, 0)');
  });
});

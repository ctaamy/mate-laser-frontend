import { test, expect } from '@playwright/test';

// Reconstrucción del bloque Hero: nada hardcodeado, eyebrow/título/subtítulo
// totalmente configurables, overlay_direction + overlay_intensity reemplazan
// el blend lateral hardcodeado y el overlay_color/overlay_opacidad viejo,
// image_position controla el layout de la imagen. Ver hero-reconstruccion.visual.spec.ts
// para las combinaciones visuales principales.

async function mockHome(page: import('@playwright/test').Page, seccion: any, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

test.describe('Hero reconstruido — sin opacidad reducida en título/subtítulo', () => {
  test('la última línea del título nunca tiene alpha aplicado (contraste completo)', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Primera línea\nSegunda línea' }], texto_color: '#111111' },
    }, { tema_texto_color: '#111111' });
    await page.goto('/');
    const lineas = page.getByRole('heading', { level: 1 }).locator('span');
    await expect(lineas).toHaveCount(2);
    const c1 = await lineas.nth(0).evaluate(el => getComputedStyle(el).color);
    const c2 = await lineas.nth(1).evaluate(el => getComputedStyle(el).color);
    // Full contrast: mismo color sólido en ambas líneas, sin alpha reducido.
    expect(c1).toBe('rgb(17, 17, 17)');
    expect(c2).toBe('rgb(17, 17, 17)');
  });

  test('el título por defecto usa el color de texto primario del tema, no un color secundario', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }] },
    }, { tema_texto_color: '#222222', tema_texto_secundario_color: '#999999' });
    await page.goto('/');
    const titulo = page.getByRole('heading', { level: 1 });
    await expect(titulo).toHaveCSS('color', 'rgb(34, 34, 34)');
  });
});

test.describe('Hero reconstruido — eyebrow configurable', () => {
  test('sin eyebrow definido, no se renderiza texto hardcodeado', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }] },
    });
    await page.goto('/');
    await expect(page.getByText('Grabado láser de precisión')).toHaveCount(0);
  });

  test('con eyebrow definido en el slide, se renderiza tal cual', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', eyebrow: 'Edición limitada' }] },
    });
    await page.goto('/');
    await expect(page.getByText('Edición limitada')).toBeVisible();
  });
});

test.describe('Hero reconstruido — image_position', () => {
  test('background: la imagen cubre el bloque y el texto se superpone', async ({ page }) => {
    const imagen = 'https://example.com/hero-bg.jpg';
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: imagen }], image_position: 'background' },
    });
    await page.goto('/');
    const img = page.locator(`img[src="${imagen}"]`);
    await expect(img).toHaveClass(/absolute inset-0 w-full h-full object-cover/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('overlay_direction: "none" no renderiza ninguna capa sobre la imagen', async ({ page }) => {
    const imagen = 'https://example.com/hero-none.jpg';
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', imagen_url: imagen }], overlay_direction: 'none' },
    });
    await page.goto('/');
    const contenedorImagen = page.locator(`img[src="${imagen}"]`).locator('..');
    await expect(contenedorImagen.locator('> div')).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';

// El hero con imagen mobile propia renderizaba DOS <img> (una con `sm:hidden` y
// otra con `hidden sm:block`). Un <img> con display:none igual se descarga, así
// que cada visita bajaba las dos versiones (65 kB + 98 kB). Ahora es un
// <picture>: el navegador pide solo la que corresponde al ancho.

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const DESKTOP = 'https://img.e2e.test/hero-desktop.png';
const MOBILE = 'https://img.e2e.test/hero-mobile.png';

async function abrirHome(page: Page) {
  const pedidos: string[] = [];
  await page.route('https://img.e2e.test/**', (route) => {
    pedidos.push(route.request().url());
    return route.fulfill({ contentType: 'image/png', body: PNG_1X1 });
  });
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
    route.fulfill({
      json: [
        {
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: { slides: [{ titulo: 'Hola', imagen_url: DESKTOP, imagen_url_mobile: MOBILE }], image_position: 'background', min_height: '400' },
        },
      ],
    }),
  );
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await expect(page.locator('picture img').first()).toBeAttached();
  await page.waitForLoadState('networkidle');
  return pedidos;
}

test.describe('Hero con imagen mobile: se descarga solo la que corresponde', () => {
  test('mobile (375px): pide la imagen mobile y no la de desktop', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    const pedidos = await abrirHome(page);
    expect(pedidos).toContain(MOBILE);
    expect(pedidos).not.toContain(DESKTOP);
  });

  test('desktop (1280px): pide la imagen de desktop y no la mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const pedidos = await abrirHome(page);
    expect(pedidos).toContain(DESKTOP);
    expect(pedidos).not.toContain(MOBILE);
  });

  test('la imagen del hero pide prioridad alta de descarga', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await abrirHome(page);
    await expect(page.locator('picture img').first()).toHaveAttribute('fetchpriority', 'high');
  });
});

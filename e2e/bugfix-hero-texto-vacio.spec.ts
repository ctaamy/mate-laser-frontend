import { test, expect } from '@playwright/test';

// BUG: al vaciar el título, el subtítulo o el texto del botón principal de
// un slide del Hero, el sitio (y el preview en vivo del admin, que comparte
// el mismo renderer) volvía a mostrar un texto predefinido hardcodeado en
// vez de quedar en blanco — porque HeroSlideContent leía
// `slide.titulo || 'Mates únicos,\nhechos a tu medida'` (y lo mismo para
// subtítulo y botón primario). Fix: sin fallback a texto hardcodeado; el
// título/subtítulo/botón vacíos simplemente no se renderizan. El texto de
// ejemplo sigue existiendo, pero solo una vez, al crear un slide nuevo
// (SLIDE_DEFAULT en Configuracion.tsx) — no en cada render.
// Ver HeroSlideContent en HomeSecciones.tsx.

async function mockHome(page: import('@playwright/test').Page, seccion: any) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

test.describe('BUG fix — texto vacío del Hero no se autocompleta', () => {
  test('slide sin título: no se muestra el título de ejemplo', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: '', subtitulo: 'Un subtítulo cualquiera' }] },
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
    await expect(page.getByText('Mates únicos')).toHaveCount(0);
  });

  test('slide sin subtítulo: no se muestra el subtítulo de ejemplo', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Un título cualquiera', subtitulo: '' }] },
    });
    await page.goto('/');

    await expect(page.getByText('Personalizamos cada pieza con tu diseño')).toHaveCount(0);
  });

  test('botón principal sin texto: no cae en "Ver colección"', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', botones: [{ texto: '', link: '/productos' }] }] },
    });
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Ver colección' })).toHaveCount(0);
    // El link sigue existiendo (con el ícono de flecha), solo que sin texto
    // — se acota a <main> porque el navbar y el footer también linkean a
    // "/productos".
    await expect(page.getByRole('main').locator('a[href="/productos"]')).toBeVisible();
  });

  test('título y subtítulo con texto real siguen mostrándose normalmente (no regresión)', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Mi título', subtitulo: 'Mi subtítulo' }] },
    });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi título');
    await expect(page.getByText('Mi subtítulo')).toBeVisible();
  });
});

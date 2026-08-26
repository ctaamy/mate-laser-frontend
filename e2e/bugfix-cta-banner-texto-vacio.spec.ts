import { test, expect } from '@playwright/test';

// BUG: mismo problema que en el Hero (ver bugfix-hero-texto-vacio.spec.ts),
// pero en SeccionCtaBanner ("CTA BANNER"): el botón primario renderizaba
// `{boton.texto || 'Ver colección'}`, así que si en el admin se guardaba un
// botón con texto vacío (""), el sitio público seguía mostrando
// "Ver colección" en vez de quedar en blanco — inconsistente con el botón
// secundario de la misma sección, que ya renderizaba `{boton.texto}` sin
// fallback. Fix: sin fallback a texto hardcodeado en el botón primario.
// El fallback de `botones` (cuando no hay NINGÚN botón configurado) sigue
// existiendo — ese es intencional y no es el bug.
// Ver SeccionCtaBanner en HomeSecciones.tsx.

async function mockHome(page: import('@playwright/test').Page, seccion: any) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [seccion] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

test.describe('BUG fix — texto vacío del botón primario del CTA Banner no se autocompleta', () => {
  test('botón principal sin texto: no cae en "Ver colección"', async ({ page }) => {
    await mockHome(page, {
      id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
      datos: { titulo: 'Hola', botones: [{ texto: '', link: '/x' }] },
    });
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Ver colección' })).toHaveCount(0);
    // El link sigue existiendo (con el ícono de flecha), solo que sin texto
    // — se acota a <main> porque el navbar y el footer también pueden linkear
    // a rutas propias.
    await expect(page.getByRole('main').locator('a[href="/x"]')).toBeVisible();
  });

  test('botón principal con texto real sigue mostrándose normalmente (no regresión)', async ({ page }) => {
    await mockHome(page, {
      id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
      datos: { titulo: 'Hola', botones: [{ texto: 'Comprar ahora', link: '/x' }] },
    });
    await page.goto('/');

    await expect(page.getByRole('main').getByRole('link', { name: 'Comprar ahora' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

// Punto 5 de la consolidación: al Hero le faltaba el nivel intermedio de
// Bloque para bg_color/texto_color/font_family — el slide saltaba directo
// al tema. Ahora sigue la cadena completa Slide → Bloque → Tema, igual que
// el resto de los tipos de sección (heredaDeBloque(slide, estiloHeredado(...))).

test.describe('hero — nivel de Bloque agregado (Slide → Bloque → Tema)', () => {
  test('slide sin bg_color propio hereda el bg_color del BLOQUE (no salta directo al tema)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: { slides: [{ titulo: 'Hola' }], bg_color: '#593e2e' },
        }],
      }),
    );
    // El tema define OTRO color distinto — si el slide heredara del tema
    // directamente (saltándose el bloque), este test fallaría.
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_bg_color: '#000011' } }));

    await page.goto('/');
    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('background-color', 'rgb(89, 62, 46)');
  });

  test('slide CON su propio bg_color no hereda el del bloque (override del slide gana)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: { slides: [{ titulo: 'Hola', bg_color: '#ff0000' }], bg_color: '#593e2e' },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  });

  test('ni slide ni bloque tienen bg_color propio: hereda del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola' }] } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_bg_color: '#000011' } }));

    await page.goto('/');
    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('background-color', 'rgb(0, 0, 17)');
  });

  test('font_family del bloque se hereda cuando el slide no define la propia', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola' }], font_family: 'Georgia, serif' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('font-family', /Georgia/);
  });
});

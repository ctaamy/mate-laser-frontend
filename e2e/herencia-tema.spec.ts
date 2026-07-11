import { test, expect } from '@playwright/test';

// Fase 1: cada bloque (incluido el navbar) hereda color de fondo, color de
// letra y tipografía del tema global cuando no define su propio override.
// Ver src/hooks/useThemeGlobal.ts (useTemaGlobalData) y estiloHeredado en
// src/pages/Home.tsx.

test.describe('Herencia de tema — bloques y navbar', () => {
  test('un bloque sin bg_color/texto_color propios hereda los del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [
          { id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis' } },
        ],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#334455', tema_texto_color: '#eeeeee' } }),
    );

    await page.goto('/');

    const banner = page.getByText('Envío gratis').locator('..').locator('..');
    await expect(banner).toHaveCSS('background-color', 'rgb(51, 68, 85)');
  });

  test('un bloque CON su propio bg_color no hereda del tema global (override gana)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [
          { id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis', bg_color: '#ff0000' } },
        ],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#334455' } }),
    );

    await page.goto('/');

    const banner = page.getByText('Envío gratis').locator('..').locator('..');
    await expect(banner).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  });

  test('el navbar sin sección propia hereda color de fondo del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#0a2218', tema_texto_color: '#f5f0e6' } }),
    );

    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toHaveCSS('background-color', 'rgb(10, 34, 24)');
  });

  test('una sección tipo "navbar" con su propio color no hereda del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'nav-1', tipo: 'navbar', activo: true, orden: -1, datos: { bg_color: '#ff8800' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#0a2218' } }),
    );

    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  });
});

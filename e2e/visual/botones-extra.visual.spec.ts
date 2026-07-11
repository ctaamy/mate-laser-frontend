import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Cubre la Fase 3 de personalización: un cta_banner con más de 2 botones
// (antes el máximo era 2, hardcodeado).

test.describe('Visual — botones extra', () => {
  test('cta_banner con 3 botones', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
          datos: {
            titulo: '¿Listo para personalizar tu mate?',
            subtitulo: 'Hablamos, diseñamos y grabamos.',
            botones: [
              { texto: 'Ver colección', link: '/productos' },
              { texto: 'Cómo funciona', link: '/#como-funciona' },
              { texto: 'Contactanos', link: '/#contacto' },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('cta-banner-3-botones.png');
  });
});

import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Cubre la Fase 2 de personalización: los bloques ahora usan flex
// items-center para centrar el contenido cuando se agranda min_height —
// vale la pena un baseline dado que ese cambio de layout toca todos los
// tipos de sección (Home.tsx).

test.describe('Visual — resize de bloques', () => {
  test('bloque banner_texto agrandado centra su contenido verticalmente', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [
          { id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'ENVÍO GRATIS A TODO EL PAÍS', min_height: '300', bg_color: '#0a2218', texto_color: '#f5f0e6' } },
        ],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('banner-texto-agrandado.png');
  });
});

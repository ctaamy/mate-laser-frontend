import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Cubre la Fase 0 de personalización: el tema global (fondo/letra) aplicado
// al sitio público, y el panel de edición + preview en el admin.

test.describe('Visual — tema global', () => {
  test('sitio público con tema custom aplicado (homepage vacía = solo fondo/letra del body)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#0a2218', tema_texto_color: '#f5f0e6' } }),
    );

    await page.goto('/');
    await page.waitForTimeout(150); // deja aplicar la CSS variable vía efecto
    await expect(page).toHaveScreenshot('home-tema-custom.png');
  });
});

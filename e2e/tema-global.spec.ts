import { test, expect } from '@playwright/test';

// Verifica que el tema global configurado en el admin (Fase 0) se aplique
// como CSS variables en :root, consumidas por la clase ".tema-publico" en
// la raíz del layout del sitio público (src/components/layout/Layout.tsx)
// — NO en <body> global, para que el panel admin nunca la herede (ver
// e2e/tema-admin-aislado.spec.ts y src/index.css).

test.describe('Tema global — aplicación en el sitio público', () => {
  test('aplica color de fondo y color de letra configurados al layout público', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#123456', tema_texto_color: '#abcdef' } }),
    );

    await page.goto('/');

    await expect(page.locator('.tema-publico')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(page.locator('.tema-publico')).toHaveCSS('color', 'rgb(171, 205, 239)');
  });

  test('sin configuración de tema: usa los valores por defecto (blanco / negro)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    await expect(page.locator('.tema-publico')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.tema-publico')).toHaveCSS('color', 'rgb(17, 17, 17)');
  });
});

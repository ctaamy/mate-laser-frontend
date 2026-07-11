import { test, expect } from '@playwright/test';

// Footer como bloque (Fase 2): mismo mecanismo de herencia Tema → Bloque que
// el resto de las secciones y el navbar (ver Footer.tsx). A diferencia del
// navbar, el footer no tenía ninguna clave suelta legacy — así que antes de
// la migración (sin sección 'footer' en homepage_sections) se usa el look
// hardcodeado de siempre como fallback, no el tema global.

test.describe('Footer — bloque con herencia de tema', () => {
  test('sin sección "footer" (pre-migración), usa el look hardcodeado de siempre, no el tema', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#ffffff', tema_texto_color: '#111111' } }),
    );

    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toHaveCSS('background-color', 'rgb(10, 10, 10)');
    await expect(footer.getByText('Grabado láser personalizado · Todo Argentina')).toBeVisible();
    await expect(footer.getByText('Productos', { exact: true })).toBeVisible();
    await expect(footer.getByText('© 2025 Mate Laser Studio')).toBeVisible();
  });

  test('sección "footer" sin bg_color/texto_color propios hereda del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#334455', tema_texto_color: '#eeeeee' } }),
    );

    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toHaveCSS('background-color', 'rgb(51, 68, 85)');
  });

  test('sección "footer" CON su propio bg_color no hereda del tema global (override gana)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: { bg_color: '#ff8800' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.fulfill({ json: { tema_bg_color: '#334455' } }),
    );

    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  });

  test('contenido editable (tagline, links, redes, copyright) se renderiza desde la sección', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'foot-1', tipo: 'footer', activo: true, orden: -1,
          datos: {
            tagline: 'Tagline de prueba',
            links: [{ label: 'Link custom', href: '/custom' }],
            redes: [{ label: '@customhandle', href: 'https://instagram.com/customhandle' }],
            copyright: '© 2030 Custom Brand',
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer.getByText('Tagline de prueba')).toBeVisible();
    await expect(footer.getByText('Link custom')).toBeVisible();
    await expect(footer.getByText('@customhandle')).toBeVisible();
    await expect(footer.getByText('© 2030 Custom Brand')).toBeVisible();
    // No debe quedar ningún resto del contenido hardcodeado anterior
    await expect(footer.getByText('Productos', { exact: true })).toHaveCount(0);
  });
});

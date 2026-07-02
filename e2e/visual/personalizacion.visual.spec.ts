import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from '../fixtures';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.

test.describe('Visual — personalización de producto', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage limpio: evita que un carrito de un test anterior corra el
    // layout (badge del header) y genere falsos positivos.
    await page.addInitScript(() => window.localStorage.clear());
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (route) =>
      route.fulfill({ json: PRODUCTO_MOCK }),
    );
  });

  // Screenshots acotados al panel de info del producto (no la página
  // completa), para no depender del header/nav que puede variar por estado
  // global (carrito, etc.) ajeno a lo que este test valida.
  const panelInfo = (page: import('@playwright/test').Page) =>
    page.locator('h1').first().locator('xpath=ancestor::div[contains(@class,"flex-col") and contains(@class,"gap-7")]');

  test('estado inicial (toggle apagado)', async ({ page }) => {
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(panelInfo(page)).toHaveScreenshot('inicial.png');
  });

  test('toggle activado con color y texto cargados', async ({ page }) => {
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByText('Grabado personalizado').click();
    await page.getByRole('button', { name: 'negro' }).click();
    const inputTexto = page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder);
    await inputTexto.fill('Para Juan');
    await page.locator('h1').first().focus(); // saca el foco del input para evitar el parpadeo del cursor en el screenshot
    await page.waitForTimeout(300); // deja terminar la animación de expansión (framer-motion, 220ms)
    // El input de texto se enmascara: el cursor/caret puede quedar en distinta
    // posición de renderizado entre corridas y genera falsos positivos.
    await expect(panelInfo(page)).toHaveScreenshot('activado.png', { mask: [inputTexto] });
  });
});

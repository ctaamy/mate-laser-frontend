import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 0 de personalización del sitio: panel de "Tema" en Configuracion.tsx
// que permite fijar color de fondo, color de letra y tipografía por defecto
// de todo el sitio. Se guarda como claves sueltas (tema_bg_color,
// tema_texto_color, tema_font_family) reutilizando el endpoint genérico
// PUT /configuracion (sin cambios de schema).

// Un solo handler por endpoint (evita registrar dos routes para el mismo
// patrón — la segunda registración shadowea a la primera y, si cae a
// route.continue(), termina pegándole a la red real).
async function mockBackendBase(
  page: import('@playwright/test').Page,
  configInicial: Record<string, any> = {},
  onPut?: (body: Record<string, string>) => void,
) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: [] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: configInicial });
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.continue();
  });
}

test.describe('Admin — Tema global', () => {
  test('permite configurar color de fondo, color de letra y tipografía, y guardarlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: Record<string, string> | null = null;
    await mockBackendBase(page, {}, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    const textoInput = page.getByText('Color de letra', { exact: true })
      .locator('..').locator('input:not([type="color"])');

    await bgInput.fill('#123456');
    await textoInput.fill('#abcdef');
    await page.locator('select').selectOption('Poppins, sans-serif');

    await page.getByRole('button', { name: 'Guardar tema' }).click();

    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(putBody).toMatchObject({
      tema_bg_color: '#123456',
      tema_texto_color: '#abcdef',
      tema_font_family: 'Poppins, sans-serif',
    });
  });

  test('el preview del tema refleja los colores elegidos', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendBase(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await bgInput.fill('#123456');

    const preview = page.getByText('Así se ve el texto por defecto del sitio.').locator('..');
    await expect(preview).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  });

  test('carga los valores ya guardados al entrar al tab', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendBase(page, {
      tema_bg_color: '#222222',
      tema_texto_color: '#eeeeee',
      tema_font_family: 'Montserrat, sans-serif',
    });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await expect(bgInput).toHaveValue('#222222');
    await expect(page.locator('select')).toHaveValue('Montserrat, sans-serif');
  });
});

test.describe('Admin — indicador de cambios sin guardar (Tema/Tienda comparten formulario)', () => {
  test('no muestra el indicador si no se editó nada', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendBase(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    await expect(page.getByText('Tenés cambios sin guardar')).not.toBeVisible();
  });

  test('editar el tema muestra el indicador en la tab Tema y también en la tab Tienda (mismo formulario)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendBase(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await bgInput.fill('#123456');

    await expect(page.getByText('Tenés cambios sin guardar')).toBeVisible();

    // Cambia a Tienda sin guardar: el aviso sigue (es el mismo configForm).
    // "Tienda" (tab) vs "Ver tienda" (sidebar) — se aísla con la clase del tab.
    await page.locator('.rounded-xl.p-1.bg-white').getByRole('button', { name: 'Tienda' }).click();
    await expect(page.getByText('Tenés cambios sin guardar')).toBeVisible();
  });

  test('guardar hace desaparecer el indicador', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendBase(page, {}, () => {});

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await bgInput.fill('#123456');
    await expect(page.getByText('Tenés cambios sin guardar')).toBeVisible();

    await page.getByRole('button', { name: 'Guardar tema' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    await expect(page.getByText('Tenés cambios sin guardar')).not.toBeVisible();
  });
});

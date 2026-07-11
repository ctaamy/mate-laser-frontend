import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// BUG: en el editor de Estilo del bloque Hero (y de cualquier otro bloque),
// al borrar el hex de un campo de color, el valor volvía a aparecer
// instantáneamente. Causa: EditorEstilo alimentaba el <input> controlado con
// `datos.bg_color || '#ffffff'` (o similar) — como '' es falsy, el fallback
// hardcodeado pisaba el string vacío en cada render, así que el campo nunca
// podía quedar vacío. Fix: `datos.bg_color || ''`, igual que ya se hacía en
// NavbarEditor (Fase 1). Ver EditorEstilo en Configuracion.tsx.

// El tab "Estilo" del Hero (EditorEstilo) edita datos.bg_color/texto_color a
// nivel de la sección completa (no el color por-slide, que se edita en el
// tab "Contenido" vía HeroSlideEditor) — por eso el mock necesita ambos.
const HERO_SECCION = {
  id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
  datos: {
    bg_color: '#593e2e', texto_color: '#f2e6d8',
    slides: [{ titulo: 'Hola', bg_color: '#593e2e', texto_color: '#f2e6d8' }],
  },
};

async function mockHomepage(page: import('@playwright/test').Page, onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: [HERO_SECCION] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

test.describe('BUG fix — campo de color del Hero se puede vaciar', () => {
  test('borrar el hex del campo "Fondo" deja el input vacío (no reaparece)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockHomepage(page);

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const fondoInput = page.getByText('Fondo del bloque (base)', { exact: true }).locator('..').locator('input:not([type="color"])');
    await expect(fondoInput).toHaveValue('#593e2e');

    await fondoInput.fill('');
    // Si el bug estuviera presente, React repondría un hex hardcodeado acá
    // mismo, sin esperar ningún timeout — por eso no hace falta waitFor.
    await expect(fondoInput).toHaveValue('');
  });

  test('borrar y guardar persiste el campo vacío (hereda del tema global)', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const fondoInput = page.getByText('Fondo del bloque (base)', { exact: true }).locator('..').locator('input:not([type="color"])');
    await fondoInput.fill('');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody.secciones[0].datos.bg_color).toBe('');
  });

  test('otros campos de color del Hero (subtítulo, botón) también se pueden vaciar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockHomepage(page);

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const subtituloInput = page.getByText('Color subtítulo', { exact: true }).locator('..').locator('input:not([type="color"])');
    await subtituloInput.fill('#1D9E75');
    await subtituloInput.fill('');
    await expect(subtituloInput).toHaveValue('');

    const btnInput = page.getByText('Fondo botón (default)', { exact: true }).locator('..').locator('input:not([type="color"])');
    await btnInput.fill('#1D9E75');
    await btnInput.fill('');
    await expect(btnInput).toHaveValue('');
  });

  test('un bloque sin color de fondo propio hereda el color del tema global en el sitio (no cae en el hex hardcodeado del editor)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola', bg_color: '' }] } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_bg_color: '#334455' } }));

    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('background-color', 'rgb(51, 68, 85)');
  });
});

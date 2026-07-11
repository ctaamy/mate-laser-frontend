import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Punto 4 de la consolidación: cada Boton (no solo el primero) resuelve su
// propio color en la cadena Botón → Bloque (btn_color/btn_texto_color) →
// Tema, vía heredaDeBloque() — mismo mecanismo que subtítulos. Antes, solo
// el botón principal (índice 0) leía btn_color/btn_texto_color; el resto
// tenía el color totalmente hardcodeado, sin poder heredar ni overridear.

test.describe('hero — cadena de herencia por botón', () => {
  test('botón secundario sin override hereda el texto_color del slide (atenuado)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: {
            slides: [{
              titulo: 'Hola', texto_color: '#334455',
              botones: [{ texto: 'Primario', link: '/a' }, { texto: 'Secundario', link: '/b' }],
            }],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    const secundario = page.getByRole('main').getByRole('link', { name: 'Secundario' });
    // Atenuado (alpha 70 sobre #334455) — no exactamente rgb(51,68,85) opaco.
    const color = await secundario.evaluate(el => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(51, 68, 85)'); // no es el color opaco del bloque
    expect(color).toMatch(/rgba\(51, 68, 85/); // pero sí se deriva de él
  });

  test('botón secundario CON override propio se aplica opaco, no atenuado', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: {
            slides: [{ titulo: 'Hola', botones: [{ texto: 'Primario', link: '/a' }, { texto: 'Secundario', link: '/b', texto_color: '#ff8800' }] }],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    const secundario = page.getByRole('main').getByRole('link', { name: 'Secundario' });
    await expect(secundario).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('botón primario con bg_color propio no usa el btn_color del bloque', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: {
            slides: [{ titulo: 'Hola', botones: [{ texto: 'Comprar', link: '/a', bg_color: '#00cc66' }] }],
            btn_color: '#ff0000',
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    const boton = page.getByRole('main').getByRole('link', { name: 'Comprar' });
    await expect(boton).toHaveCSS('background-color', 'rgb(0, 204, 102)');
  });
});

test.describe('cta_banner — cadena de herencia por botón', () => {
  test('botón primario hereda btn_color del bloque cuando no tiene override propio', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
          datos: { titulo: 'Título', botones: [{ texto: 'Comprar', link: '/a' }], btn_color: '#ff8800' },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    const boton = page.getByRole('main').getByRole('link', { name: 'Comprar' });
    await expect(boton).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  });

  test('sin btn_color de bloque, el botón primario hereda del texto_color del bloque (que a su vez puede venir del tema)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Título', botones: [{ texto: 'Comprar', link: '/a' }] } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_texto_color: '#123456' } }));
    await page.goto('/');
    const boton = page.getByRole('main').getByRole('link', { name: 'Comprar' });
    await expect(boton).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  });
});

test.describe('admin — override de color por botón', () => {
  test('BotonesEditor expone campos de color propio por botón y se persisten', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Título', botones: [{ texto: 'Comprar', link: '/a' }] } }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();

    const fondoPropio = page.getByText('Fondo de este botón (opcional)').locator('..').locator('input:not([type="color"])');
    await fondoPropio.fill('#00cc66');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody.secciones[0].datos.botones[0].bg_color).toBe('#00cc66');
  });

  test('EditorEstilo de cta_banner expone "Fondo botón" / "Texto botón" a nivel de bloque', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Título' } }] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Estilo' }).first().click();
    await expect(page.getByText('Fondo botón (default)')).toBeVisible();
    await expect(page.getByText('Texto botón (default)')).toBeVisible();
  });
});

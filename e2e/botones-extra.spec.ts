import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 3 de personalización del sitio: hero y cta_banner pasan de tener
// como máximo 2 botones fijos (btn_texto/btn_link + btn2_texto/btn2_link) a
// una lista libre datos.botones: {texto,link}[]. Los campos legacy se siguen
// leyendo como fallback (compat con secciones creadas antes de esta fase).
// Ver resolverBotones() en Home.tsx y resolverBotonesLegacy()/BotonesEditor
// en Configuracion.tsx.

test.describe('Botones extra — sitio público', () => {
  test('cta_banner con 3 botones en datos.botones los renderiza todos', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
          datos: {
            titulo: 'Personalizá tu mate',
            botones: [
              { texto: 'Ver colección', link: '/productos' },
              { texto: 'Cómo funciona', link: '/#como-funciona' },
              { texto: 'Contactanos', link: '/#contacto' },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /Ver colección/ })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Cómo funciona' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Contactanos' })).toBeVisible();
  });

  test('hero sin datos.botones sintetiza los botones desde los campos legacy', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
          datos: { slides: [{ titulo: 'Hola', btn_texto: 'Comprar ahora', btn_link: '/productos', btn2_texto: 'Ver más', btn2_link: '/nosotros' }] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    await expect(page.getByRole('link', { name: /Comprar ahora/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver más' })).toBeVisible();
  });

  test('cta_banner sin ningún botón configurado muestra el botón por defecto', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Hola' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    await expect(page.getByRole('link', { name: /Ver colección/ })).toBeVisible();
  });
});

test.describe('Botones extra — admin', () => {
  test('permite agregar y quitar botones en un slide del hero, y persistirlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{ id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola', btn_texto: 'Comprar', btn_link: '/productos' }] } }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir sección
    await page.getByRole('button', { name: 'Agregar botón' }).click();

    // 2 filas de botón: la legacy migrada ("Comprar") + la nueva vacía
    const filas = page.locator('input[placeholder="Texto del botón"], input[placeholder="Ver colección"]');
    await expect(filas).toHaveCount(2);
    await page.getByPlaceholder('Texto del botón').fill('Contactanos');
    await page.getByPlaceholder('/ruta').fill('/#contacto');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const slideBotones = putBody.secciones[0].datos.slides[0].botones;
    expect(slideBotones).toEqual([
      { texto: 'Comprar', link: '/productos' },
      { texto: 'Contactanos', link: '/#contacto' },
    ]);
  });
});

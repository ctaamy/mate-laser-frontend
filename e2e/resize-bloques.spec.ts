import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 2 de personalización del sitio: cada bloque se puede agrandar o
// achicar seteando un alto mínimo (datos.min_height, en px). Se guarda en
// el mismo array de secciones; 'auto' o vacío = altura natural del bloque.
// Ver estiloHeredado() en src/pages/Home.tsx y el campo "Alto mínimo del
// bloque" en EditorEstilo (Configuracion.tsx).

test.describe('Resize de bloques — sitio público', () => {
  test('un bloque con min_height definido aplica esa altura mínima', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis', min_height: '400' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const section = page.getByText('Envío gratis').locator('..').locator('..');
    await expect(section).toHaveCSS('min-height', '400px');
  });

  test('sin min_height (o "auto"), el bloque no fuerza una altura mínima', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis', min_height: 'auto' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    // El bloque ya no es hijo directo del contenedor flex de Home (Fase 4 lo
    // envuelve para la capa de imágenes libres), así que el valor resuelto
    // de "auto" pasa de ser el keyword a "0px" — el efecto visual (sin altura
    // mínima forzada) es el mismo.
    const section = page.getByText('Envío gratis').locator('..').locator('..');
    await expect(section).toHaveCSS('min-height', '0px');
  });

  test('el hero respeta min_height propio en vez del 90vh por defecto', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola' }], min_height: '500' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"relative") and contains(@class,"overflow-hidden")][1]');
    await expect(hero).toHaveCSS('min-height', '500px');
  });
});

test.describe('Resize de bloques — admin', () => {
  test('el campo "Alto mínimo" está disponible para banner_texto y ausente para banner_imagen', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        json: [
          { id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Hola' } },
          { id: 'img-1', tipo: 'banner_imagen', activo: true, orden: 1, datos: { imagen_url: 'https://x/y.jpg' } },
        ],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');

    // Sección banner_texto: expandir y pasar a la tab Estilo
    const tarjetas = page.locator('.bg-white.border.rounded-xl.overflow-hidden');
    await tarjetas.nth(0).getByRole('button').nth(3).click(); // botón expandir (Contenido/Estilo)
    await page.getByRole('button', { name: 'Estilo' }).first().click();
    await expect(page.getByText('Alto mínimo del bloque')).toBeVisible();

    // Colapsar y expandir banner_imagen
    await tarjetas.nth(0).getByRole('button').nth(3).click();
    await tarjetas.nth(1).getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Estilo' }).first().click();
    await expect(page.getByText('Alto mínimo del bloque')).not.toBeVisible();
    await expect(page.getByText('Altura máxima (px)')).toBeVisible();
  });

  test('guardar un alto mínimo persiste min_height en el bloque', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: [{ id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Hola' } }] });
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

    await page.getByPlaceholder('auto').fill('350');
    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody.secciones[0].datos.min_height).toBe('350');
  });
});

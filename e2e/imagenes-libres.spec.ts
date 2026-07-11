import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 4 de personalización del sitio: cualquier bloque puede tener
// imágenes libres (datos.imagenes: {id,url,x,y,escala}[]) posicionadas con
// x/y en % del espacio del bloque, reposicionables arrastrando desde el
// admin. Ver ImagenesLibres en Home.tsx y ImagenesEditor en Configuracion.tsx.

// data: URI en vez de una URL externa real — hermético y con tamaño
// intrínseco determinístico (importa para el test de drag, que depende del
// boundingBox de la imagen).
const IMG_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ff8800"/></svg>',
);

test.describe('Imágenes libres — sitio público', () => {
  test('un bloque con imágenes libres las renderiza en la posición configurada', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0,
          datos: {
            texto: 'Envío gratis',
            imagenes: [{ id: 'img-1', url: 'https://example.com/sticker.png', x: 20, y: 30, escala: 15 }],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const img = page.locator('img[src="https://example.com/sticker.png"]');
    await expect(img).toHaveCount(1);
    // Se verifica el style inline (left/top/width en %) en vez de toHaveCSS,
    // que resuelve a píxeles calculados a partir del ancho del viewport.
    await expect(img).toHaveAttribute('style', /left:\s*20%/);
    await expect(img).toHaveAttribute('style', /top:\s*30%/);
    await expect(img).toHaveAttribute('style', /width:\s*15%/);
  });

  test('un bloque sin imágenes libres no agrega ningún <img> extra', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    await expect(page.getByText('Envío gratis')).toBeVisible();
    await expect(page.locator('img')).toHaveCount(0);
  });
});

test.describe('Imágenes libres — admin', () => {
  test('permite agregar una imagen (por URL) y guardarla en datos.imagenes', async ({ page }) => {
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
    await tarjeta.getByRole('button').nth(3).click(); // expandir
    await page.getByRole('button', { name: 'Imágenes' }).click();

    await page.getByPlaceholder('https://... (URL externa)').fill('https://example.com/sticker.png');
    await expect(page.locator('[data-testid="imagen-libre-drag"]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const imagenes = putBody.secciones[0].datos.imagenes;
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0]).toMatchObject({ url: 'https://example.com/sticker.png', x: 50, y: 50, escala: 30 });
  });

  test('arrastrar una imagen dentro del recuadro actualiza su posición x/y', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{
          id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0,
          datos: { texto: 'Hola', imagenes: [{ id: 'img-1', url: IMG_DATA_URI, x: 50, y: 50, escala: 30 }] },
        }],
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
    await page.getByRole('button', { name: 'Imágenes' }).click();

    const drag = page.locator('[data-testid="imagen-libre-drag"]');
    await drag.waitFor({ state: 'visible' });
    const box = await drag.boundingBox();
    if (!box) throw new Error('no boundingBox');

    // Arrastra desde el centro de la imagen hacia la esquina superior izquierda del recuadro
    const contenedor = page.locator('[data-testid="imagen-libre-drag"]').locator('..');
    const contBox = await contenedor.boundingBox();
    if (!contBox) throw new Error('no contBox');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(50); // asegura que el pointerdown se procese antes de mover
    await page.mouse.move(contBox.x + contBox.width * 0.1, contBox.y + contBox.height * 0.1, { steps: 10 });
    await page.waitForTimeout(50);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const img = putBody.secciones[0].datos.imagenes[0];
    expect(img.x).toBeLessThan(30);
    expect(img.y).toBeLessThan(30);
  });

  test('permite eliminar una imagen libre', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        json: [{
          id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0,
          datos: { texto: 'Hola', imagenes: [{ id: 'img-1', url: 'https://example.com/sticker.png', x: 50, y: 50, escala: 30 }] },
        }],
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
    await page.getByRole('button', { name: 'Imágenes' }).click();

    await expect(page.locator('[data-testid="imagen-libre-drag"]')).toHaveCount(1);
    await page.locator('.bg-gray-50.rounded-lg.p-2.border').getByRole('button').click();
    await expect(page.locator('[data-testid="imagen-libre-drag"]')).toHaveCount(0);
  });
});

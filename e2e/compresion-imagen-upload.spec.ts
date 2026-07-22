import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Bugfix: las imágenes se subían tal cual las entregaba el input de
// archivo, sin resize ni recompresión (useSubirImagen.ts) — un hero de
// varios MB tardaba tanto en cargar que durante ese tiempo el bloque se
// veía como un rectángulo de color plano, fácil de confundir con "el
// efecto de transición no se aplicó". Fix: comprimirImagen() re-codifica a
// WebP y limita la dimensión máxima ANTES de subir, en el mismo hook que
// usan todos los uploaders (hero, categorías, productos, banners).

test.describe('Compresión de imagen al subir (useSubirImagen)', () => {
  test('una imagen grande (4000x3000) se re-codifica a WebP y pesa mucho menos antes de subirse', async ({ page }) => {
    await loginComoAdmin(page);

    // Interceptar FormData.append para capturar el File real que se envía,
    // sin depender de parsear el body multipart de la request de red.
    await page.addInitScript(() => {
      (window as any).__archivosSubidos = [];
      const originalAppend = FormData.prototype.append;
      FormData.prototype.append = function (name: string, value: any, fileName?: string) {
        if (name === 'file' && value instanceof File) {
          (window as any).__archivosSubidos.push({ type: value.type, size: value.size, name: value.name });
        }
        return originalAppend.call(this, name, value, fileName);
      };
    });

    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.route('**/api/v1/configuracion/imagen', (route) => route.fulfill({ json: { url: 'https://example.com/subida.webp' } }));

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Agregar sección' }).click();
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir

    // Generar un PNG grande (4000x3000, sin comprimir sería varios MB)
    // directo en el browser, sin depender de un archivo fixture en disco.
    const tamanioOriginal = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 4000;
      canvas.height = 3000;
      const ctx = canvas.getContext('2d')!;
      // Ruido pseudoaleatorio — una imagen lisa comprime demasiado bien y
      // no representaría una foto real de varios MB.
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = Math.random() * 255;
        imgData.data[i + 1] = Math.random() * 255;
        imgData.data[i + 2] = Math.random() * 255;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      const file = new File([blob], 'hero-grande.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return blob.size;
    });

    await expect.poll(async () => page.evaluate(() => (window as any).__archivosSubidos.length), { timeout: 10000 }).toBeGreaterThan(0);

    const subido = await page.evaluate(() => (window as any).__archivosSubidos[0]);
    expect(subido.type).toBe('image/webp');
    expect(subido.size).toBeLessThan(tamanioOriginal);
    // El resize a 1920px de máximo + WebP debería reducir drásticamente
    // una imagen de ruido de 4000x3000 — margen amplio para no ser frágil.
    expect(subido.size).toBeLessThan(tamanioOriginal * 0.7);
  });

  test('un GIF no se recomprime (se sube tal cual, para no perder la animación)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.addInitScript(() => {
      (window as any).__archivosSubidos = [];
      const originalAppend = FormData.prototype.append;
      FormData.prototype.append = function (name: string, value: any, fileName?: string) {
        if (name === 'file' && value instanceof File) {
          (window as any).__archivosSubidos.push({ type: value.type, size: value.size, name: value.name });
        }
        return originalAppend.call(this, name, value, fileName);
      };
    });
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.route('**/api/v1/configuracion/imagen', (route) => route.fulfill({ json: { url: 'https://example.com/subida.gif' } }));

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Agregar sección' }).click();
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();

    await page.evaluate(() => {
      // GIF mínimo válido (1x1, transparente) codificado a mano.
      const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='), c => c.charCodeAt(0));
      const file = new File([bytes], 'animado.gif', { type: 'image/gif' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect.poll(async () => page.evaluate(() => (window as any).__archivosSubidos.length), { timeout: 10000 }).toBeGreaterThan(0);
    const subido = await page.evaluate(() => (window as any).__archivosSubidos[0]);
    expect(subido.type).toBe('image/gif');
    expect(subido.name).toBe('animado.gif');
  });
});

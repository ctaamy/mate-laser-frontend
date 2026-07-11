import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// BUG: "cuando elimino algún bloque y pongo guardar, el botón no realiza
// ninguna acción y no se produce ningún cambio en el inicio".
//
// Causa real: la sección "navbar" migrada en el cliente (ver Fase 1 —
// navbar como bloque) se sintetizaba con `orden: -1`. El backend valida
// `orden >= 0` (@Min(0) en HomepageSeccionDto) sobre TODAS las secciones
// del payload, incluida la navbar — así que CUALQUIER guardado de
// /configuracion/homepage (borrar una sección, reordenar, lo que sea)
// fallaba con 400 Bad Request apenas la navbar migrada viajaba en el
// array. El botón "Guardar inicio" no mostraba ningún error, así que
// para el admin parecía que "no hacía nada". Fix: el sentinel de orden
// para la navbar migrada pasa a ser un número no negativo (999999) —
// el valor en sí es irrelevante porque la navbar se excluye de la lista
// reordenable por tipo, no por orden.

test.describe('BUG fix — eliminar una sección y guardar ya no falla por el orden del navbar', () => {
  test('el payload de guardado nunca manda un orden negativo para la sección navbar', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      // Sin sección "navbar" — dispara la migración cliente que antes
      // sintetizaba orden: -1.
      return route.fulfill({
        json: [
          { id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { slides: [{ titulo: 'Hola' }] } },
          { id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 1, datos: { texto: 'Envío gratis' } },
        ],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: { navbar_bg_color: '#ffffff' } });
    });

    await page.goto('/admin/configuracion');

    // Eliminar una sección pide confirmación (ver confirmaciones-admin.spec.ts).
    page.on('dialog', d => d.accept());

    // Elimina la primera sección (hero) — el botón trash es el 5to de la tarjeta.
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(4).click();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody).toBeTruthy();
    const navSec = putBody.secciones.find((s: any) => s.tipo === 'navbar');
    expect(navSec).toBeTruthy();
    expect(navSec.orden).toBeGreaterThanOrEqual(0);

    // Y la sección eliminada efectivamente no viaja en el guardado.
    expect(putBody.secciones.find((s: any) => s.id === 'hero-1')).toBeUndefined();
  });

  test('simula la validación real del backend (orden >= 0): con el fix, el guardado no devuelve 400', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        const invalido = body.secciones.some((s: any) => s.orden < 0);
        if (invalido) {
          return route.fulfill({
            status: 400,
            json: { statusCode: 400, message: ['secciones.5.orden must not be less than 0'] },
          });
        }
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{ id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 0, datos: { texto: 'Envío gratis' } }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Guardar inicio' }).click();

    // Antes del fix esto se quedaba colgado sin mensaje (la mutation fallaba
    // en silencio); con el fix, se ve la confirmación de éxito.
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
  });
});

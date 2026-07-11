import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// BUG: "sigue el mismo problema con el hero, no cambia" — al cambiar el
// color de Fondo/Texto en el tab Estilo del Hero, el sitio no reflejaba
// el cambio. Causa real (distinta del bug anterior, ya resuelto, del input
// que se vaciaba): TIPO_DEFAULTS.hero y SLIDE_DEFAULT precargaban CADA
// slide con su propio bg_color/texto_color ('#111111'/'#ffffff') desde el
// momento de creación. Como slide.bg_color siempre estaba presente, tapaba
// permanentemente el bg_color de bloque (el que edita el tab Estilo) — la
// cadena Slide → Bloque → Tema nunca llegaba a "Bloque" porque el primer
// nivel (Slide) nunca estaba vacío. Fix: los defaults de un slide nuevo ya
// no traen color propio, así heredan del bloque salvo que el admin
// explícitamente le ponga un color a ESE slide.

test.describe('Hero — el color del tab Estilo ahora impacta el sitio', () => {
  test('una sección Hero recién creada (vía "Agregar sección") responde al color de Estilo', async ({ page }) => {
    await loginComoAdmin(page);
    let seccionesGuardadas: any[] | null = null;
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        seccionesGuardadas = route.request().postDataJSON().secciones;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: seccionesGuardadas ?? [] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');

    // Agregar una sección Hero nueva (tipo por defecto del selector)
    await page.getByRole('button', { name: 'Agregar sección' }).click();

    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const fondoInput = page.getByText('Fondo del bloque (base)', { exact: true }).locator('..').locator('input:not([type="color"])');
    await fondoInput.fill('#ff00aa');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    // El slide nuevo no debe tener bg_color propio (así hereda del bloque)
    const heroGuardado = seccionesGuardadas!.find((s: any) => s.tipo === 'hero');
    expect(heroGuardado.datos.bg_color).toBe('#ff00aa');
    expect(heroGuardado.datos.slides[0].bg_color).toBeFalsy();

    // Y en el sitio público, el color de Estilo se ve reflejado
    await page.goto('/');
    const hero = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::div[contains(@class,"absolute") and contains(@class,"inset-0")][1]');
    await expect(hero).toHaveCSS('background-color', 'rgb(255, 0, 170)');
  });

  test('un slide con color propio ya guardado se puede "soltar" con el botón Heredar del bloque', async ({ page }) => {
    await loginComoAdmin(page);
    let seccionesGuardadas: any[] | null = null;
    const heroConColorViejo = {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { bg_color: '#ff00aa', slides: [{ titulo: 'Hola', bg_color: '#111111' }] },
    };
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        seccionesGuardadas = route.request().postDataJSON().secciones;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: seccionesGuardadas ?? [heroConColorViejo] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    // Tab Contenido (default) muestra el editor de slides con el botón "Heredar del bloque"
    await page.getByRole('button', { name: 'Heredar del bloque' }).first().click();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(seccionesGuardadas![0].datos.slides[0].bg_color).toBe('');
  });
});

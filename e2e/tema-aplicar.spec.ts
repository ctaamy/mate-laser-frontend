import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Punto 5 de la consolidación del sistema de tema/herencia: botones
// "Aplicar" / "Aplicar a todo" en el tab Tema. Ambos recorren bloques,
// títulos/subtítulos y botones y BORRAN la clave de override
// (bg_color/texto_color/font_family) — nunca escriben el valor del tema
// como fijo. "Aplicar a todo" lo hace siempre (destructivo, pide
// confirmación); "Aplicar" solo normaliza lo que ya estaba sin override
// (sin confirmación, no toca lo personalizado a mano).

// Mezcla de bloques con y sin override, para validar ambos botones:
// - hero: bloque CON override (bg_color), slide 0 CON override (texto_color)
//         + botón con override, slide 1 SIN override, ambos con botones.
// - banner_texto: bloque SIN override (bg_color/texto_color ausentes)
// - cta_banner: bloque CON override de subtítulo, botón SIN override.
function mezclaSecciones() {
  return [
    {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: {
        bg_color: '#111111', // bloque CON override
        slides: [
          { titulo: 'Slide 1', bg_color: '#222222', botones: [{ texto: 'A', link: '/a', bg_color: '#ff0000' }] }, // slide CON override + botón CON override
          { titulo: 'Slide 2', botones: [{ texto: 'B', link: '/b' }] }, // slide SIN override + botón SIN override
        ],
      },
    },
    {
      id: 'banner-1', tipo: 'banner_texto', activo: true, orden: 1,
      datos: { texto: 'Envío gratis' }, // SIN override
    },
    {
      id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 2,
      datos: {
        titulo: 'CTA', subtitulo: 'Sub', subtitulo_color: '#00ff00', // subtítulo CON override
        botones: [{ texto: 'Comprar', link: '/c' }], // botón SIN override
      },
    },
  ];
}

async function mockAdmin(page: import('@playwright/test').Page, onPut: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: mezclaSecciones() });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

test.describe('Tema — "Aplicar a todo"', () => {
  test('borra TODOS los overrides (bloques, subtítulos y botones), incluso los que ya tenían color propio', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, (body) => { putBody = body; });

    page.on('dialog', d => d.accept());

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('button', { name: 'Aplicar a todo' }).click();

    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(putBody).toBeTruthy();

    const [hero, banner, cta] = putBody.secciones;

    expect(hero.datos.bg_color).toBeUndefined();
    expect(hero.datos.slides[0].bg_color).toBeUndefined();
    expect(hero.datos.slides[0].botones[0].bg_color).toBeUndefined();
    expect(hero.datos.slides[1].bg_color).toBeUndefined();
    expect(hero.datos.slides[1].botones[0].bg_color).toBeUndefined();

    expect(banner.datos.bg_color).toBeUndefined();
    expect(banner.datos.texto_color).toBeUndefined();

    expect(cta.datos.subtitulo_color).toBeUndefined();
    expect(cta.datos.botones[0].bg_color).toBeUndefined();

    // El texto/link de cada botón/slide no se pierde — solo el estilo.
    expect(hero.datos.slides[0].botones[0].texto).toBe('A');
    expect(cta.datos.titulo).toBe('CTA');
  });

  test('pide confirmación antes de ejecutar — cancelar no cambia nada', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, (body) => { putBody = body; });

    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('button', { name: 'Aplicar a todo' }).click();
    await page.waitForTimeout(300);

    expect(putBody).toBeNull();
  });
});

test.describe('Tema — "Aplicar"', () => {
  test('normaliza solo lo que ya estaba sin override; lo personalizado a mano queda intacto', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();

    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(putBody).toBeTruthy();

    const [hero, banner, cta] = putBody.secciones;

    // Lo que YA tenía override propio se mantiene intacto.
    expect(hero.datos.bg_color).toBe('#111111');
    expect(hero.datos.slides[0].bg_color).toBe('#222222');
    expect(hero.datos.slides[0].botones[0].bg_color).toBe('#ff0000');
    expect(cta.datos.subtitulo_color).toBe('#00ff00');

    // Lo que YA estaba sin override sigue sin override (normalizado, sin clave).
    expect(banner.datos.bg_color).toBeUndefined();
    expect(banner.datos.texto_color).toBeUndefined();
    expect(hero.datos.slides[1].bg_color).toBeUndefined();
    expect(hero.datos.slides[1].botones[0].bg_color).toBeUndefined();
    expect(cta.datos.botones[0].bg_color).toBeUndefined();
  });

  test('no pide confirmación', async ({ page }) => {
    await loginComoAdmin(page);
    let dialogAppeared = false;
    page.on('dialog', d => { dialogAppeared = true; d.accept(); });
    await mockAdmin(page, () => {});

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await page.waitForTimeout(300);

    expect(dialogAppeared).toBe(false);
  });
});

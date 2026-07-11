import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 2 de personalización del sitio: el footer pasa a vivir como una
// sección más (tipo 'footer') dentro de homepage_sections, mismo criterio
// que el navbar (ver admin-navbar.spec.ts). A diferencia del navbar, no
// tenía ninguna clave suelta legacy — estaba 100% hardcodeado en
// Footer.tsx — así que la migración sintetiza la sección con esos mismos
// valores fijos (ver FOOTER_*_DEFAULT en Configuracion.tsx). Vive en el tab
// "Inicio" como una card fija y colapsable al FINAL (después de la lista
// reordenable y de "Agregar sección"), ya que el footer cierra la página.

const HERO_SECCION = {
  id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
  datos: { slides: [{ titulo: 'Hola' }] },
};

// Un solo handler por endpoint (evita registrar dos routes para el mismo
// patrón, que puede terminar cayendo a la red real en vez de al mock —
// ver el bug de admin-tema.spec.ts que encontramos con esto).
async function mockHomepage(page: import('@playwright/test').Page, seccionesIniciales: any[], onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: seccionesIniciales });
  });
}

async function mockConfig(page: import('@playwright/test').Page, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: config });
  });
}

test.describe('Admin — Footer como bloque', () => {
  test('migra el footer hardcodeado a una sección tipo "footer" al guardar', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [HERO_SECCION], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody).toBeTruthy();
    const secciones = putBody.secciones as any[];
    const footerSec = secciones.find((s) => s.tipo === 'footer');
    expect(footerSec).toBeTruthy();
    expect(footerSec.datos.bg_color).toBe('#0a0a0a');
    expect(footerSec.datos.texto_color).toBe('#ffffff');
    expect(footerSec.datos.tagline).toBe('Grabado láser personalizado · Todo Argentina');
    expect(footerSec.datos.copyright).toBe('© 2025 Mate Laser Studio');
    expect(footerSec.datos.links).toHaveLength(3);
    expect(footerSec.datos.redes).toHaveLength(1);
    // La sección de contenido existente no se pierde en la migración
    expect(secciones.find((s) => s.tipo === 'hero')).toBeTruthy();
  });

  test('el footer no aparece en la lista reordenable de "Inicio" ni en "Agregar sección"', async ({ page }) => {
    await loginComoAdmin(page);
    await mockHomepage(page, [HERO_SECCION, { id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }]);
    await mockConfig(page);

    await page.goto('/admin/configuracion');

    // Tab "Inicio": solo se ve la tarjeta de la sección hero, no una de footer
    // (se acota a las tarjetas de sección para no matchear el título de la card fija)
    const tituloTarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden .text-sm.font-medium');
    await expect(tituloTarjeta.filter({ hasText: 'Hero' })).toBeVisible();
    await expect(tituloTarjeta.filter({ hasText: 'Footer' })).toHaveCount(0);

    // El selector de "Agregar sección" no ofrece "Footer" como tipo
    const opciones = await page.locator('select').first().locator('option').allTextContents();
    expect(opciones).not.toContain('Footer');
  });

  test('permite editar color, tagline, links, redes y copyright, y guardarlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar footer' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await bgInput.fill('#112233');

    const taglineInput = page.getByText('Tagline', { exact: true }).locator('..').locator('input');
    await taglineInput.fill('Nuevo tagline');

    const copyrightInput = page.getByText('Copyright', { exact: true }).locator('..').locator('input');
    await copyrightInput.fill('© 2026 Nueva Marca');

    // Agrega un link secundario nuevo
    await page.getByText('Links secundarios', { exact: true }).locator('..')
      .getByRole('button', { name: 'Agregar' }).click();

    // Agrega una red social nueva
    await page.getByText('Redes sociales', { exact: true }).locator('..')
      .getByRole('button', { name: 'Agregar' }).click();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const footerSec = (putBody.secciones as any[]).find((s) => s.tipo === 'footer');
    expect(footerSec.datos.bg_color).toBe('#112233');
    expect(footerSec.datos.tagline).toBe('Nuevo tagline');
    expect(footerSec.datos.copyright).toBe('© 2026 Nueva Marca');
    expect(footerSec.datos.links).toHaveLength(4);
    expect(footerSec.datos.redes).toHaveLength(2);
  });
});

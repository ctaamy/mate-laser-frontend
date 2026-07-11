import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 1 de personalización del sitio: el navbar pasa a vivir como una
// sección más (tipo 'navbar') dentro de homepage_sections, para compartir
// la misma infraestructura de bloques (y así heredar del tema global y,
// más adelante, resize/botones/imágenes). Vive dentro del tab "Inicio" como
// una card fija y colapsable (no arrastrable, no eliminable) — no se mezcla
// con la lista reordenable de secciones ni con "Agregar sección".
//
// Migración: instalaciones que todavía no tienen una sección tipo 'navbar'
// la sintetizan en el cliente a partir de las claves sueltas legacy
// (navbar_bg_color, etc.) la primera vez que se carga /admin/configuracion.

const HERO_SECCION = {
  id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
  datos: { slides: [{ titulo: 'Hola' }] },
};

// Un solo handler por endpoint (evita registrar dos routes para el mismo
// patrón, que puede terminar cayendo a la red real en vez de al mock).
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

test.describe('Admin — Navbar como bloque', () => {
  test('migra las claves legacy (navbar_*) a una sección tipo "navbar" al guardar', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [HERO_SECCION], (body) => { putBody = body; });
    await mockConfig(page, { navbar_bg_color: '#222222', navbar_texto_color: '#eeeeee' });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    // Los valores legacy se ven reflejados (migración en memoria)
    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await expect(bgInput).toHaveValue('#222222');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody).toBeTruthy();
    const secciones = putBody.secciones as any[];
    // hero + navbar migrado + footer migrado (Fase 2 — ver admin-footer.spec.ts)
    expect(secciones).toHaveLength(3);
    const navSec = secciones.find((s) => s.tipo === 'navbar');
    expect(navSec).toBeTruthy();
    expect(navSec.datos.bg_color).toBe('#222222');
    expect(navSec.datos.texto_color).toBe('#eeeeee');
    // La sección de contenido existente no se pierde en la migración
    expect(secciones.find((s) => s.tipo === 'hero')).toBeTruthy();
    expect(secciones.find((s) => s.tipo === 'footer')).toBeTruthy();
  });

  test('el navbar no aparece en la lista reordenable de "Inicio" ni en "Agregar sección"', async ({ page }) => {
    await loginComoAdmin(page);
    await mockHomepage(page, [HERO_SECCION, { id: 'nav-1', tipo: 'navbar', activo: true, orden: -1, datos: {} }]);
    await mockConfig(page);

    await page.goto('/admin/configuracion');

    // Tab "Inicio": solo se ve la tarjeta de la sección hero, no una de navbar
    // (se acota a las tarjetas de sección para no matchear el botón del tab "Navbar")
    const tituloTarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden .text-sm.font-medium');
    await expect(tituloTarjeta.filter({ hasText: 'Hero' })).toBeVisible();
    await expect(tituloTarjeta.filter({ hasText: 'Navbar' })).toHaveCount(0);

    // El selector de "Agregar sección" no ofrece "Navbar" como tipo
    const opciones = await page.locator('select').first().locator('option').allTextContents();
    expect(opciones).not.toContain('Navbar');
  });

  test('permite editar color, tipografía e íconos del navbar y guardarlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [{ id: 'nav-1', tipo: 'navbar', activo: true, orden: -1, datos: {} }], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    const bgInput = page.getByText('Color de fondo', { exact: true })
      .locator('..').locator('input:not([type="color"])');
    await bgInput.fill('#334455');
    // El tab "Inicio" ahora también tiene el select de "Agregar sección" —
    // el de la fuente del navbar es el primero en el DOM (la card va antes
    // de la lista de secciones y de "Agregar sección").
    await page.locator('select').first().selectOption('Nunito, sans-serif');

    // Apaga el ícono de carrito
    await page.getByText('Carrito', { exact: true }).locator('xpath=../..').locator('button').click();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const navSec = (putBody.secciones as any[]).find((s) => s.tipo === 'navbar');
    expect(navSec.datos.bg_color).toBe('#334455');
    expect(navSec.datos.font_family).toBe('Nunito, sans-serif');
    expect(navSec.datos.mostrar_carrito).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 4 del Page Builder de Inicio: acción "Duplicar" en cada SeccionCard.
// Clona la sección completa (con datos propios, sin compartir referencia con
// el original) e la inserta inmediatamente después — ver duplicarSeccion en
// Configuracion.tsx.

const HERO = {
  id: 'hero-dup-1', tipo: 'hero', activo: true, orden: 0,
  datos: { slides: [{ titulo: 'Título original' }] },
};
const BANNER = {
  id: 'banner-dup-1', tipo: 'banner_texto', activo: true, orden: 1,
  datos: { texto: 'Envío gratis' },
};

async function mockConfiguracion(page: import('@playwright/test').Page, onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: [HERO, BANNER] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

test.describe('Duplicar sección', () => {
  test('duplica el bloque, lo inserta justo después del original y lo persiste al guardar', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');

    const tarjetaHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' }).first();
    // drag handle, ojo, chevron, duplicar, trash — el duplicar es el 4to botón.
    await tarjetaHero.getByRole('button').nth(3).click();

    // Ahora hay dos cards "Hero" (original + clon), antes del Banner.
    const cardsHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' });
    await expect(cardsHero).toHaveCount(2);

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody).toBeTruthy();
    const secciones = putBody.secciones as any[];
    const heroes = secciones.filter((s: any) => s.tipo === 'hero');
    expect(heroes).toHaveLength(2);
    // ids distintos — el clon no comparte referencia con el original.
    expect(heroes[0].id).not.toBe(heroes[1].id);
    expect(heroes[0].datos.slides[0].titulo).toBe('Título original');
    expect(heroes[1].datos.slides[0].titulo).toBe('Título original');

    // El clon queda inmediatamente después del original — antes del banner.
    const idxHero1 = secciones.findIndex((s: any) => s.id === heroes[0].id);
    const idxHero2 = secciones.findIndex((s: any) => s.id === heroes[1].id);
    const idxBanner = secciones.findIndex((s: any) => s.tipo === 'banner_texto');
    expect(idxHero2).toBe(idxHero1 + 1);
    expect(idxBanner).toBeGreaterThan(idxHero2);
  });

  test('editar el clon no modifica el original (datos clonados, no compartidos)', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');

    const tarjetaHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' }).first();
    await tarjetaHero.getByRole('button').nth(3).click(); // duplicar

    const cardsHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' });
    await expect(cardsHero).toHaveCount(2);

    // Expando el segundo (el clon) y abro el slide — el editor de contenido
    // del slide vive en un Drawer (portal fuera del árbol de la card).
    const clon = cardsHero.nth(1);
    await clon.getByRole('button').nth(2).click(); // chevron expandir la card
    await clon.getByText('Título original', { exact: true }).click(); // abrir el slide (Drawer)
    const tituloInput = page.getByRole('dialog').locator('textarea').first();
    await tituloInput.fill('Título del clon');
    await page.keyboard.press('Escape'); // cierro el Drawer antes de guardar

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const heroes = (putBody.secciones as any[]).filter((s: any) => s.tipo === 'hero');
    expect(heroes[0].datos.slides[0].titulo).toBe('Título original');
    expect(heroes[1].datos.slides[0].titulo).toBe('Título del clon');
  });
});

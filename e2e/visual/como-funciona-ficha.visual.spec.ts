import { test, expect } from '@playwright/test';

// Baseline visual de la variante 'ficha' (ficha técnica) de como_funciona:
// lista vertical, número grande y fino en columna izquierda + ícono a medida
// como sello, reglas hairline de 1px arriba / entre filas / abajo. Correr con
// `npx playwright test --project visual --update-snapshots` la primera vez.
//
// La variante 'tarjetas' (default) tiene su baseline en
// como-funciona-rediseno.visual.spec.ts.

async function mockHome(page: import('@playwright/test').Page, secciones: any[]) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const SECCION = {
  id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
  datos: {
    variante: 'ficha',
    titulo: 'De tu idea al mate, en 3 pasos',
    pasos: [
      { icono: 'Palette', titulo: 'Elegí y personalizá', desc: 'Sumá tu texto, logo o imagen desde el sitio o mandánoslo por WhatsApp.' },
      { icono: 'CheckCircle2', titulo: 'Aprobás el diseño', desc: 'Te mostramos cómo queda el grabado y lo confirmás antes de grabar.' },
      { icono: 'Truck', titulo: 'Lo grabamos y te llega', desc: 'Grabado láser sobre acero, madera o acrílico, con envío a todo el país y seguimiento.' },
    ],
    bg_color: '#0a2218', texto_color: '#ffffff',
  },
};

test.describe('Visual — como_funciona variante ficha técnica', () => {
  test('3 pasos, layout ficha técnica (desktop)', async ({ page }) => {
    await mockHome(page, [SECCION]);
    await page.goto('/');
    const section = page.getByRole('heading', { name: 'De tu idea al mate, en 3 pasos' }).locator('xpath=ancestor::section[1]');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900); // deja terminar el stagger de entrada (motion)
    await expect(section).toHaveScreenshot('como-funciona-ficha-desktop.png');
  });

  test('3 pasos, layout ficha técnica (mobile 375)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1000 });
    await mockHome(page, [SECCION]);
    await page.goto('/');
    const section = page.getByRole('heading', { name: 'De tu idea al mate, en 3 pasos' }).locator('xpath=ancestor::section[1]');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await expect(section).toHaveScreenshot('como-funciona-ficha-mobile.png');
  });
});

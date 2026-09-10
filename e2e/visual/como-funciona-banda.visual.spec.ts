import { test, expect } from '@playwright/test';

// Baseline visual de la variante 'banda' (banda plana) de como_funciona:
// franja a lo ancho, 3 pasos en fila con ícono fino a la izquierda + texto a
// la derecha, hairlines verticales entre columnas (desktop) / horizontales al
// apilar. Correr con `npx playwright test --project visual --update-snapshots`
// la primera vez.
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
    variante: 'banda',
    titulo: '¿Cómo funciona?',
    pasos: [
      { icono: 'Palette', titulo: 'Elegí y personalizá', desc: 'Sumá tu texto, logo o imagen desde el sitio o mandánoslo por WhatsApp.' },
      { icono: 'CheckCircle2', titulo: 'Aprobás el diseño', desc: 'Te mostramos cómo queda el grabado y lo confirmás antes de grabar.' },
      { icono: 'Truck', titulo: 'Lo grabamos y te llega', desc: 'Grabado láser sobre acero, madera o acrílico, con envío a todo el país y seguimiento.' },
    ],
    bg_color: '#0a2218', texto_color: '#ffffff',
  },
};

const seccionLoc = (page: import('@playwright/test').Page) =>
  page.getByText('1. Elegí y personalizá').locator('xpath=ancestor::section[1]');

test.describe('Visual — como_funciona variante banda plana', () => {
  test('3 pasos en fila, banda plana (desktop 1280)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockHome(page, [SECCION]);
    await page.goto('/');
    const section = seccionLoc(page);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900); // deja terminar el stagger de entrada (motion)
    await expect(section).toHaveScreenshot('como-funciona-banda-desktop.png');
  });

  test('3 pasos apilados, banda plana (tablet 768)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1000 });
    await mockHome(page, [SECCION]);
    await page.goto('/');
    const section = seccionLoc(page);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await expect(section).toHaveScreenshot('como-funciona-banda-tablet.png');
  });

  test('3 pasos apilados, banda plana (mobile 375)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1000 });
    await mockHome(page, [SECCION]);
    await page.goto('/');
    const section = seccionLoc(page);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await expect(section).toHaveScreenshot('como-funciona-banda-mobile.png');
  });
});

import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Rediseño de como_funciona: cards con ícono (lucide-react) + número chico +
// línea conectora sutil en acento, hover con leve elevación. Reemplaza el
// número gigante semi-transparente de antes.
//
// Ajustes: eyebrow configurable (antes "Proceso" hardcodeado, ahora
// opcional) y espaciado título→subtítulo configurable (titulo_subtitulo_gap,
// antes fijo en 0.5rem).

async function mockHome(page: import('@playwright/test').Page, secciones: any[]) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

test.describe('Visual — como_funciona rediseñado', () => {
  test('4 pasos con íconos, estilo por defecto', async ({ page }) => {
    await mockHome(page, [{
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: {
        eyebrow: 'Proceso', titulo: '¿Cómo funciona?', subtitulo: 'En 4 simples pasos tenés tu mate personalizado',
        pasos: [
          { icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' },
          { icono: 'CheckCircle2', titulo: 'Aprobás el arte', desc: 'Te enviamos una previsualización del grabado para tu visto bueno.' },
          { icono: 'Zap', titulo: 'Grabamos tu pieza', desc: 'Láser de precisión sobre acero inoxidable, madera o acrílico.' },
          { icono: 'Package', titulo: 'Lo recibís en casa', desc: 'Enviamos a todo el país con seguimiento en tiempo real.' },
        ],
        bg_color: '#0a2218', texto_color: '#ffffff', accent_color: '#E0672C',
      },
    }]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('como-funciona-4-pasos.png');
  });

  test('hover: la card sube levemente y el ícono escala', async ({ page }) => {
    await mockHome(page, [{
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: {
        pasos: [{ icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' }],
        bg_color: '#0a2218', texto_color: '#ffffff',
      },
    }]);
    await page.goto('/');
    const card = page.getByText('Elegís el diseño').locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await card.hover();
    await page.waitForTimeout(400);
    await expect(card).toHaveScreenshot('como-funciona-hover.png');
  });

  test('espaciado título → subtítulo amplio (titulo_subtitulo_gap: xl)', async ({ page }) => {
    await mockHome(page, [{
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: {
        titulo: '¿Cómo funciona?', subtitulo: 'En 4 simples pasos tenés tu mate personalizado',
        titulo_subtitulo_gap: 'xl',
        pasos: [{ icono: 'Palette', titulo: 'Elegís el diseño', desc: 'Subís tu logo, texto o imagen desde el sitio o por WhatsApp.' }],
        bg_color: '#0a2218', texto_color: '#ffffff',
      },
    }]);
    await page.goto('/');
    const header = page.getByRole('heading', { name: '¿Cómo funciona?' }).locator('xpath=ancestor::div[1]');
    await expect(header).toHaveScreenshot('como-funciona-gap-xl.png');
  });
});

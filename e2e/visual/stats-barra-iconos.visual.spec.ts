import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// stats_barra: íconos por item (lucide-react), escala general configurable,
// cantidad de estadísticas configurable con grid adaptable.

async function mockHome(page: import('@playwright/test').Page, secciones: any[]) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
}

const STATS_BASE = { id: 's-1', tipo: 'stats_barra', activo: true, orden: 0 };

test.describe('Visual — stats_barra con íconos', () => {
  test('4 estadísticas con íconos, estilo por defecto', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: {
        stats: [
          { valor: '1200+', label: 'Envíos', icono: 'Truck' },
          { valor: '48hs', label: 'Entrega', icono: 'Clock' },
          { valor: '100%', label: 'Personalizado', icono: 'BadgeCheck' },
          { valor: 'Retiro', label: 'Puntos estratégicos', icono: 'MapPin' },
        ],
        bg_color: '#1D9E75', texto_color: '#ffffff',
      },
    }]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('stats-barra-4-iconos.png');
  });

  test('escala chica (60%) — números, ícono y espaciado más chicos, sin mínimo', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: {
        stats: [
          { valor: '1200+', label: 'Envíos', icono: 'Truck' },
          { valor: '48hs', label: 'Entrega', icono: 'Clock' },
        ],
        bg_color: '#1D9E75', texto_color: '#ffffff', escala: 0.6,
      },
    }]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('stats-barra-escala-chica.png');
  });

  test('6 estadísticas — el grid se adapta sin huecos ni verse apretado', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: {
        stats: [
          { valor: '1', label: 'Uno', icono: 'Truck' },
          { valor: '2', label: 'Dos', icono: 'Clock' },
          { valor: '3', label: 'Tres', icono: 'BadgeCheck' },
          { valor: '4', label: 'Cuatro', icono: 'MapPin' },
          { valor: '5', label: 'Cinco', icono: 'Star' },
          { valor: '6', label: 'Seis', icono: 'Gift' },
        ],
        bg_color: '#241A15', texto_color: '#E0672C',
      },
    }]);
    await page.goto('/');
    await expect(page).toHaveScreenshot('stats-barra-6-items.png');
  });
});

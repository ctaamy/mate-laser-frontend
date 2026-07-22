import { test, expect } from '@playwright/test';

// stats_barra: íconos por item (lucide-react, lista curada), color propio
// configurable (default hereda texto_color), escala general del bloque
// (multiplicador proporcional sin mínimo hardcodeado), y cantidad de
// estadísticas configurable (agregar/quitar) con grid adaptable.

async function mockHome(page: import('@playwright/test').Page, secciones: any[], config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

const STATS_BASE = { id: 's-1', tipo: 'stats_barra', activo: true, orden: 0 };

test.describe('stats_barra — íconos', () => {
  test('cada item renderiza el ícono configurado (svg de lucide-react)', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }, { valor: '48hs', label: 'Entrega', icono: 'Clock' }] },
    }]);
    await page.goto('/');
    // lucide-react renderiza <svg class="lucide lucide-truck">
    await expect(page.locator('svg.lucide-truck')).toBeVisible();
    await expect(page.locator('svg.lucide-clock')).toBeVisible();
  });

  test('sin ícono configurado en un item, usa el fallback por posición (no queda sin ícono)', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: { stats: [{ valor: '1200+', label: 'Envíos' }] },
    }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-truck')).toBeVisible();
  });

  test('icon_color propio se aplica al ícono sin afectar el color del número', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], texto_color: '#111111', icon_color: '#ff8800' },
    }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-truck')).toHaveCSS('color', 'rgb(255, 136, 0)');
    await expect(page.getByText('1200+')).toHaveCSS('color', 'rgb(17, 17, 17)');
  });

  test('sin icon_color propio, el ícono hereda texto_color del bloque', async ({ page }) => {
    await mockHome(page, [{
      ...STATS_BASE,
      datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], texto_color: '#334455' },
    }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-truck')).toHaveCSS('color', 'rgb(51, 68, 85)');
  });
});

test.describe('stats_barra — escala general', () => {
  test('escala > 1 agranda el número proporcionalmente', async ({ page }) => {
    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], escala: 1 } }]);
    await page.goto('/');
    const fsBase = await page.getByText('1200+').evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], escala: 1.5 } }]);
    await page.goto('/');
    const fsGrande = await page.getByText('1200+').evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    expect(fsGrande).toBeGreaterThan(fsBase);
  });

  test('escala < 1 (sin mínimo hardcodeado) achica el número, el ícono y el padding del item juntos', async ({ page }) => {
    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], escala: 1 } }]);
    await page.goto('/');
    const fsBase = await page.getByText('1200+').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const iconBase = await page.locator('svg.lucide-truck').evaluate(el => parseFloat(getComputedStyle(el).width));
    const padBase = await page.locator('svg.lucide-truck').locator('..').evaluate(el => parseFloat(getComputedStyle(el).paddingTop));

    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }], escala: 0.5 } }]);
    await page.goto('/');
    const fsChico = await page.getByText('1200+').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const iconChico = await page.locator('svg.lucide-truck').evaluate(el => parseFloat(getComputedStyle(el).width));
    const padChico = await page.locator('svg.lucide-truck').locator('..').evaluate(el => parseFloat(getComputedStyle(el).paddingTop));

    expect(fsChico).toBeLessThan(fsBase);
    expect(iconChico).toBeLessThan(iconBase);
    expect(padChico).toBeLessThan(padBase);
  });

  test('sin escala configurada, el tamaño histórico no cambia (default 100%)', async ({ page }) => {
    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [{ valor: '1200+', label: 'Envíos', icono: 'Truck' }] } }]);
    await page.goto('/');
    const fs = await page.getByText('1200+').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    // 3rem (text-5xl, tope superior del clamp original) = 48px a este ancho de viewport
    expect(fs).toBeCloseTo(48, 0);
  });
});

test.describe('stats_barra — cantidad de estadísticas configurable', () => {
  for (const cantidad of [1, 2, 3, 4, 5, 6]) {
    test(`con ${cantidad} estadística(s), todas se renderizan sin romper el layout`, async ({ page }) => {
      const stats = Array.from({ length: cantidad }, (_, i) => ({ valor: `${i + 1}`, label: `Stat ${i + 1}`, icono: 'Star' }));
      await mockHome(page, [{ ...STATS_BASE, datos: { stats } }]);
      await page.goto('/');
      await expect(page.locator('svg.lucide-star')).toHaveCount(cantidad);
      for (let i = 0; i < cantidad; i++) {
        await expect(page.getByText(`Stat ${i + 1}`, { exact: true })).toBeVisible();
      }
    });
  }

  test('sin estadísticas (array vacío), el bloque no se renderiza', async ({ page }) => {
    await mockHome(page, [{ ...STATS_BASE, datos: { stats: [] } }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-star')).toHaveCount(0);
  });
});

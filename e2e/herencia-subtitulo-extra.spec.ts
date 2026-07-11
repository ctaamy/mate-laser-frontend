import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Punto 3 de la consolidación: subtítulo con estilo heredable
// (Subtítulo → Bloque → Tema) agregado a cta_banner (le faltaba el color
// propio), productos_destacados y categorias_grid (subtítulo nuevo).

test.describe('cta_banner — subtitulo_color heredable', () => {
  test('subtitulo_color propio se aplica', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Título', subtitulo: 'Subtítulo custom', subtitulo_color: '#ff8800' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Subtítulo custom')).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('sin subtitulo_color propio, hereda el texto_color del bloque', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0, datos: { titulo: 'Título', subtitulo: 'Hereda del bloque', texto_color: '#334455' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Hereda del bloque')).toHaveCSS('color', 'rgb(51, 68, 85)');
  });
});

test.describe('productos_destacados — subtítulo nuevo', () => {
  test('se renderiza con estilo heredado del tema cuando no hay overrides', async ({ page }) => {
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { titulo: 'Más vendidos', subtitulo: 'Elegidos por vos' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_texto_color: '#00ffcc' } }));
    await page.goto('/');
    await expect(page.getByText('Elegidos por vos')).toHaveCSS('color', 'rgb(0, 255, 204)');
  });

  test('subtitulo_color propio gana por sobre el texto_color del bloque', async ({ page }) => {
    await page.route('**/api/v1/productos**', (route) => route.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0,
          datos: { titulo: 'Más vendidos', subtitulo: 'Con override', subtitulo_color: '#ff0000', texto_color: '#334455' },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Con override')).toHaveCSS('color', 'rgb(255, 0, 0)');
  });
});

test.describe('categorias_grid — subtítulo nuevo', () => {
  test('se renderiza junto al título, heredando el texto_color del bloque', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { titulo: 'Categorías', subtitulo: 'Explorá todo', texto_color: '#334455' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Explorá todo')).toHaveCSS('color', 'rgb(51, 68, 85)');
  });

  test('sin subtítulo, no se renderiza ningún párrafo extra', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { titulo: 'Categorías' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Categorías' })).toBeVisible();
    await expect(page.getByText('Explorá todo')).toHaveCount(0);
  });
});

test.describe('admin — campos de subtítulo nuevos', () => {
  test('productos_destacados y categorias_grid exponen el campo Subtítulo en Contenido, y Color subtítulo en Estilo', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        json: [
          { id: 'prod-1', tipo: 'productos_destacados', activo: true, orden: 0, datos: { titulo: 'Más vendidos' } },
          { id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 1, datos: { titulo: 'Categorías' } },
        ],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjetas = page.locator('.bg-white.border.rounded-xl.overflow-hidden');

    // productos_destacados
    await tarjetas.nth(0).getByRole('button').nth(3).click();
    await expect(page.getByText('Subtítulo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Estilo' }).first().click();
    await expect(page.getByText('Color subtítulo')).toBeVisible();
    await tarjetas.nth(0).getByRole('button').nth(3).click(); // colapsar

    // categorias_grid
    await tarjetas.nth(1).getByRole('button').nth(3).click();
    await expect(page.getByText('Subtítulo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Estilo' }).first().click();
    await expect(page.getByText('Color subtítulo')).toBeVisible();
  });
});

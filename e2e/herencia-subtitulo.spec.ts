import { test, expect } from '@playwright/test';

// Punto 2 de la consolidación: como_funciona tenía el campo subtítulo en
// TIPO_DEFAULTS y en el editor (Configuracion.tsx), pero Home.tsx nunca lo
// renderizaba. Ahora se muestra, con color/tipografía heredables
// (Subtítulo → Bloque → Tema) vía heredaDeBloque().

test.describe('como_funciona — subtítulo ahora se renderiza', () => {
  test('con datos.subtitulo definido, se muestra en el sitio', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0, datos: { titulo: '¿Cómo funciona?', subtitulo: 'En 4 simples pasos' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.getByText('En 4 simples pasos')).toBeVisible();
  });

  test('sin datos.subtitulo, no se renderiza ningún párrafo extra', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0, datos: { titulo: '¿Cómo funciona?' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: '¿Cómo funciona?' })).toBeVisible();
    await expect(page.getByText('En 4 simples pasos')).toHaveCount(0);
  });

  test('subtitulo_color propio se aplica; sin él, hereda el texto_color del bloque', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
          datos: { titulo: 'Título', subtitulo: 'Con color propio', subtitulo_color: '#ff8800' },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Con color propio')).toHaveCSS('color', 'rgb(255, 136, 0)');
  });

  test('sin subtitulo_color propio, el subtítulo hereda el texto_color del bloque', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
          datos: { titulo: 'Título', subtitulo: 'Sin color propio', texto_color: '#334455' },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));
    await page.goto('/');
    await expect(page.getByText('Sin color propio')).toHaveCSS('color', 'rgb(51, 68, 85)');
  });

  test('ni subtitulo_color ni texto_color propios: hereda del tema global', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{ id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0, datos: { titulo: 'Título', subtitulo: 'Hereda del tema' } }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: { tema_texto_color: '#00ffcc' } }));
    await page.goto('/');
    await expect(page.getByText('Hereda del tema')).toHaveCSS('color', 'rgb(0, 255, 204)');
  });
});

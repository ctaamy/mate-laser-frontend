import { test, expect } from '@playwright/test';

// Screenshots de baseline: corren con `npx playwright test --update-snapshots`
// la primera vez, y luego detectan cambios visuales no intencionales.
//
// Cubre la Fase 4 de personalización: imágenes libres posicionadas dentro
// de un bloque (capa por encima del contenido, con position:absolute).

// Imágenes como data: URI — sin depender de red externa, el test queda hermético.
const CUADRADO_NARANJA = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ff8800"/></svg>',
);
const CUADRADO_AZUL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#0a2ed6"/></svg>',
);

test.describe('Visual — imágenes libres', () => {
  test('bloque con dos imágenes libres en distintas posiciones', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cta-1', tipo: 'cta_banner', activo: true, orden: 0,
          datos: {
            titulo: '¿Listo para personalizar tu mate?',
            min_height: '350',
            imagenes: [
              { id: 'img-1', url: CUADRADO_NARANJA, x: 15, y: 20, escala: 18 },
              { id: 'img-2', url: CUADRADO_AZUL, x: 85, y: 75, escala: 14 },
            ],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page).toHaveScreenshot('cta-banner-imagenes-libres.png');
  });
});

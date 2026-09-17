import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// Reorden de fotos (fusión es_principal = posición 0): cubre lo que se puede
// probar sin simular el gesto de drag real de Framer Motion (frágil de
// automatizar de forma confiable) — render de las 3 miniaturas con su
// número de posición, el badge "Principal" solo en la primera, y que
// eliminar una imagen la saca de la grilla. El endpoint de reorden en sí
// (PUT /imagenes/producto/:id/orden) queda cubierto por los tests unitarios
// de imagenes.service.spec.ts en el backend.

const IMG = (id: string, orden: number) => ({
  id, producto_id: PRODUCTO_ADMIN_MOCK.id, url: `https://example.com/${id}.webp`,
  alt_texto: '', orden, es_principal: orden === 0,
});

test.describe('Admin — tab Imágenes de producto', () => {
  test('muestra las miniaturas con su posición (1, 2, 3) y "Principal" solo en la primera', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route(`**/api/v1/imagenes/producto/${PRODUCTO_ADMIN_MOCK.id}`, (route) =>
      route.fulfill({ json: [IMG('img-a', 0), IMG('img-b', 1), IMG('img-c', 2)] }),
    );

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Imágenes' }).click();

    await expect(page.getByText('3/4 imágenes')).toBeVisible();
    await expect(page.getByText('Principal')).toHaveCount(1);
    // Números de posición siempre visibles (no dependen de hover).
    for (const n of ['1', '2', '3']) {
      await expect(page.getByText(n, { exact: true })).toBeVisible();
    }
    // Ya no existe el botón de estrella "marcar como principal" — se fusionó con la posición.
    await expect(page.getByTitle('Marcar como principal')).toHaveCount(0);
  });

  test('eliminar una imagen la saca de la grilla', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    await page.route(`**/api/v1/imagenes/producto/${PRODUCTO_ADMIN_MOCK.id}`, (route) =>
      route.fulfill({ json: [IMG('img-a', 0), IMG('img-b', 1)] }),
    );
    let borrada = false;
    await page.route('**/api/v1/imagenes/img-b', (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      borrada = true;
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Imágenes' }).click();

    await expect(page.getByText('2/4 imágenes')).toBeVisible();
    await page.getByTitle('Eliminar imagen').last().click();

    await expect.poll(() => borrada).toBe(true);
  });
});

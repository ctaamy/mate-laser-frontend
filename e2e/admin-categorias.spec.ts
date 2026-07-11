import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 6: las acciones (editar/eliminar) de una fila de
// SUBcategoría solo se mostraban con hover (opacity-0 group-hover:opacity-100),
// que en tablet/touch no existe — quedaban sin forma de descubrirlas. Ahora
// son siempre visibles, igual que ya lo eran las de la categoría padre.

const CATEGORIA_PADRE = {
  id: 1, nombre: 'Mates', slug: 'mates', descripcion: null, padre_id: null, orden: 0, activo: true,
  other_categorias: [
    { id: 2, nombre: 'Mates de acero', slug: 'mates-acero', descripcion: null, padre_id: 1, orden: 0, activo: true },
  ],
};

test.describe('Admin — Categorías — acciones de fila visibles sin hover', () => {
  test('las acciones de una subcategoría son visibles (opacity 1) sin necesidad de hover', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/categorias**', (route) => route.fulfill({ json: [CATEGORIA_PADRE] }));

    await page.goto('/admin/categorias');

    const filaSub = page.locator('div').filter({ hasText: 'Mates de acero' }).first();
    const botones = filaSub.locator('button');

    // Sin mover el mouse ni hacer hover: deben estar completamente opacas.
    await expect(botones.first()).toHaveCSS('opacity', '1');
    await expect(botones.last()).toHaveCSS('opacity', '1');
  });
});

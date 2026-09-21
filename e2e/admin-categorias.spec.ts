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

    // Categorías ya no es ruta de primer nivel — ahora vive como tab dentro
    // de /admin/productos (ver CategoriasPanel).
    await page.goto('/admin/productos');
    await page.getByRole('button', { name: 'Categorías' }).click();

    const filaSub = page.locator('div').filter({ hasText: 'Mates de acero' }).first();
    const botones = filaSub.locator('button');

    // Sin mover el mouse ni hacer hover: deben estar completamente opacas.
    await expect(botones.first()).toHaveCSS('opacity', '1');
    await expect(botones.last()).toHaveCSS('opacity', '1');
  });
});

// Borrado: una categoría activa se desactiva (soft-delete); una inactiva se
// elimina de verdad vía /definitivo (el backend solo lo permite si no tiene
// productos ni subcategorías y, si no, responde 400 con el motivo).
test.describe('Admin — Categorías — eliminar', () => {
  const INACTIVA = { id: 5, nombre: 'Vieja', slug: 'vieja', descripcion: null, padre_id: null, orden: 0, activo: false, other_categorias: [] };
  const ACTIVA = { id: 6, nombre: 'Nueva', slug: 'nueva', descripcion: null, padre_id: null, orden: 1, activo: true, other_categorias: [] };

  async function preparar(page: import('@playwright/test').Page, borrados: string[], respuestaBorrado: { status: number; json: any } = { status: 200, json: { ok: true } }) {
    await loginComoAdmin(page);
    await page.route('**/api/v1/categorias**', (route) => {
      if (route.request().method() === 'DELETE') {
        borrados.push(new URL(route.request().url()).pathname);
        return route.fulfill(respuestaBorrado);
      }
      return route.fulfill({ json: [INACTIVA, ACTIVA] });
    });
    await page.goto('/admin/productos');
    await page.getByRole('button', { name: 'Categorías' }).click();
  }

  test('una categoría inactiva se elimina definitivamente', async ({ page }) => {
    const borrados: string[] = [];
    await preparar(page, borrados);
    page.once('dialog', (d) => { expect(d.message()).toContain('definitivamente'); d.accept(); });
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect.poll(() => borrados).toEqual(['/api/v1/categorias/5/definitivo']);
  });

  test('una categoría activa solo se desactiva', async ({ page }) => {
    const borrados: string[] = [];
    await preparar(page, borrados);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Desactivar' }).click();
    await expect.poll(() => borrados).toEqual(['/api/v1/categorias/6']);
  });

  test('si el backend rechaza (tiene productos), muestra el motivo', async ({ page }) => {
    const borrados: string[] = [];
    await preparar(page, borrados, { status: 400, json: { message: 'No se puede eliminar: tiene 3 productos asignados.' } });
    const dialogos: string[] = [];
    page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
    await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect.poll(() => dialogos.length).toBe(2);
    expect(dialogos[1]).toContain('tiene 3 productos');
  });
});

import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Cobertura del bugfix reportado en el bloque "Categorías" (categorias_grid)
// del homepage builder:
//   1. El editor admin (CategoriasGridEditor) buscaba la categoría en la
//      lista SIN aplanar other_categorias (subcategorías anidadas) — a
//      diferencia del renderer público, que sí las aplana. Resultado:
//      "Agregar categoría" nunca ofrecía subcategorías, y cualquier item con
//      un id que no matcheaba se mostraba como "ID N" sin nombre.
//   2. Cada card estaba atada 1:1 a una categoría real: título siempre
//      cat.nombre, link siempre /productos?categoria_id=X, sin forma de
//      personalizarlos.
//   3. La solapa "Imágenes" (imágenes libres/flotantes) se mostraba también
//      para categorias_grid, donde no aporta nada (cada categoría ya tiene
//      su propia imagen en "Contenido").
// Ver CategoriasGridEditor en pages/admin/Configuracion.tsx y
// SeccionCategoriasGrid en components/home/HomeSecciones.tsx.

const CATEGORIA_CON_SUB = {
  id: 1, nombre: 'Mates', slug: 'mates', descripcion: null, padre_id: null, orden: 0, activo: true,
  other_categorias: [
    { id: 2, nombre: 'Mates de acero', slug: 'mates-acero', descripcion: null, padre_id: 1, orden: 0, activo: true },
  ],
};

test.describe('categorias_grid — admin — subcategorías aplanadas (bugfix)', () => {
  test('una subcategoría aparece para agregar y, agregada, se muestra con su nombre (no "ID N")', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [CATEGORIA_CON_SUB] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{ id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0, datos: { titulo: 'Categorías', categorias_items: [] } }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir

    // La subcategoría (anidada en other_categorias) debe estar disponible
    // para agregar junto a la raíz — antes del fix, nunca aparecía acá.
    const botonAgregarSub = page.locator('button').filter({ hasText: 'Mates de acero' });
    await expect(botonAgregarSub).toBeVisible();
    await botonAgregarSub.click();

    // Una vez agregada, se muestra con su nombre real (no "ID 2") — se
    // busca dentro de la tarjeta del editor, no en la vista previa en vivo
    // de al lado (que también renderiza "Mates de acero" en su card).
    await expect(tarjeta.getByText('ID 2')).toHaveCount(0);
    await expect(tarjeta.getByText('Mates de acero')).toBeVisible();
    await expect(tarjeta.getByText('subcategoría')).toBeVisible();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(putBody.secciones[0].datos.categorias_items).toMatchObject([{ id: 2 }]);
  });

  test('un item cuya categoría ya no existe muestra el aviso y se puede quitar de la lista', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    // La categoría con id 99 fue eliminada (soft-delete) — el endpoint ya
    // no la devuelve.
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', categorias_items: [{ id: 99, icono: '🧉' }] },
        }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();

    await expect(page.getByText('ya no existe')).toBeVisible();
    await page.getByRole('button', { name: 'Quitar' }).click();
    await expect(page.getByText('ya no existe')).toHaveCount(0);

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(putBody.secciones[0].datos.categorias_items).toEqual([]);
  });
});

test.describe('categorias_grid — título y link personalizados por categoría (bugfix)', () => {
  test('admin — se pueden completar y se persisten en el guardado', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await page.route('**/api/v1/categorias', (route) =>
      route.fulfill({ json: [{ id: 1, nombre: 'Mates', slug: 'mates', descripcion: null, padre_id: null, orden: 0, activo: true, other_categorias: [] }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        putBody = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', categorias_items: [{ id: 1, icono: '☕' }] },
        }],
      });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();

    // Placeholder = valor por defecto (nombre/link reales de la categoría).
    await page.getByPlaceholder('Mates').fill('Catálogo de diseño');
    await page.getByPlaceholder('/productos?categoria_id=1').fill('/catalogo-diseno');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const item = putBody.secciones[0].datos.categorias_items[0];
    expect(item).toMatchObject({ id: 1, titulo: 'Catálogo de diseño', link: '/catalogo-diseno' });
  });

  test('sitio público — un item con título/link propios los usa en vez de los de la categoría real', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) =>
      route.fulfill({ json: [{ id: 1, nombre: 'Mates', slug: 'mates', descripcion: null, padre_id: null, orden: 0, activo: true, other_categorias: [] }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: {
            titulo: 'Categorías',
            categorias_items: [{ id: 1, icono: '☕', titulo: 'Catálogo de diseño', link: '/catalogo-diseno' }],
          },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    await expect(page.getByText('Catálogo de diseño')).toBeVisible();
    await expect(page.getByText('Mates', { exact: true })).toHaveCount(0);
    const link = page.locator('a').filter({ hasText: 'Catálogo de diseño' });
    await expect(link).toHaveAttribute('href', '/catalogo-diseno');
  });

  test('sitio público — sin título/link propios, sigue usando el nombre y el link de la categoría real', async ({ page }) => {
    await page.route('**/api/v1/categorias', (route) =>
      route.fulfill({ json: [{ id: 1, nombre: 'Mates', slug: 'mates', descripcion: null, padre_id: null, orden: 0, activo: true, other_categorias: [] }] }),
    );
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'cat-1', tipo: 'categorias_grid', activo: true, orden: 0,
          datos: { titulo: 'Categorías', categorias_items: [{ id: 1, icono: '☕' }] },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const link = page.locator('a').filter({ hasText: 'Mates' });
    await expect(link).toHaveAttribute('href', '/productos?categoria_id=1');
  });
});

test.describe('categorias_grid — admin — solapa "Imágenes" no aplica (bugfix)', () => {
  test('la solapa "Imágenes" no aparece para categorias_grid, pero sí para hero', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/categorias', (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        json: [
          { id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { titulo: 'Hero título' } },
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

    // hero — sí tiene la solapa.
    await tarjetas.nth(0).getByRole('button').nth(3).click();
    await expect(page.getByRole('button', { name: 'Imágenes' })).toBeVisible();
    await tarjetas.nth(0).getByRole('button').nth(3).click(); // colapsar

    // categorias_grid — no la tiene.
    await tarjetas.nth(1).getByRole('button').nth(3).click();
    await expect(page.getByRole('button', { name: 'Imágenes' })).toHaveCount(0);
  });
});

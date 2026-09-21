import { test, expect, type Page } from '@playwright/test';

// Extensión del desplegable de categorías del navbar: un link a
// /productos?categoria_id=N de una categoría raíz con subcategorías visibles
// (ej. "Diseños") despliega un menú compacto con "Ver todo" + sus hijas. Mismo
// mecanismo (hover con intención, touch, teclado) y mismo toggle del admin
// (`menu_categorias`) que el panel ancho de "Productos".

const cat = (id: number, nombre: string, padre_id: number | null, orden: number, cantidad_productos: number) =>
  ({ id, nombre, slug: `c-${id}`, padre_id, orden, activo: true, cantidad_productos });

const CATEGORIAS = [
  cat(1, 'Mates', null, 1, 18),
  cat(2, 'Mates de Acero', 1, 1, 2),
  cat(6, 'Diseños', null, 3, 5),
  cat(7, 'Signos Zodiacales', 6, 1, 0), // vacía: no se lista
  cat(8, 'Rock Nacional', 6, 2, 5),
  cat(10, 'Termos', null, 5, 2),        // raíz sin hijas
];

const LINKS = [
  { label: 'Productos', href: '/productos' },
  { label: 'Diseños', href: '/productos?categoria_id=6' },
  { label: 'Termos', href: '/productos?categoria_id=10' },
  { label: 'Taller', href: '/nosotros' },
];

async function mocks(page: Page, navDatos: Record<string, unknown> = {}) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: CATEGORIAS }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) =>
    r.fulfill({ json: [{ id: 'nav', tipo: 'navbar', activo: true, orden: -1, datos: { tipo_menu: 'tradicional', links: LINKS, ...navDatos } }] }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.fulfill({ json: {} }));
}

const nav = (page: Page) => page.locator('nav').first();
// .first(): el link de la barra va antes en el DOM que el que repite el panel ancho de "Productos".
const linkDisenos = (page: Page) => nav(page).getByRole('link', { name: 'Diseños', exact: true }).first();
const panelDisenos = (page: Page) => page.locator('#submenu-categoria-6');
const megaProductos = (page: Page) => page.locator('#mega-categorias');

test.describe('Navbar — desplegable de una categoría raíz (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hover en "Diseños" abre "Ver todo" + sus subcategorías (sin las vacías)', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await expect(panelDisenos(page)).toHaveCount(0);

    await linkDisenos(page).hover();
    await expect(panelDisenos(page)).toBeVisible();
    await expect(panelDisenos(page).getByRole('link', { name: 'Ver todo Diseños' })).toHaveAttribute('href', '/productos?categoria_id=6');
    await expect(panelDisenos(page).getByRole('link', { name: 'Rock Nacional' })).toHaveAttribute('href', '/productos?categoria_id=8');
    await expect(panelDisenos(page).getByRole('link', { name: 'Signos Zodiacales' })).toHaveCount(0);
    await expect(megaProductos(page)).toHaveCount(0);
  });

  test('queda pegado a la base de la barra y debajo del link (no tapa la barra)', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkDisenos(page).hover();
    await expect(panelDisenos(page)).toBeVisible();
    const barra = (await nav(page).boundingBox())!;
    const link = (await linkDisenos(page).boundingBox())!;
    // El panel entra animado (sube 6px en 0,16s): se espera a que se asiente.
    await expect
      .poll(async () => Math.abs((await panelDisenos(page).boundingBox())!.y - (barra.y + barra.height)))
      .toBeLessThanOrEqual(2);
    expect((await panelDisenos(page).boundingBox())!.x).toBeLessThanOrEqual(link.x + 1);
  });

  test('bajar del link al panel no lo cierra; salir del todo sí', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkDisenos(page).hover();
    await expect(panelDisenos(page)).toBeVisible();

    await panelDisenos(page).getByRole('link', { name: 'Rock Nacional' }).hover();
    await page.waitForTimeout(400);
    await expect(panelDisenos(page)).toBeVisible();

    await page.mouse.move(640, 700);
    await expect(panelDisenos(page)).toHaveCount(0);
  });

  test('a lo sumo uno abierto: pasar de "Productos" a "Diseños" cambia de panel', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await nav(page).getByRole('link', { name: 'Productos', exact: true }).hover();
    await expect(megaProductos(page)).toBeVisible();

    await linkDisenos(page).hover();
    await expect(panelDisenos(page)).toBeVisible();
    await expect(megaProductos(page)).toHaveCount(0);
  });

  test('clickear "Diseños" navega a su categoría; elegir una subcategoría navega y cierra', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkDisenos(page).click();
    await expect(page).toHaveURL(/categoria_id=6/);

    // Un click rápido no deja abierto el panel (el timer del hover se cancela)...
    await page.waitForTimeout(400);
    await expect(panelDisenos(page)).toHaveCount(0);
    // ...y como el mouse quedó sobre el link, hay que salir y volver a entrar.
    await page.mouse.move(640, 700);
    await linkDisenos(page).hover();
    await panelDisenos(page).getByRole('link', { name: 'Rock Nacional' }).click();
    await expect(page).toHaveURL(/categoria_id=8/);
    await expect(panelDisenos(page)).toHaveCount(0);
  });

  test('un link a una categoría sin subcategorías, o a otra ruta, no despliega nada ni tiene chevron', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Ver subcategorías de Termos' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver subcategorías de Taller' })).toHaveCount(0);
    await nav(page).getByRole('link', { name: 'Termos', exact: true }).hover();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-submenu-panel]')).toHaveCount(0);
  });

  test('teclado: Enter en el chevron abre y enfoca el primer link; Esc cierra y devuelve el foco', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    const chevron = page.getByRole('button', { name: 'Ver subcategorías de Diseños' });
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');

    await chevron.focus();
    await page.keyboard.press('Enter');
    await expect(panelDisenos(page)).toBeVisible();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await expect(panelDisenos(page).locator('a').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panelDisenos(page)).toHaveCount(0);
    await expect(chevron).toBeFocused();
  });

  test('con menu_categorias apagado en el admin tampoco hay desplegable de "Diseños"', async ({ page }) => {
    await mocks(page, { menu_categorias: false });
    await page.goto('/');
    await linkDisenos(page).hover();
    await page.waitForTimeout(300);
    await expect(panelDisenos(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver subcategorías de Diseños' })).toHaveCount(0);
  });

  test('hereda los colores del navbar', async ({ page }) => {
    await mocks(page, { bg_color: '#141010', texto_color: '#ffffff' });
    await page.goto('/');
    await linkDisenos(page).hover();
    await expect(panelDisenos(page)).toBeVisible();
    await expect(panelDisenos(page)).toHaveCSS('background-color', 'rgb(20, 16, 16)');
    await expect(panelDisenos(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
});

test.describe('Navbar — desplegable de una categoría raíz (touch, tablet)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('el primer toque en "Diseños" despliega sin navegar; el segundo, en "Ver todo", navega', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkDisenos(page).tap();
    await expect(panelDisenos(page)).toBeVisible();
    await expect(page).toHaveURL(/localhost:5173\/$/);

    await panelDisenos(page).getByRole('link', { name: 'Ver todo Diseños' }).tap();
    await expect(page).toHaveURL(/categoria_id=6/);
    await expect(panelDisenos(page)).toHaveCount(0);
  });
});

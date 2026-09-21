import { test, expect, type Page } from '@playwright/test';

// Fase 2 de la navegación por categorías: el link a /productos del navbar
// (modo Tradicional, desktop) despliega las categorías. Hover con intención
// en mouse, primer toque despliega en touch, teclado y Esc; se apaga con el
// toggle `menu_categorias` del admin.

const cat = (id: number, nombre: string, padre_id: number | null, orden: number, cantidad_productos: number) =>
  ({ id, nombre, slug: `c-${id}`, padre_id, orden, activo: true, cantidad_productos });

const CATEGORIAS = [
  cat(1, 'Mates', null, 1, 18),
  cat(2, 'Mates de Acero', 1, 1, 2),
  cat(3, 'Mates de Algarrobo', 1, 2, 11),
  cat(4, 'Bombillas', null, 2, 5),
  cat(5, 'Bombillas de Acero', 4, 1, 3),
  cat(6, 'Diseños', null, 3, 5),
  cat(7, 'Signos Zodiacales', 6, 1, 0), // vacía: no se lista
  cat(8, 'Rock Nacional', 6, 2, 5),
  cat(9, 'Cortes en MDF', null, 9, 0),  // vacía: no se lista
  cat(10, 'Termos', null, 5, 2),
  cat(11, 'Llaveros', null, 6, 2),
];

async function mocks(page: Page, navDatos: Record<string, any> = {}) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: CATEGORIAS }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) =>
    r.fulfill({
      json: [{
        id: 'nav', tipo: 'navbar', activo: true, orden: -1,
        datos: { tipo_menu: 'tradicional', links: [{ label: 'Productos', href: '/productos' }, { label: 'Taller', href: '/nosotros' }], ...navDatos },
      }],
    }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.fulfill({ json: {} }));
}

const panel = (page: Page) => page.locator('#mega-categorias');
const linkProductos = (page: Page) => page.locator('nav').first().getByRole('link', { name: 'Productos', exact: true });

test.describe('Navbar — desplegable de categorías (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hover abre el panel: una columna por raíz con hijas, "Más" para las sueltas, sin vacías', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await expect(panel(page)).toHaveCount(0);

    await linkProductos(page).hover();
    await expect(panel(page)).toBeVisible();

    // Títulos de columna = raíz con hijas, linkean a toda la raíz
    await expect(panel(page).getByRole('link', { name: 'Mates', exact: true })).toHaveAttribute('href', '/productos?categoria_id=1');
    await expect(panel(page).getByRole('link', { name: 'Mates de Algarrobo' })).toHaveAttribute('href', '/productos?categoria_id=3');
    await expect(panel(page).getByRole('link', { name: 'Rock Nacional' })).toBeVisible();
    // Sueltas bajo "Más"
    await expect(panel(page).getByText('Más', { exact: true })).toBeVisible();
    await expect(panel(page).getByRole('link', { name: 'Termos' })).toBeVisible();
    await expect(panel(page).getByRole('link', { name: 'Llaveros' })).toBeVisible();
    // Vacías fuera
    await expect(panel(page).getByRole('link', { name: 'Signos Zodiacales' })).toHaveCount(0);
    await expect(panel(page).getByRole('link', { name: 'Cortes en MDF' })).toHaveCount(0);
    // Sin contadores en el menú
    await expect(panel(page)).not.toContainText('18');
    await expect(panel(page).getByRole('link', { name: 'Ver todos los productos' })).toHaveAttribute('href', '/productos');
  });

  test('no es un <nav> nuevo (los selectores nav.last() del menú mobile siguen válidos)', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).hover();
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('nav')).toHaveCount(1);
  });

  test('sacar el mouse cierra el panel (con demora), y pasar del link al panel no lo cierra', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).hover();
    await expect(panel(page)).toBeVisible();

    // Cruzar hacia el panel: sigue abierto
    await panel(page).getByRole('link', { name: 'Mates de Acero' }).hover();
    await page.waitForTimeout(400);
    await expect(panel(page)).toBeVisible();

    // Salir del todo: se cierra
    await page.mouse.move(640, 700);
    await expect(panel(page)).toHaveCount(0);
  });

  test('clickear "Productos" con mouse navega a /productos', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).click();
    await expect(page).toHaveURL(/\/productos$/);
    await expect(panel(page)).toHaveCount(0);
  });

  test('elegir una categoría navega y cierra el panel', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).hover();
    await panel(page).getByRole('link', { name: 'Rock Nacional' }).click();
    await expect(page).toHaveURL(/categoria_id=8/);
    await expect(panel(page)).toHaveCount(0);
  });

  test('teclado: Enter en el chevron abre y manda el foco al panel; Esc cierra y devuelve el foco', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    const chevron = page.getByRole('button', { name: 'Ver categorías' });
    await expect(chevron).toHaveAttribute('aria-expanded', 'false');

    await chevron.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page).locator('a').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(chevron).toBeFocused();
  });

  test('ArrowDown sobre el link abre el panel', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel(page)).toBeVisible();
  });

  test('clickear afuera cierra el panel abierto con el chevron', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ver categorías' }).click();
    await expect(panel(page)).toBeVisible();
    await page.mouse.click(300, 700);
    await expect(panel(page)).toHaveCount(0);
  });

  test('hereda los colores del navbar', async ({ page }) => {
    await mocks(page, { bg_color: '#141010', texto_color: '#ffffff' });
    await page.goto('/');
    await linkProductos(page).hover();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveCSS('background-color', 'rgb(20, 16, 16)');
    await expect(panel(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
  });

  test('con menu_categorias apagado en el admin, no hay chevron ni panel', async ({ page }) => {
    await mocks(page, { menu_categorias: false });
    await page.goto('/');
    await linkProductos(page).hover();
    await page.waitForTimeout(300);
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver categorías' })).toHaveCount(0);
  });

  test('en modo Hamburguesa no hay desplegable de desktop', async ({ page }) => {
    await mocks(page, { tipo_menu: 'hamburguesa' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Ver categorías' })).toHaveCount(0);
  });

  test('un link que no es /productos no despliega nada', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await page.locator('nav').first().getByRole('link', { name: 'Taller', exact: true }).hover();
    await page.waitForTimeout(300);
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe('Navbar — desplegable de categorías (touch, tablet)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('el primer toque en "Productos" despliega sin navegar; "Ver todos" navega', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await linkProductos(page).tap();
    await expect(panel(page)).toBeVisible();
    await expect(page).toHaveURL(/localhost:5173\/$/);

    await panel(page).getByRole('link', { name: 'Ver todos los productos' }).tap();
    await expect(page).toHaveURL(/\/productos$/);
    await expect(panel(page)).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';

// Fase 1b de la navegación por categorías: sidebar en acordeón con contadores
// y sin categorías vacías, chips mobile sobre la grilla y acordeón "Productos"
// en el menú del navbar (sin la lista plana de antes).

const cat = (id: number, nombre: string, padre_id: number | null, orden: number, cantidad_productos: number) =>
  ({ id, nombre, slug: nombre.toLowerCase().replace(/\s/g, '-'), padre_id, orden, activo: true, cantidad_productos });

const CATEGORIAS = [
  cat(1, 'Mates', null, 1, 18),
  cat(2, 'Mates de Acero', 1, 1, 2),
  cat(3, 'Mates de Algarrobo', 1, 2, 11),
  cat(4, 'Bombillas', null, 2, 5),
  cat(5, 'Bombillas de Acero', 4, 1, 3),
  cat(6, 'Diseños', null, 3, 5),
  cat(7, 'Signos Zodiacales', 6, 1, 0), // vacía
  cat(8, 'Rock Nacional', 6, 2, 5),
  cat(9, 'Cortes en MDF', null, 9, 0),  // vacía sin hijas
  cat(10, 'Termos', null, 5, 2),
];

async function mocks(page: Page) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: CATEGORIAS }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0, page: 1, totalPages: 1 } }));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) =>
    r.fulfill({ json: [{ id: 'nav', tipo: 'navbar', activo: true, orden: -1, datos: { links: [{ label: 'Productos', href: '/productos' }, { label: 'Taller', href: '/nosotros' }] } }] }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.fulfill({ json: {} }));
}

test.describe('Catálogo — sidebar de categorías (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sin categorías vacías, con contadores y en el orden configurado', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos');
    const aside = page.locator('aside');
    await expect(aside.getByRole('button', { name: 'Mates', exact: true })).toBeVisible();

    // Orden por `orden`: Mates, Bombillas, Diseños, Termos. "Cortes en MDF" (0 productos) no aparece.
    const raices = aside.getByRole('button', { name: /^(Todos|Mates|Bombillas|Diseños|Termos|Cortes en MDF)$/ });
    await expect(raices).toHaveText(['Todos', 'Mates18', 'Bombillas5', 'Diseños5', 'Termos2']);

    // El contador se ve pero no ensucia el nombre accesible (por eso el match exacto anterior anda).
    await expect(aside.getByRole('button', { name: 'Mates', exact: true })).toContainText('18');
  });

  test('acordeón: solo se ve abierta la rama activa; el chevron abre y cierra a mano', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos');
    const aside = page.locator('aside');
    await expect(aside.getByRole('button', { name: 'Mates de Acero' })).toHaveCount(0);

    await aside.getByRole('button', { name: 'Mates', exact: true }).click();
    await expect(page).toHaveURL(/categoria_id=1/);
    await expect(aside.getByRole('button', { name: 'Mates de Acero' })).toBeVisible();
    await expect(aside.getByRole('button', { name: 'Bombillas de Acero' })).toHaveCount(0);

    // Abrir otra rama a mano con el chevron sin cambiar la selección
    await aside.getByRole('button', { name: 'Expandir Bombillas' }).click();
    await expect(aside.getByRole('button', { name: 'Bombillas de Acero' })).toBeVisible();
    await expect(page).toHaveURL(/categoria_id=1/);

    await aside.getByRole('button', { name: 'Bombillas de Acero' }).click();
    await expect(page).toHaveURL(/categoria_id=5/);
    await expect(aside.getByRole('button', { name: 'Bombillas de Acero' })).toHaveAttribute('aria-current', 'true');
  });

  test('las subcategorías vacías no se listan, pero una vacía elegida por URL sigue visible', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos?categoria_id=6');
    const aside = page.locator('aside');
    await expect(aside.getByRole('button', { name: 'Rock Nacional' })).toBeVisible();
    await expect(aside.getByRole('button', { name: 'Signos Zodiacales' })).toHaveCount(0);

    await page.goto('/productos?categoria_id=7');
    await expect(aside.getByRole('button', { name: 'Signos Zodiacales' })).toHaveAttribute('aria-current', 'true');
  });

  test('la sidebar es sticky', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos');
    await expect(page.locator('aside')).toHaveCSS('position', 'sticky');
  });
});

test.describe('Catálogo — chips de categorías (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('cambian la categoría de un toque, muestran las hijas de la activa y no listan vacías', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos');
    const chips = page.getByTestId('categorias-chips');
    await expect(chips.getByRole('button', { name: 'Mates', exact: true })).toBeVisible();
    await expect(chips.getByRole('button', { name: 'Cortes en MDF' })).toHaveCount(0);
    await expect(chips.getByRole('button', { name: 'Mates de Acero' })).toHaveCount(0);

    await chips.getByRole('button', { name: 'Mates', exact: true }).click();
    await expect(page).toHaveURL(/categoria_id=1/);
    await expect(chips.getByRole('button', { name: 'Mates', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await chips.getByRole('button', { name: 'Mates de Algarrobo' }).click();
    await expect(page).toHaveURL(/categoria_id=3/);
    // la raíz sigue marcada y la fila de hijas sigue abierta
    await expect(chips.getByRole('button', { name: 'Mates', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(chips.getByRole('button', { name: 'Mates de Algarrobo' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('en desktop los chips no se ven', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mocks(page);
    await page.goto('/productos');
    await expect(page.getByTestId('categorias-chips')).toBeHidden();
  });
});

test.describe('Navbar — menú mobile con acordeón de categorías', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test('"Productos" expande las categorías; las raíces con hijas expanden de a una; sin vacías', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await page.getByLabel('Abrir menú').click();
    const panel = page.locator('nav').last();

    // Cerrado por defecto: nada de la lista plana de antes
    await expect(panel.getByRole('link', { name: 'Termos' })).toHaveCount(0);
    const productos = panel.getByRole('button', { name: 'Productos', exact: true });
    await expect(productos).toHaveAttribute('aria-expanded', 'false');

    await productos.click();
    await expect(productos).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByRole('link', { name: 'Ver todos los productos' })).toHaveAttribute('href', '/productos');
    await expect(panel.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/productos?categoria_id=10');
    await expect(panel.getByRole('link', { name: 'Cortes en MDF' })).toHaveCount(0);

    // Rama: una abierta a la vez
    await panel.getByRole('button', { name: 'Mates', exact: true }).click();
    await expect(panel.getByRole('link', { name: 'Todo Mates' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Mates de Acero' })).toBeVisible();
    await panel.getByRole('button', { name: 'Bombillas', exact: true }).click();
    await expect(panel.getByRole('link', { name: 'Mates de Acero' })).toHaveCount(0);
    await expect(panel.getByRole('link', { name: 'Bombillas de Acero' })).toBeVisible();

    // Elegir una subcategoría navega y cierra el menú
    await panel.getByRole('link', { name: 'Bombillas de Acero' }).click();
    await expect(page).toHaveURL(/categoria_id=5/);
    await expect(page.getByLabel('Cerrar menú')).toHaveCount(0);
  });

  test('estando en una categoría, el menú abre con su rama desplegada', async ({ page }) => {
    await mocks(page);
    await page.goto('/productos?categoria_id=3');
    await page.getByLabel('Abrir menú').click();
    const panel = page.locator('nav').last();
    await expect(panel.getByRole('link', { name: 'Mates de Algarrobo' })).toBeVisible();
  });

  test('los links que no son de productos se siguen viendo normales', async ({ page }) => {
    await mocks(page);
    await page.goto('/');
    await page.getByLabel('Abrir menú').click();
    await expect(page.locator('nav').last().getByRole('link', { name: 'Taller' })).toHaveAttribute('href', '/nosotros');
  });
});

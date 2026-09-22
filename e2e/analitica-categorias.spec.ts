import { test, expect, type Page } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Eventos de Umami de la navegación por categorías (docs/analitica.md).
// En dev/tests no hay script de Umami: se instala un stub de `window.umami` que
// registra cada llamada a track() para verificar nombre, datos y origen.

const cat = (id: number, nombre: string, padre_id: number | null, orden: number, cantidad_productos: number) =>
  ({ id, nombre, slug: `c-${id}`, padre_id, orden, activo: true, cantidad_productos });

const CATEGORIAS = [
  cat(1, 'Mates', null, 1, 18),
  cat(3, 'Mates de Algarrobo', 1, 2, 11),
  cat(6, 'Diseños', null, 3, 5),
  cat(7, 'Signos Zodiacales', 6, 1, 0),
  cat(8, 'Rock Nacional', 6, 2, 5),
  cat(10, 'Termos', null, 5, 2),
];

const LINKS = [
  { label: 'Productos', href: '/productos' },
  { label: 'Diseños', href: '/productos?categoria_id=6' },
  { label: 'Taller', href: '/nosotros' },
];

type Evento = { n: string; d?: Record<string, unknown> };

async function conUmami(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __eventos: unknown[]; umami: unknown };
    w.__eventos = [];
    w.umami = { track: (n: string, d?: unknown) => w.__eventos.push({ n, d }) };
  });
}
const eventos = (page: Page, nombre?: string) =>
  page.evaluate((n) => ((window as unknown as { __eventos: Evento[] }).__eventos).filter((e) => !n || e.n === n), nombre);

async function mocks(page: Page) {
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: CATEGORIAS }));
  await page.route(/\/api\/v1\/productos(\?.*)?$/, (r) => {
    const id = new URL(r.request().url()).searchParams.get('categoria_id');
    const total = id === '7' || id === '999' ? 0 : 3;
    return r.fulfill({ json: { data: [], total, page: 1, totalPages: 1 } });
  });
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) =>
    r.fulfill({ json: [{ id: 'nav', tipo: 'navbar', activo: true, orden: -1, datos: { tipo_menu: 'tradicional', links: LINKS } }] }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.fulfill({ json: {} }));
}

const nav = (page: Page) => page.locator('nav').first();
const linkBarra = (page: Page, nombre: string) => nav(page).getByRole('link', { name: nombre, exact: true }).first();

test.describe('Umami — navbar (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('abrir el panel de Productos y elegir una categoría', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    await linkBarra(page, 'Productos').hover();
    await expect(page.locator('#mega-categorias')).toBeVisible();
    expect(await eventos(page, 'nav_desplegable_abre')).toEqual([{ n: 'nav_desplegable_abre', d: { menu: 'Productos', via: 'mouse' } }]);

    await page.locator('#mega-categorias').getByRole('link', { name: 'Mates de Algarrobo' }).click();
    expect(await eventos(page, 'nav_categoria_click')).toEqual([
      { n: 'nav_categoria_click', d: { origen: 'navbar_panel', categoria: 'Mates de Algarrobo', categoria_id: 3, nivel: 'hija' } },
    ]);
  });

  test('en el panel: título de columna = raíz; "Ver todos los productos" = todos', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    await linkBarra(page, 'Productos').hover();
    await page.locator('#mega-categorias').getByRole('link', { name: 'Mates', exact: true }).click();
    await page.mouse.move(640, 700);
    await linkBarra(page, 'Productos').hover();
    await page.locator('#mega-categorias').getByRole('link', { name: 'Ver todos los productos' }).click();

    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'navbar_panel', categoria: 'Mates', categoria_id: 1, nivel: 'raiz' },
      { origen: 'navbar_panel', categoria: 'todos', nivel: 'todos' },
    ]);
  });

  test('desplegable de "Diseños": abre y elegir una subcategoría', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    await linkBarra(page, 'Diseños').hover();
    await expect(page.locator('#submenu-categoria-6')).toBeVisible();
    expect(await eventos(page, 'nav_desplegable_abre')).toEqual([{ n: 'nav_desplegable_abre', d: { menu: 'Diseños', via: 'mouse' } }]);

    await page.locator('#submenu-categoria-6').getByRole('link', { name: 'Rock Nacional' }).click();
    expect(await eventos(page, 'nav_categoria_click')).toEqual([
      { n: 'nav_categoria_click', d: { origen: 'navbar_submenu', categoria: 'Rock Nacional', categoria_id: 8, nivel: 'hija' } },
    ]);
  });

  test('click directo en el link "Diseños" de la barra; "Taller" no cuenta', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    await linkBarra(page, 'Diseños').click();
    await page.mouse.move(640, 700);
    await linkBarra(page, 'Taller').click();

    expect(await eventos(page, 'nav_categoria_click')).toEqual([
      { n: 'nav_categoria_click', d: { origen: 'navbar_link', categoria: 'Diseños', categoria_id: 6, nivel: 'raiz' } },
    ]);
  });

  test('abrir con teclado se registra como via "teclado"', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    const chevron = page.getByRole('button', { name: 'Ver subcategorías de Diseños' });
    await chevron.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#submenu-categoria-6')).toBeVisible();
    expect(await eventos(page, 'nav_desplegable_abre')).toEqual([{ n: 'nav_desplegable_abre', d: { menu: 'Diseños', via: 'teclado' } }]);
  });

  test('sin Umami (dev, bloqueador de anuncios) la UI funciona igual, sin errores', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await mocks(page); // sin stub de umami: window.umami no existe
    await page.goto('/');
    await linkBarra(page, 'Diseños').hover();
    await page.locator('#submenu-categoria-6').getByRole('link', { name: 'Rock Nacional' }).click();
    await expect(page).toHaveURL(/categoria_id=8/);
    expect(errores).toEqual([]);
  });
});

test.describe('Umami — navbar (touch, tablet)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('el primer toque abre (via "toque") y NO cuenta como click; el segundo, sí', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    await linkBarra(page, 'Diseños').tap();
    await expect(page.locator('#submenu-categoria-6')).toBeVisible();
    expect(await eventos(page, 'nav_desplegable_abre')).toEqual([{ n: 'nav_desplegable_abre', d: { menu: 'Diseños', via: 'toque' } }]);
    expect(await eventos(page, 'nav_categoria_click')).toEqual([]);

    await page.locator('#submenu-categoria-6').getByRole('link', { name: 'Ver todo Diseños' }).tap();
    expect(await eventos(page, 'nav_categoria_click')).toEqual([
      { n: 'nav_categoria_click', d: { origen: 'navbar_submenu', categoria: 'Diseños', categoria_id: 6, nivel: 'raiz' } },
    ]);
  });
});

test.describe('Umami — menú mobile', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test('categoría, "Ver todos" y link de otra sección', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/');
    const abrirProductos = async () => {
      await page.getByLabel('Abrir menú').click();
      const panel = page.locator('nav').last();
      const productos = panel.getByRole('button', { name: 'Productos', exact: true });
      await expect(productos).toBeVisible();
      if ((await productos.getAttribute('aria-expanded')) !== 'true') await productos.click();
      return panel;
    };
    // Tras elegir un link del menú hay que esperar a que la navegación se asiente Y
    // a que el panel termine de salir (queda solo el <nav> de la barra) antes de
    // reabrirlo: React Router aplica el cambio de ruta con baja prioridad y el efecto
    // que cierra el menú al navegar puede llegar después de un "Abrir menú" apurado
    // y cerrar el panel recién reabierto (flake ~40% bajo carga).
    const esperarCierre = async (url: RegExp) => {
      await expect(page).toHaveURL(url);
      await expect(page.locator('nav')).toHaveCount(1);
    };

    let panel = await abrirProductos();
    await panel.getByRole('link', { name: 'Termos' }).click();
    await esperarCierre(/categoria_id=10$/);

    panel = await abrirProductos();
    await panel.getByRole('link', { name: 'Ver todos los productos' }).click();
    await esperarCierre(/\/productos$/);

    await page.getByLabel('Abrir menú').click();
    await page.locator('nav').last().getByRole('link', { name: 'Taller' }).click();
    await expect(page).toHaveURL(/\/nosotros$/);

    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'menu_mobile', categoria: 'Termos', categoria_id: 10, nivel: 'raiz' },
      { origen: 'menu_mobile', categoria: 'todos', nivel: 'todos' },
    ]);
  });
});

test.describe('Umami — filtros de /productos', () => {
  test('sidebar (desktop): raíz, hija y Todos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await conUmami(page);
    await mocks(page);
    await page.goto('/productos');
    const aside = page.locator('aside');
    await aside.getByRole('button', { name: 'Mates', exact: true }).click();
    await aside.getByRole('button', { name: 'Mates de Algarrobo' }).click();
    await aside.getByRole('button', { name: 'Todos' }).click();

    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'sidebar', categoria: 'Mates', categoria_id: 1, nivel: 'raiz' },
      { origen: 'sidebar', categoria: 'Mates de Algarrobo', categoria_id: 3, nivel: 'hija' },
      { origen: 'sidebar', categoria: 'todos', nivel: 'todos' },
    ]);
  });

  test('chips y drawer (mobile) se distinguen por origen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await conUmami(page);
    await mocks(page);
    await page.goto('/productos');
    await page.getByTestId('categorias-chips').getByRole('button', { name: 'Termos' }).click();
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await page.getByTestId('filtros-drawer').getByRole('button', { name: 'Diseños', exact: true }).click();

    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'chips', categoria: 'Termos', categoria_id: 10, nivel: 'raiz' },
      { origen: 'drawer', categoria: 'Diseños', categoria_id: 6, nivel: 'raiz' },
    ]);
  });
});

test.describe('Umami — categoria_vacia_vista', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('una sola vez al llegar a una categoría sin productos', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/productos?categoria_id=7');
    await expect(page.getByText('No hay productos')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await eventos(page, 'categoria_vacia_vista')).toEqual([
      { n: 'categoria_vacia_vista', d: { categoria: 'Signos Zodiacales', categoria_id: 7 } },
    ]);
  });

  test('un id de categoría inexistente se reporta como "desconocida"', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/productos?categoria_id=999');
    await expect(page.getByText('No hay productos')).toBeVisible();
    expect(await eventos(page, 'categoria_vacia_vista')).toEqual([
      { n: 'categoria_vacia_vista', d: { categoria: 'desconocida', categoria_id: 999 } },
    ]);
  });

  test('no se dispara con productos, ni con búsqueda o "aptos para grabar" combinados', async ({ page }) => {
    await conUmami(page);
    await mocks(page);
    await page.goto('/productos?categoria_id=8');
    await page.waitForTimeout(500);
    await page.goto('/productos?categoria_id=7&apto_grabado=true');
    await page.waitForTimeout(500);
    await page.goto('/productos?categoria_id=7&q=mate');
    await page.waitForTimeout(800);
    expect(await eventos(page, 'categoria_vacia_vista')).toEqual([]);
  });
});

test.describe('Umami — breadcrumb de la ficha', () => {
  const PRODUCTO = { ...PRODUCTO_MOCK, categorias: { id: 3, nombre: 'Mates de Algarrobo', slug: 'c-3', padre_id: 1 } };

  async function mocksPdp(page: Page) {
    await mocks(page);
    await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (r) =>
      r.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
    );
    await page.route('**/api/v1/productos/promociones-bancarias', (r) => r.fulfill({ json: {} }));
    await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (r) => r.fulfill({ json: { data: [], algoritmo: 'heuristica' } }));
    await page.route(`**/api/v1/productos/${PRODUCTO_MOCK.slug}`, (r) => r.fulfill({ json: PRODUCTO }));
  }

  test('desktop: padre = raíz, categoría = hija, Productos = todos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await conUmami(page);
    await mocksPdp(page);
    const migas = () => page.getByRole('navigation', { name: 'Migas de pan' });
    const ficha = `/productos/${PRODUCTO_MOCK.slug}`;

    // Todo dentro de la SPA (goBack no recarga): el stub acumula los eventos.
    await page.goto(ficha);
    await migas().getByRole('link', { name: 'Mates', exact: true }).click();
    await expect(page).toHaveURL(/categoria_id=1$/);
    await page.goBack();
    await migas().getByRole('link', { name: 'Mates de Algarrobo' }).click();
    await expect(page).toHaveURL(/categoria_id=3$/);
    await page.goBack();
    await migas().getByRole('link', { name: 'Productos', exact: true }).click();
    await expect(page).toHaveURL(/\/productos$/);

    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'migas', categoria: 'Mates', categoria_id: 1, nivel: 'raiz' },
      { origen: 'migas', categoria: 'Mates de Algarrobo', categoria_id: 3, nivel: 'hija' },
      { origen: 'migas', categoria: 'todos', nivel: 'todos' },
    ]);
  });

  test('mobile: el link de retorno cuenta como la categoría hija', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await conUmami(page);
    await mocksPdp(page);
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);
    await page.getByRole('navigation', { name: 'Migas de pan' }).getByRole('link', { name: 'Mates de Algarrobo' }).click();
    expect((await eventos(page, 'nav_categoria_click')).map((e) => e.d)).toEqual([
      { origen: 'migas', categoria: 'Mates de Algarrobo', categoria_id: 3, nivel: 'hija' },
    ]);
  });
});

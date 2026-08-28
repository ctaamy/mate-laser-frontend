import { test, expect, type Page } from '@playwright/test';

// Fase 1 (buscador funcional) + Fase 2 (autocompletado):
// - El término vive en la URL (?q=): el buscador del navbar navega a
//   /productos?q=… y la página lo lee, lo siembra en el input y filtra.
// - Mientras se tipea aparece un dropdown de sugerencias (GET
//   /productos/sugerencias?q=…); ↑/↓ + Enter navega al PDP, Esc cierra.
// - El <select> de orden escribe ?orden=… en la URL.

const PRODUCTOS = [
  { id: 'p1', nombre: 'Mate Imperial de Algarrobo', slug: 'mate-imperial', precio_base: 12000, disponible: true, cantidad_maxima: 5, apto_grabado: true, colores_disponibles: [], personalizado_habilitado: false, personalizado_max_chars: 30, activo: true, destacado: true, orden: 1, creado_en: new Date().toISOString(), imagenes_producto: [] },
  { id: 'p2', nombre: 'Mate Torpedo de Algarrobo', slug: 'mate-torpedo', precio_base: 9000, disponible: true, cantidad_maxima: 5, apto_grabado: false, colores_disponibles: [], personalizado_habilitado: false, personalizado_max_chars: 30, activo: true, destacado: false, orden: 2, creado_en: new Date().toISOString(), imagenes_producto: [] },
];

async function mockApi(page: Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (r) => r.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.request().method() === 'GET' ? r.fulfill({ json: {} }) : r.continue());
  await page.route(/\/api\/v1\/categorias$/, (r) => r.fulfill({ json: [] }));

  // Un solo handler para todo /productos* — ramifica según la ruta. Se
  // registra al final para ganarle a cualquier patrón previo.
  await page.route(/\/api\/v1\/productos(\/|\?|$)/, (route) => {
    const url = new URL(route.request().url());
    const sp = url.searchParams;

    if (url.pathname.endsWith('/productos/sugerencias')) {
      const q = (sp.get('q') || '').toLowerCase();
      const items = PRODUCTOS
        .filter((p) => q.split(/\s+/).filter(Boolean).every((t) => p.nombre.toLowerCase().includes(t)))
        .map((p) => ({ nombre: p.nombre, slug: p.slug, imagen: null }));
      return route.fulfill({ json: items });
    }

    const slugMatch = url.pathname.match(/\/productos\/([a-z0-9-]+)$/);
    if (slugMatch) {
      const p = PRODUCTOS.find((x) => x.slug === slugMatch[1]) ?? PRODUCTOS[0];
      return route.fulfill({ json: { ...p, tipos_opcion: [], variantes_producto: [], resenas_producto: [] } });
    }

    // Listado del catálogo: filtra por search= y ordena por orden=.
    const search = (sp.get('search') || '').toLowerCase();
    let data = PRODUCTOS.filter((p) => !search || p.nombre.toLowerCase().includes(search));
    if (sp.get('orden') === 'precio_asc') data = [...data].sort((a, b) => a.precio_base - b.precio_base);
    return route.fulfill({ json: { data, total: data.length, page: 1, totalPages: 1 } });
  });
}

test.describe('Buscador — URL, filtro y sugerencias', () => {
  test.beforeEach(async ({ page }) => { await mockApi(page); });

  test('el buscador del navbar navega a /productos?q= y la página lo aplica', async ({ page }) => {
    await page.goto('/');
    const pill = page.getByPlaceholder('Buscar', { exact: true });
    await pill.fill('torpedo');
    await pill.press('Enter');

    await expect(page).toHaveURL(/\/productos\?q=torpedo/);
    await expect(page.getByPlaceholder('Buscar producto...')).toHaveValue('torpedo');
    await expect(page.getByText('Mate Torpedo de Algarrobo')).toBeVisible();
    await expect(page.getByText('Mate Imperial de Algarrobo')).toHaveCount(0);
  });

  test('entrar directo a /productos?q= siembra el input y filtra', async ({ page }) => {
    await page.goto('/productos?q=imperial');
    await expect(page.getByPlaceholder('Buscar producto...')).toHaveValue('imperial');
    await expect(page.getByText('Mate Imperial de Algarrobo')).toBeVisible();
    await expect(page.getByText('Mate Torpedo de Algarrobo')).toHaveCount(0);
  });

  test('el dropdown de sugerencias aparece al tipear y filtra por palabra (AND)', async ({ page }) => {
    await page.goto('/productos');
    const input = page.getByPlaceholder('Buscar producto...');
    // scope al listbox del buscador — el <select> de orden también tiene <option>s.
    const opciones = page.getByRole('listbox').getByRole('option');
    await input.fill('mate');
    await expect(opciones).toHaveCount(2);

    await input.fill('mate torp');
    // toHaveText con array = exactamente 1 opción y su texto matchea — atómico,
    // sin ventana de carrera entre el count y el contains mientras debouncea.
    await expect(opciones).toHaveText([/Torpedo/]);

    await input.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('↓ + Enter en una sugerencia navega al producto', async ({ page }) => {
    await page.goto('/productos');
    const input = page.getByPlaceholder('Buscar producto...');
    const opciones = page.getByRole('listbox').getByRole('option');
    await input.fill('imperial');
    await expect(opciones).toHaveCount(1);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/productos\/mate-imperial$/);
  });

  test('el orden se refleja en la URL', async ({ page }) => {
    await page.goto('/productos');
    await page.locator('select').selectOption('precio_asc');
    await expect(page).toHaveURL(/orden=precio_asc/);
  });
});

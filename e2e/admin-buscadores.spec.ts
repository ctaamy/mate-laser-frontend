import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 3 — búsquedas del panel resueltas server-side:
// - Admin → Productos: manda ?search= y ?categoria_id= al backend (antes
//   filtraba en el cliente sobre los primeros 100).
// - Admin → Órdenes: nuevo buscador que manda ?search= (por #orden, cliente,
//   email).

const PRODUCTOS = [
  { id: 'pa', nombre: 'Mate Imperial', slug: 'mate-imperial', sku: 'MLS-1', categoria_id: 1, precio_base: 8000, stock: 5, activo: true, destacado: false, orden: 1, creado_en: new Date().toISOString(), categorias: { nombre: 'Mates' }, imagenes_producto: [], variantes_producto: [] },
  { id: 'pb', nombre: 'Bombilla Alpaca', slug: 'bombilla-alpaca', sku: 'MLS-2', categoria_id: 2, precio_base: 3000, stock: 9, activo: true, destacado: false, orden: 2, creado_en: new Date().toISOString(), categorias: { nombre: 'Bombillas' }, imagenes_producto: [], variantes_producto: [] },
];

const ORDENES = [
  { id: '111aaaaa-0000-0000-0000-000000000001', estado: 'pagado', canal: 'web', total: 8000, metodo_pago: 'mercadopago', creado_en: new Date().toISOString(), items_orden: [], pagos: [], usuarios: { id: 'u1', email: 'ana@mail.com', nombre: 'Ana', apellido: 'Pérez' }, direccion_envio: {}, envios_orden: [] },
  { id: '222bbbbb-0000-0000-0000-000000000002', estado: 'pendiente', canal: 'admin_manual', total: 5000, metodo_pago: 'efectivo', creado_en: new Date().toISOString(), items_orden: [], pagos: [], usuarios: null, direccion_envio: { nombre: 'Carlos Gómez' }, envios_orden: [] },
];

async function mocksComunes(page: Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (r) => r.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => (r.request().method() === 'GET' ? r.fulfill({ json: {} }) : r.continue()));
  await page.route(/\/api\/v1\/categorias$/, (r) => r.fulfill({ json: [{ id: 1, nombre: 'Mates' }, { id: 2, nombre: 'Bombillas' }] }));
}

test.describe('Admin — Productos: búsqueda server-side', () => {
  test('la búsqueda y el filtro de categoría se mandan al backend y filtran el listado', async ({ page }) => {
    await loginComoAdmin(page);
    await mocksComunes(page);

    const requests: string[] = [];
    await page.route(/\/api\/v1\/productos\/admin\/todos/, (route) => {
      const sp = new URL(route.request().url()).searchParams;
      requests.push(route.request().url());
      const search = (sp.get('search') || '').toLowerCase();
      const cat = sp.get('categoria_id');
      let data = PRODUCTOS.filter((p) => !search || p.nombre.toLowerCase().includes(search));
      if (cat) data = data.filter((p) => String(p.categoria_id) === cat);
      route.fulfill({ json: { data, total: data.length } });
    });

    await page.goto('/admin/productos');
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
    await expect(page.getByText('Mate Imperial')).toBeVisible();
    await expect(page.getByText('Bombilla Alpaca')).toBeVisible();

    await page.getByPlaceholder('Buscar por nombre, SKU o slug...').fill('bombilla');
    await expect(page.getByText('Mate Imperial')).toHaveCount(0);
    await expect(page.getByText('Bombilla Alpaca')).toBeVisible();
    expect(requests.some((u) => u.includes('search=bombilla'))).toBe(true);

    // limpiar y filtrar por categoría
    await page.getByPlaceholder('Buscar por nombre, SKU o slug...').fill('');
    await page.locator('select').first().selectOption('1');
    await expect(page.getByText('Bombilla Alpaca')).toHaveCount(0);
    await expect(page.getByText('Mate Imperial')).toBeVisible();
    expect(requests.some((u) => u.includes('categoria_id=1'))).toBe(true);
  });
});

test.describe('Admin — Órdenes: buscador nuevo', () => {
  test('escribir en el buscador manda ?search= y filtra la tabla', async ({ page }) => {
    await loginComoAdmin(page);
    await mocksComunes(page);

    const requests: string[] = [];
    await page.route(/\/api\/v1\/ordenes\?/, (route) => {
      const sp = new URL(route.request().url()).searchParams;
      requests.push(route.request().url());
      const q = (sp.get('search') || '').toLowerCase();
      const data = ORDENES.filter((o) => {
        if (!q) return true;
        const cliente = o.usuarios ? `${o.usuarios.nombre} ${o.usuarios.apellido} ${o.usuarios.email}` : o.direccion_envio?.nombre ?? '';
        return o.id.includes(q) || cliente.toLowerCase().includes(q);
      });
      route.fulfill({ json: { data } });
    });

    await page.goto('/admin/ordenes');
    await expect(page.getByRole('heading', { name: 'Órdenes' })).toBeVisible();
    await expect(page.getByText('Ana Pérez')).toBeVisible();
    await expect(page.getByText('Carlos Gómez')).toBeVisible();

    await page.getByPlaceholder('Buscar por #orden, cliente o email...').fill('gómez');
    await expect(page.getByText('Ana Pérez')).toHaveCount(0);
    await expect(page.getByText('Carlos Gómez')).toBeVisible();
    expect(requests.some((u) => /search=g/i.test(u))).toBe(true);
  });
});

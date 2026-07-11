import type { Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Fixtures para los tests de UI del panel admin.
// Mismo patrón que fixtures.ts: mockeamos el backend vía page.route para
// tests herméticos, sin depender de Postgres real.
// ─────────────────────────────────────────────────────────────────────────

export const ADMIN_MOCK = {
  id: 'admin-e2e-1',
  email: 'admin@test.com',
  nombre: 'Admin',
  apellido: 'Test',
  rol: 'admin',
};

export const PRODUCTO_ADMIN_MOCK = {
  id: 'prod-admin-1',
  nombre: 'Mate Imperial Grabado',
  slug: 'mate-imperial-grabado',
  descripcion: 'Mate de acero con grabado láser personalizado',
  categoria_id: 1,
  precio_base: 8000,
  precio_tachado: null,
  stock: 10,
  stock_alerta: 2,
  sku: 'MLS-001',
  material: 'Acero inoxidable 304',
  dimensiones: '300 ml',
  peso_kg: 0.3,
  apto_grabado: true,
  costo_grabado: 500,
  colores_disponibles: ['negro', 'blanco'],
  personalizado_habilitado: true,
  personalizado_max_chars: 20,
  personalizado_placeholder: 'Ej: Para Juan',
  activo: true,
  destacado: true,
  orden: 1,
  creado_en: new Date().toISOString(),
  categorias: { nombre: 'Mates' },
};

// Sembramos el localStorage con el store de auth (zustand persist) ya
// autenticado como admin, para no tener que pasar por el formulario de login.
export async function loginComoAdmin(page: Page) {
  await page.addInitScript(
    ({ usuario, token }) => {
      window.localStorage.setItem(
        'auth-storage-v2',
        JSON.stringify({ state: { usuario, token, isAuthenticated: true }, version: 0 }),
      );
    },
    { usuario: ADMIN_MOCK, token: 'fake-admin-token' },
  );
}

export async function mockBackendAdminProductos(
  page: Page,
  opts: { putStatus?: number } = {},
) {
  await page.route('**/api/v1/productos/admin/todos**', (route) =>
    route.fulfill({ json: { data: [PRODUCTO_ADMIN_MOCK], total: 1 } }),
  );
  await page.route('**/api/v1/categorias', (route) =>
    route.fulfill({ json: [{ id: 1, nombre: 'Mates' }] }),
  );
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: [] });
  });
  await page.route(`**/api/v1/imagenes/producto/${PRODUCTO_ADMIN_MOCK.id}`, (route) =>
    route.fulfill({ json: [] }),
  );

  const putStatus = opts.putStatus ?? 200;
  await page.route(`**/api/v1/productos/${PRODUCTO_ADMIN_MOCK.id}`, (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    if (putStatus >= 400) {
      return route.fulfill({ status: putStatus, json: { message: 'Error de validación' } });
    }
    return route.fulfill({ json: { ...PRODUCTO_ADMIN_MOCK, ...route.request().postDataJSON() } });
  });
}

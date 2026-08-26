import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Fixtures — mismo patrón que login.spec.ts / fixtures-admin.ts: mockeamos
// el backend vía page.route para tests herméticos, sin Postgres real.
// ─────────────────────────────────────────────────────────────────────────

const CLIENTE_MOCK = {
  id: 'cliente-e2e-1',
  email: 'cliente@test.com',
  nombre: 'Tami',
  apellido: 'Cliente',
  telefono: '',
  rol: 'cliente',
  email_verificado: false,
};

async function loginComoCliente(page: Page) {
  await page.addInitScript(
    ({ usuario, token }) => {
      window.localStorage.setItem(
        'auth-storage-v2',
        JSON.stringify({ state: { usuario, token, isAuthenticated: true }, version: 0 }),
      );
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('refreshToken', 'fake-refresh');
    },
    { usuario: CLIENTE_MOCK, token: 'fake-cliente-token' },
  );
}

async function mockHomeMinimal(page: Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) =>
    r.fulfill({ json: { tienda_nombre: 'Mate Laser Studio', navbar_bg_color: '#ffffff', navbar_texto_color: '#111111' } }),
  );
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0 } }));
}

const MIS_ORDENES_MOCK = [
  {
    id: 'orden-propia-1',
    estado: 'pagado',
    total: 15000,
    creado_en: new Date().toISOString(),
    metodo_pago: 'mercadopago',
    items_orden: [{ id: 'item-1', nombre_producto: 'Mate Imperial', cantidad: 1 }],
  },
];

test.describe('Mi cuenta — ownership, edición y estado vacío', () => {
  test('usuario logueado ve solo sus propias órdenes en /mi-cuenta', async ({ page }) => {
    await mockHomeMinimal(page);
    await loginComoCliente(page);

    await page.route('**/api/v1/ordenes/mis-ordenes', (route) =>
      route.fulfill({ json: MIS_ORDENES_MOCK }),
    );

    await page.goto('/mi-cuenta');
    await page.getByRole('button', { name: /mis pedidos/i }).click();

    // Solo aparece la orden devuelta por el mock ligado al usuario logueado
    await expect(page.getByText(/ORDEN-PR/i)).toBeVisible();
    const links = page.locator('a[href^="/mi-cuenta/pedidos/"]');
    await expect(links).toHaveCount(1);
  });

  test('estado vacío: sin pedidos muestra mensaje y CTA, no error', async ({ page }) => {
    await mockHomeMinimal(page);
    await loginComoCliente(page);

    await page.route('**/api/v1/ordenes/mis-ordenes', (route) =>
      route.fulfill({ json: [] }),
    );

    await page.goto('/mi-cuenta');
    await page.getByRole('button', { name: /mis pedidos/i }).click();

    await expect(page.getByText(/todavía no hiciste ningún pedido/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /seguir comprando/i })).toBeVisible();
  });

  test('editar datos personales guarda y refleja el cambio sin recargar', async ({ page }) => {
    await mockHomeMinimal(page);
    await loginComoCliente(page);

    await page.route('**/api/v1/usuarios/perfil', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { ...CLIENTE_MOCK, ...body } });
    });

    await page.goto('/mi-cuenta');

    // Antes: page.locator('input').nth(1) — selector frágil por índice. El
    // rediseño del navbar (PR #24/#29) agregó un <input> de búsqueda visible
    // en desktop que pasó a ser el primer <input> de la página, corriendo
    // todos los índices (nth(1) apuntaba al email disabled en vez de a
    // "Nombre"). MiCuenta.tsx no usa <label htmlFor>, así que se ubica por
    // el texto de la label y su input hermano — mismo patrón que
    // bugfix-color-hero.spec.ts para los campos de color del admin.
    // Ver ctaamy/mate-laser-frontend#31.
    const inputNombre = page.getByText('Nombre', { exact: true }).locator('..').locator('input');
    await inputNombre.fill('Tamara');
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText(/guardado/i)).toBeVisible();
    // El input sigue reflejando el valor nuevo sin recarga de página
    await expect(inputNombre).toHaveValue('Tamara');
  });
});

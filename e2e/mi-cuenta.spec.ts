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
  // PerfilSync (App.tsx) refresca el perfil al montar la app.
  await page.route('**/api/v1/usuarios/perfil', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: CLIENTE_MOCK });
    return route.continue();
  });
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
      if (route.request().method() !== 'PUT') return route.fallback(); // GET → mock de loginComoCliente
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { ...CLIENTE_MOCK, ...body } });
    });

    await page.goto('/mi-cuenta');

    // Escopado por data-testid: `input`/`form` a nivel de página también
    // matchean el buscador del navbar (que también es un <form>), que se
    // renderiza antes en el DOM.
    const form = page.getByTestId('form-datos-personales');
    const inputNombre = form.locator('input').nth(1); // 0: email disabled, 1: nombre
    await inputNombre.fill('Tamara');
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText(/guardado/i)).toBeVisible();
    // El input sigue reflejando el valor nuevo sin recarga de página
    await expect(inputNombre).toHaveValue('Tamara');
  });

  test('banner de verificación: se ve, reenvía el mail y se puede descartar (M1)', async ({ page }) => {
    await mockHomeMinimal(page);
    await loginComoCliente(page); // CLIENTE_MOCK.email_verificado === false
    await page.route('**/api/v1/ordenes/mis-ordenes', (r) => r.fulfill({ json: [] }));

    let reenvios = 0;
    await page.route('**/api/v1/auth/enviar-verificacion', (route) => {
      reenvios++;
      return route.fulfill({ json: { ok: true, mensaje: 'Te enviamos un email para verificar tu cuenta' } });
    });

    await page.goto('/mi-cuenta');

    const banner = page.getByText(/Te falta verificar tu email/i);
    await expect(banner).toBeVisible();

    // Visible también en la tab "Mis pedidos" (está a nivel de página).
    await page.getByRole('button', { name: /mis pedidos/i }).click();
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: /reenviar mail/i }).click();
    await expect(page.getByText(/Te reenviamos el mail a/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /reenviar en 0:/i })).toBeVisible();
    expect(reenvios).toBe(1);

    await page.getByRole('button', { name: /descartar aviso/i }).click();
    await expect(banner).toHaveCount(0);
  });
});

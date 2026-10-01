import { test, expect, type Page } from '@playwright/test';

// Lo que ve el CLIENTE en Mi cuenta de los estados de diseño: textos amigables (no el paso
// interno ni la clave cruda), la línea de tiempo según el estado, y un botón de WhatsApp cuando
// se necesita su OK (no hay pantalla de aprobación: el boceto viaja por WhatsApp). Backend simulado.

const CLIENTE = {
  id: 'cliente-e2e-1', email: 'cliente@test.com', nombre: 'Tami', apellido: 'Cliente', telefono: '', rol: 'cliente', email_verificado: true,
};

async function prepararCliente(page: Page, config: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ usuario, token }) => {
      window.localStorage.setItem('auth-storage-v2', JSON.stringify({ state: { usuario, token, isAuthenticated: true }, version: 0 }));
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('refreshToken', 'fake-refresh');
    },
    { usuario: CLIENTE, token: 'fake-cliente-token' },
  );
  await page.route('**/api/v1/usuarios/perfil', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: CLIENTE }) : route.continue()));
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) =>
    r.fulfill({ json: { tienda_nombre: 'Mate Laser Studio', navbar_bg_color: '#ffffff', navbar_texto_color: '#111111', ...config } }),
  );
  await page.route('**/api/v1/categorias', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/productos**', (r) => r.fulfill({ json: { data: [], total: 0 } }));
}

const orden = (estado: string) => ({
  id: 'orden-diseno-1', estado, total: 15000, creado_en: new Date().toISOString(), metodo_pago: 'mercadopago',
  direccion_envio: {}, items_orden: [{ id: 'i1', nombre_producto: 'Mate Imperial', cantidad: 1 }],
  pagos: [{ id: 'p1', estado: 'aprobado', monto: 15000 }],
});

async function verPedido(page: Page, estado: string) {
  await page.route('**/api/v1/ordenes/orden-diseno-1', (r) => r.fulfill({ json: orden(estado) }));
  await page.goto('/mi-cuenta/pedidos/orden-diseno-1');
}

test.describe('Mi cuenta — pedido con diseño', () => {
  test('en diseño: "Diseñando tu grabado" (no "en diseno") y la línea de tiempo lo refleja', async ({ page }) => {
    await prepararCliente(page);
    await verPedido(page, 'en_diseno');

    await expect(page.getByText('Diseñando tu grabado').first()).toBeVisible();
    await expect(page.getByText(/en diseno|en_diseno/i)).toHaveCount(0);
    await expect(page.getByText('En preparación')).toHaveCount(0);
    await expect(page.getByTestId('aprobar-diseno')).toHaveCount(0);
  });

  test('diseño listo se le muestra igual que en diseño: al cliente no le importa la diferencia', async ({ page }) => {
    await prepararCliente(page);
    await verPedido(page, 'diseno_listo');
    await expect(page.getByText('Diseñando tu grabado').first()).toBeVisible();
  });

  test('esperando su OK: lo dice y ofrece responder por WhatsApp al teléfono del negocio', async ({ page }) => {
    await prepararCliente(page, { telefono_contacto: '+54 9 11 5555-1234' });
    await verPedido(page, 'esperando_aprobacion');

    const aviso = page.getByTestId('aprobar-diseno');
    await expect(aviso).toContainText('Necesitamos tu OK para grabarlo');
    const link = aviso.getByRole('link', { name: 'Responder por WhatsApp' });
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toContain('https://wa.me/5491155551234');
    expect(decodeURIComponent(href)).toContain('#ORDEN-DI');
    await expect(page.getByText('Esperando tu OK').first()).toBeVisible();
  });

  test('sin teléfono configurado no inventa un botón de WhatsApp roto', async ({ page }) => {
    await prepararCliente(page);
    await verPedido(page, 'esperando_aprobacion');
    await expect(page.getByTestId('aprobar-diseno')).toContainText('Necesitamos tu OK');
    await expect(page.getByRole('link', { name: 'Responder por WhatsApp' })).toHaveCount(0);
  });

  test('un pedido ya pagado en preparación sigue igual que antes (con tilde)', async ({ page }) => {
    await prepararCliente(page);
    await verPedido(page, 'en_preparacion');
    await expect(page.getByText('Preparando tu pedido').first()).toBeVisible();
    await expect(page.getByText('En preparación')).toBeVisible(); // paso de la línea de tiempo
  });

  test('la lista de pedidos también muestra el texto para el cliente', async ({ page }) => {
    await prepararCliente(page);
    await page.route('**/api/v1/ordenes/mis-ordenes', (r) => r.fulfill({ json: [orden('esperando_aprobacion')] }));
    await page.goto('/mi-cuenta');
    await page.getByRole('button', { name: /mis pedidos/i }).click();
    await expect(page.getByText('Necesitamos tu OK')).toBeVisible();
  });
});

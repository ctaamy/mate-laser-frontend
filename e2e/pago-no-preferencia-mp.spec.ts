import { test, expect } from '@playwright/test';
import { mockBackendYMercadoPago } from './fixtures';

// Regresión: Pago.tsx no debe disparar POST /pagos/:id/preferencia-mp al montar.
// El Brick de MP no usa preferenceId — la llamada era innecesaria y se eliminó.
// Este test evita que alguien la reintroduzca por accidente.
test('montar /pago/:id NO dispara POST a /preferencia-mp', async ({ page }) => {
  const requestsAPreferencia: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('preferencia-mp')) requestsAPreferencia.push(req.url());
  });

  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  await page.goto('/pago/orden-e2e-1');

  // Esperar a que el stub del SDK llame a onReady (señal de que el Brick montó)
  await page.waitForFunction(() => (window as any).__mpBrickSettings != null);

  // 300ms extra para capturar cualquier llamada diferida
  await page.waitForTimeout(300);

  expect(
    requestsAPreferencia,
    'Pago.tsx no debe llamar a preferencia-mp al montar — el Brick no usa preferenceId',
  ).toHaveLength(0);
});

// M2: /pago/:id retomado (del mail o MiCuenta) para una orden que ya no admite
// pago no debe montar el Brick — muestra el estado.
test('/pago/:id de una orden ya pagada muestra "ya está pago", sin Brick', async ({ page }) => {
  await mockBackendYMercadoPago(page, { estadoPagoBrick: 'approved' });
  await page.route('**/api/v1/ordenes/orden-pagada-1', (route) =>
    route.fulfill({
      json: { id: 'orden-pagada-1', estado: 'pagado', total: 9000, direccion_envio: {}, items_orden: [], pagos: [{ estado: 'aprobado' }] },
    }),
  );

  await page.goto('/pago/orden-pagada-1');

  await expect(page.getByText(/este pedido ya está pago/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /ver mi pedido/i })).toBeVisible();
  await expect(page.getByText(/formulario de pago/i)).toHaveCount(0);
});

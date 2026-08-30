import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 2f: envío manual de un cupón por email desde /admin/cupones.

const CUPON = {
  id: 'cup-envio-1', codigo: 'INVIERNO15', tipo: 'porcentaje', valor: 15,
  monto_minimo: 8000, max_usos: 50, limite_por_usuario: null, usos_realizados: 0,
  vence_en: '2026-12-31T00:00:00.000Z', activo: true,
};

const RESUMEN = {
  destinatarios: 120,
  puede_enviar: true,
  avisos: ['El cupón tiene 50 usos totales y lo vas a mandar a 120 personas — solo los primeros 50 lo van a poder usar.'],
  cupon: { codigo: CUPON.codigo, tipo: 'porcentaje', valor: 15, monto_minimo: 8000, vence_en: CUPON.vence_en },
};

async function mockCupones(page: import('@playwright/test').Page, onPost: (body: any) => object) {
  await page.route('**/api/v1/cupones', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ json: [CUPON] });
  });
  await page.route(`**/api/v1/cupones/${CUPON.id}/campania`, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: RESUMEN });
    return route.fulfill({ json: onPost(route.request().postDataJSON()) });
  });
}

test.describe('Admin — enviar cupón por email', () => {
  test('abre el modal, muestra destinatarios y avisos', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCupones(page, () => ({}));

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON.codigo }).getByRole('button', { name: 'Enviar por email' }).click();

    await expect(page.getByRole('heading', { name: /Enviar cupón INVIERNO15/ })).toBeVisible();
    await expect(page.getByText(/suscriptores confirmados del newsletter/)).toBeVisible();
    await expect(page.getByText(/solo los primeros 50/)).toBeVisible();
  });

  test('"Probar" manda una prueba con prueba:true', async ({ page }) => {
    await loginComoAdmin(page);
    let body: any = null;
    await mockCupones(page, (b) => { body = b; return { prueba: true }; });

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON.codigo }).getByRole('button', { name: 'Enviar por email' }).click();
    await page.getByPlaceholder('tu@email.com').fill('yo@test.com');
    await page.getByRole('button', { name: 'Probar' }).click();

    await expect(page.getByText(/prueba a yo@test.com/)).toBeVisible();
    expect(body.prueba).toBe(true);
    expect(body.prueba_email).toBe('yo@test.com');
  });

  test('"Enviar a N" pide confirmación y postea sin prueba', async ({ page }) => {
    await loginComoAdmin(page);
    let body: any = null;
    await mockCupones(page, (b) => { body = b; return { destinatarios: 120, encolados: 120 }; });

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON.codigo }).getByRole('button', { name: 'Enviar por email' }).click();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Enviar a 120/ }).click();

    await expect(page.getByText(/Encolado para 120/)).toBeVisible();
    expect(body.prueba).toBeUndefined();
  });
});

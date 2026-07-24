import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Campos nuevos del footer: grupos de links (Tienda/Ayuda/Legal, default
// no vacío — Términos y Privacidad por default con rutas reales a las
// páginas estáticas), métodos de pago (logos reales, default
// mercadopago/visa/mastercard) y contacto directo (email/teléfono/dirección,
// opcional).

async function mockHomepage(page: import('@playwright/test').Page, secciones: any[], onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: secciones });
  });
}

async function mockConfig(page: import('@playwright/test').Page, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: config });
  });
}

test.describe('Footer — sitio público, campos nuevos', () => {
  test('sin grupo_legal configurado (array vacío explícito), no se muestra la columna "Legal"', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: { grupo_legal: [] } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.locator('footer').getByText('Legal', { exact: true })).toHaveCount(0);
  });

  test('por default, el grupo Legal trae Términos y Privacidad apuntando a rutas reales', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute('href', '/terminos');
    await expect(footer.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/privacidad');
  });

  test('métodos de pago por default (mercadopago, visa, mastercard) se muestran como logos', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.locator('footer').getByTitle('Mercado Pago')).toBeVisible();
    await expect(page.locator('footer').getByTitle('Visa')).toBeVisible();
    await expect(page.locator('footer').getByTitle('Mastercard')).toBeVisible();
    await expect(page.locator('footer').getByText('Medios de pago')).toBeVisible();
  });

  test('un logo de pago con override (metodos_pago_logos) reemplaza el logo genérico incluido', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'foot-1', tipo: 'footer', activo: true, orden: -1,
          datos: { metodos_pago: ['mercadopago'], metodos_pago_logos: { mercadopago: 'https://cdn.test/mp-oficial.png' } },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    await expect(page.locator('footer').locator('img[src="https://cdn.test/mp-oficial.png"]')).toHaveCount(1);
  });

  test('contacto directo (email/teléfono/dirección) opcional, se muestra cuando está configurado', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({
        json: [{
          id: 'foot-1', tipo: 'footer', activo: true, orden: -1,
          datos: { contacto: { email: 'hola@matelaserstudio.com', telefono: '+54 9 11 1234-5678', direccion: 'Buenos Aires, Argentina' } },
        }],
      }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.getByText('hola@matelaserstudio.com')).toBeVisible();
    await expect(footer.getByText('+54 9 11 1234-5678')).toBeVisible();
    await expect(footer.getByText('Buenos Aires, Argentina')).toBeVisible();
  });

  test('un link a instagram.com en "redes" muestra el ícono de Instagram', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');
    const link = page.locator('footer').getByRole('link', { name: 'Instagram' });
    await expect(link).toBeVisible();
    await expect(link.locator('svg')).toBeVisible();
  });
});

test.describe('Footer — admin, campos nuevos', () => {
  test('permite cargar un link al grupo Legal, contacto y desmarcar un método de pago, y guardarlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [{ id: 'foot-1', tipo: 'footer', activo: true, orden: -1, datos: {} }], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar footer' }).click();

    await page.getByText('Grupo: Legal', { exact: true }).locator('..')
      .getByRole('button', { name: 'Agregar' }).click();

    const emailInput = page.getByText('Email', { exact: true }).locator('..').locator('input');
    await emailInput.fill('hola@matelaserstudio.com');

    await page.getByLabel('Mercado Pago').uncheck();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const footerSec = (putBody.secciones as any[]).find((s) => s.tipo === 'footer');
    expect(footerSec.datos.grupo_legal).toHaveLength(3);
    expect(footerSec.datos.contacto.email).toBe('hola@matelaserstudio.com');
    expect(footerSec.datos.metodos_pago).not.toContain('mercadopago');
  });
});

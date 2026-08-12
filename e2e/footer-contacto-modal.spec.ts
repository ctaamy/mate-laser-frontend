import { test, expect } from '@playwright/test';

// El link "Contacto" del footer navegaba a /#contacto, un ancla que nunca
// existió — el click no producía ningún efecto visible. Ahora dispara un
// modal con email, teléfono y WhatsApp (ContactoModal.tsx). Mockeamos
// GET /api/v1/configuracion y /api/v1/configuracion/homepage(/borrador)?
// para que el footer resuelva sus datos sin depender de Postgres real
// (mismo patrón que fixtures-admin.ts / footer-campos-nuevos.spec.ts).

async function mockConfigYFooter(page: import('@playwright/test').Page, opts: {
  contacto?: { email?: string; telefono?: string; direccion?: string };
  telefonoContacto?: string;
} = {}) {
  await page.route('**/api/v1/configuracion', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: { telefono_contacto: opts.telefonoContacto ?? '' } });
  });
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      json: [
        {
          id: 'sec-footer-1',
          tipo: 'footer',
          orden: 999,
          datos: {
            grupo_ayuda: [
              { label: 'Preguntas frecuentes', href: '/faq' },
              { label: 'Contacto', href: '/#contacto' },
            ],
            contacto: opts.contacto ?? {},
          },
        },
      ],
    });
  });
}

test.describe('Footer — modal de Contacto', () => {
  test('click en "Contacto" abre el modal (no navega a /#contacto)', async ({ page }) => {
    await mockConfigYFooter(page, {
      contacto: { email: 'hola@matelaserstudio.com', telefono: '+54 11 5555-5555' },
      telefonoContacto: '5491155555555',
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Contacto' }).click();

    // Modal visible, URL no cambió (no navegó a /#contacto). El footer ya
    // muestra el email/teléfono como texto plano fuera del modal, así que
    // acotamos las búsquedas al modal para no matchear ambos.
    const modal = page.getByRole('heading', { name: 'Contacto' }).locator('../..');
    await expect(page.getByRole('heading', { name: 'Contacto' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await expect(modal.getByRole('link', { name: /hola@matelaserstudio\.com/ })).toHaveAttribute('href', 'mailto:hola@matelaserstudio.com');
    await expect(modal.getByRole('link', { name: /\+54 11 5555-5555/ })).toHaveAttribute('href', 'tel:+54 11 5555-5555');

    const wa = modal.getByRole('link', { name: /Escribinos por WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/5491155555555\?text=/);
  });

  test('cerrar el modal con el botón X lo oculta', async ({ page }) => {
    await mockConfigYFooter(page, { contacto: { email: 'hola@matelaserstudio.com' } });

    await page.goto('/');
    await page.getByRole('button', { name: 'Contacto' }).click();
    await expect(page.getByRole('heading', { name: 'Contacto' })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByRole('heading', { name: 'Contacto' })).not.toBeVisible();
  });

  test('sin datos de contacto ni teléfono, muestra el mensaje vacío', async ({ page }) => {
    await mockConfigYFooter(page, {});

    await page.goto('/');
    await page.getByRole('button', { name: 'Contacto' }).click();

    await expect(page.getByText('Todavía no hay datos de contacto cargados.')).toBeVisible();
  });
});

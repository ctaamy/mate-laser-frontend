import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Sistema de borrador/publicación (Configuracion.tsx): el editor lee/escribe
// siempre el BORRADOR (/configuracion/homepage/borrador, /configuracion/borrador).
// "Publicar cambios" copia borrador → publicado (POST /configuracion/publicar).
// "Descartar cambios del borrador" copia publicado → borrador (POST /configuracion/descartar).

const SECCIONES_BORRADOR = [
  { id: 'hero-1', tipo: 'hero', activo: true, orden: 0, datos: { bg_color: '#ff0000' } },
];

async function mockAdmin(page: import('@playwright/test').Page, opts: {
  hayCambios: boolean;
  onPublicar?: () => void;
  onDescartar?: () => void;
}) {
  await page.route(/\/api\/v1\/configuracion\/homepage\/borrador$/, (route) =>
    route.fulfill({ json: SECCIONES_BORRADOR }),
  );
  await page.route(/\/api\/v1\/configuracion\/borrador$/, (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) =>
    route.fulfill({ json: { hayCambios: opts.hayCambios } }),
  );
  await page.route(/\/api\/v1\/configuracion\/publicar$/, (route) => {
    opts.onPublicar?.();
    return route.fulfill({ json: { ok: true } });
  });
  await page.route(/\/api\/v1\/configuracion\/descartar$/, (route) => {
    opts.onDescartar?.();
    return route.fulfill({ json: { ok: true } });
  });
}

test('sin cambios sin publicar, no se muestra el indicador y los botones están deshabilitados', async ({ page }) => {
  await loginComoAdmin(page);
  await mockAdmin(page, { hayCambios: false });

  await page.goto('/admin/configuracion');

  await expect(page.getByText('Tenés cambios sin publicar')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descartar cambios del borrador' })).toBeDisabled();
});

test('con cambios sin publicar, muestra el indicador y permite publicar con confirmación', async ({ page }) => {
  await loginComoAdmin(page);
  let publicado = false;
  await mockAdmin(page, { hayCambios: true, onPublicar: () => { publicado = true; } });

  page.on('dialog', d => d.accept());

  await page.goto('/admin/configuracion');

  await expect(page.getByText('Tenés cambios sin publicar')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar cambios' }).click();

  await expect(page.getByText('¡Publicado correctamente!')).toBeVisible();
  expect(publicado).toBe(true);
});

test('publicar pide confirmación — cancelar no publica nada', async ({ page }) => {
  await loginComoAdmin(page);
  let publicado = false;
  await mockAdmin(page, { hayCambios: true, onPublicar: () => { publicado = true; } });

  page.on('dialog', d => d.dismiss());

  await page.goto('/admin/configuracion');
  await page.getByRole('button', { name: 'Publicar cambios' }).click();
  await page.waitForTimeout(300);

  expect(publicado).toBe(false);
});

test('descartar cambios pide confirmación y revierte el borrador', async ({ page }) => {
  await loginComoAdmin(page);
  let descartado = false;
  await mockAdmin(page, { hayCambios: true, onDescartar: () => { descartado = true; } });

  page.on('dialog', d => d.accept());

  await page.goto('/admin/configuracion');
  await page.getByRole('button', { name: 'Descartar cambios del borrador' }).click();

  await expect(page.getByText('Cambios descartados')).toBeVisible();
  expect(descartado).toBe(true);
});

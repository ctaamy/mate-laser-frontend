import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 5 del Page Builder de Inicio: validación de contenido pre-publish.
// Dos niveles (bloqueante / warning, ver validacion.ts) — badge informativo
// en cada SeccionCard + modal-resumen antes de publicar (ver PublicarModal).
// Nada de esto bloquea guardar el borrador ni seguir editando — solo
// interviene en el click de "Publicar cambios".

const SEC_BLOQUEANTE = {
  id: 'sec-bloqueante', tipo: 'banner_texto', activo: true, orden: 0,
  datos: { texto: '' }, // banner_texto con texto vacío: no renderiza nada visible.
};
const SEC_WARNING = {
  id: 'sec-warning', tipo: 'banner_imagen', activo: true, orden: 0,
  // imagen_url presente (no dispara el bloqueante) pero con formato
  // sospechoso (no arranca con http/https//) — dispara el warning.
  datos: { imagen_url: 'assets/banner.jpg' },
};
const SEC_OK = {
  id: 'sec-ok', tipo: 'banner_texto', activo: true, orden: 0,
  datos: { texto: 'Envío gratis a todo el país' },
};

async function mockAdmin(page: import('@playwright/test').Page, secciones: any[], opts: {
  hayCambios?: boolean; onPublicar?: () => void;
} = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage\/borrador$/, (route) =>
    route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/borrador$/, (route) =>
    route.fulfill({ json: {} }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) =>
    route.fulfill({ json: { hayCambios: opts.hayCambios ?? true } }));
  await page.route(/\/api\/v1\/configuracion\/publicar$/, (route) => {
    opts.onPublicar?.();
    return route.fulfill({ json: { ok: true } });
  });
}

test.describe('Validación de contenido pre-publish — badges', () => {
  test('una sección objetivamente vacía (banner_texto sin texto) muestra el badge rojo de bloqueante', async ({ page }) => {
    await loginComoAdmin(page);
    await mockAdmin(page, [SEC_BLOQUEANTE]);

    await page.goto('/admin/configuracion');

    const badge = page.getByTestId('badge-validacion');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-severidad', 'bloqueante');
    await expect(badge).toHaveAttribute('title', /texto del banner está vacío/);
  });

  test('un problema no bloqueante (banner_imagen con URL sospechosa) muestra el badge ámbar de warning', async ({ page }) => {
    await loginComoAdmin(page);
    await mockAdmin(page, [SEC_WARNING]);

    await page.goto('/admin/configuracion');

    const badge = page.getByTestId('badge-validacion');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-severidad', 'warning');
    await expect(badge).toHaveAttribute('title', /no empieza con http/);
  });

  test('una sección sin problemas no muestra ningún badge', async ({ page }) => {
    await loginComoAdmin(page);
    await mockAdmin(page, [SEC_OK]);

    await page.goto('/admin/configuracion');

    await expect(page.getByTestId('badge-validacion')).toHaveCount(0);
  });
});

test.describe('Validación de contenido pre-publish — modal antes de publicar', () => {
  test('con un problema bloqueante, el modal no deja publicar (solo cerrar/volver a editar)', async ({ page }) => {
    await loginComoAdmin(page);
    let publicado = false;
    await mockAdmin(page, [SEC_BLOQUEANTE], { onPublicar: () => { publicado = true; } });
    // Si el modal fallara y se disparara el window.confirm de siempre,
    // aceptarlo igual haría evidente el bug (publicaría de todas formas).
    page.on('dialog', d => d.accept());

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Publicar cambios' }).click();

    const modal = page.getByTestId('publicar-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-bloqueante', 'true');
    await expect(modal.getByText('No se puede publicar todavía')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Publicar igual' })).toHaveCount(0);

    await modal.getByRole('button', { name: 'Volver a editar' }).click();
    await expect(modal).toBeHidden();
    expect(publicado).toBe(false);
  });

  test('solo con warnings, el modal permite "Publicar igual" y sigue el flujo normal de publicación', async ({ page }) => {
    await loginComoAdmin(page);
    let publicado = false;
    await mockAdmin(page, [SEC_WARNING], { onPublicar: () => { publicado = true; } });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Publicar cambios' }).click();

    const modal = page.getByTestId('publicar-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-bloqueante', 'false');

    await modal.getByRole('button', { name: 'Publicar igual' }).click();
    await expect(modal).toBeHidden();

    await expect(page.getByText('¡Publicado correctamente!')).toBeVisible();
    expect(publicado).toBe(true);
  });

  test('solo con warnings, "Cancelar" cierra el modal sin publicar', async ({ page }) => {
    await loginComoAdmin(page);
    let publicado = false;
    await mockAdmin(page, [SEC_WARNING], { onPublicar: () => { publicado = true; } });

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Publicar cambios' }).click();

    const modal = page.getByTestId('publicar-modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal).toBeHidden();
    expect(publicado).toBe(false);
  });

  test('sin ningún problema, publicar funciona directo (window.confirm) sin mostrar el modal', async ({ page }) => {
    await loginComoAdmin(page);
    let publicado = false;
    await mockAdmin(page, [SEC_OK], { onPublicar: () => { publicado = true; } });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Publicar cambios' }).click();

    await expect(page.getByTestId('publicar-modal')).toHaveCount(0);
    await expect(page.getByText('¡Publicado correctamente!')).toBeVisible();
    expect(publicado).toBe(true);
  });

  test('clickear un ítem del modal cierra el modal y lleva el scroll a esa sección', async ({ page }) => {
    await loginComoAdmin(page);
    await mockAdmin(page, [SEC_WARNING]);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Publicar cambios' }).click();

    const modal = page.getByTestId('publicar-modal');
    await expect(modal).toBeVisible();
    await modal.getByText('Banner imagen').click();

    await expect(modal).toBeHidden();
    await expect(page.locator(`#seccion-card-${SEC_WARNING.id}`)).toBeInViewport();
  });
});

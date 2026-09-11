import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Editor de la página /nosotros por bloques — tab Páginas de /admin/configuracion.
// Card "Nosotros / El Taller": lista de bloques párrafo|foto, agregar /
// reordenar (↑↓) / borrar, preview en vivo, y su propio "Guardar Nosotros"
// (PUT /configuracion/pagina/nosotros) separado de "Guardar páginas".

const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8a5a3c"/></svg>',
);

async function mockAdmin(
  page: import('@playwright/test').Page,
  configBorrador: Record<string, any>,
  onPutNosotros?: (body: any) => void,
) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?(\/meta)?$/, (route) =>
    route.fulfill({ json: route.request().url().endsWith('/meta') ? { actualizado: null } : [] }),
  );
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) =>
    route.fulfill({ json: { hayCambios: false } }),
  );
  await page.route(/\/api\/v1\/configuracion\/pagina\/nosotros$/, (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    onPutNosotros?.(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.route(/\/api\/v1\/configuracion\/imagen$/, (route) =>
    route.fulfill({ json: { url: IMG } }),
  );
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: configBorrador });
  });
}

const tituloInput = (page: import('@playwright/test').Page) => page.getByPlaceholder('Nosotros').first();
const layoutSelect = (page: import('@playwright/test').Page) =>
  page.locator('select').filter({ has: page.locator('option', { hasText: 'Destacada' }) });

test.describe('Admin — editor de /nosotros por bloques', () => {
  test('carga los bloques guardados y los muestra en el editor y en el preview', async ({ page }) => {
    await loginComoAdmin(page);
    await mockAdmin(page, {
      pagina_nosotros_titulo: 'El Taller',
      pagina_nosotros_contenido: [
        { id: 'b1', tipo: 'parrafo', md: 'Somos un taller en **Buenos Aires**.' },
        { id: 'b2', tipo: 'imagen', url: IMG, alt: 'taller', layout: 'destacada', epigrafe: 'El láser grabando.' },
      ],
    });

    await page.goto('/admin/configuracion?tab=paginas');

    await expect(tituloInput(page)).toHaveValue('El Taller');
    await expect(page.getByText('Bloques (2)')).toBeVisible();
    await expect(page.getByText('Párrafo 1')).toBeVisible();
    await expect(page.getByText('Foto 2')).toBeVisible();
    await expect(page.locator('.prose strong', { hasText: 'Buenos Aires' })).toBeVisible();
    await expect(page.locator('figcaption', { hasText: 'El láser grabando.' })).toBeVisible();
  });

  test('agregar un párrafo, escribir y guardar dispara PUT /configuracion/pagina/nosotros con el bloque', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, { pagina_nosotros_titulo: 'Nosotros', pagina_nosotros_contenido: [] }, (b) => { putBody = b; });

    await page.goto('/admin/configuracion?tab=paginas');

    await expect(page.getByText('Párrafo 1')).toBeVisible();
    await page.getByRole('button', { name: 'Párrafo', exact: true }).click();
    await expect(page.getByText('Párrafo 2')).toBeVisible();

    await page.locator('textarea').nth(1).fill('El segundo párrafo, con una **idea**.');
    await expect(page.getByText('Cambios sin guardar')).toBeVisible();
    expect(putBody).toBeNull();

    await page.getByRole('button', { name: 'Guardar Nosotros' }).click();
    await expect(page.getByText('¡Guardado!')).toBeVisible();

    expect(putBody).toBeTruthy();
    expect(putBody.titulo).toBe('Nosotros');
    expect(putBody.bloques).toHaveLength(2);
    expect(putBody.bloques[1].tipo).toBe('parrafo');
    expect(putBody.bloques[1].md).toContain('El segundo párrafo');
  });

  test('agregar una foto: pega la URL, elige layout "destacada" y epígrafe, y se guarda', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, { pagina_nosotros_contenido: [{ id: 'b1', tipo: 'parrafo', md: 'Intro.' }] }, (b) => { putBody = b; });

    await page.goto('/admin/configuracion?tab=paginas');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await expect(page.getByText('Foto 2')).toBeVisible();

    await page.getByPlaceholder('https://... (URL externa)').fill(IMG);
    await layoutSelect(page).selectOption('destacada');
    await page.getByPlaceholder('Algo que la foto no dice sola').fill('El taller, un martes cualquiera.');

    await page.getByRole('button', { name: 'Guardar Nosotros' }).click();
    await expect(page.getByText('¡Guardado!')).toBeVisible();

    const foto = putBody.bloques.find((x: any) => x.tipo === 'imagen');
    expect(foto).toBeTruthy();
    expect(foto.url).toBe(IMG);
    expect(foto.layout).toBe('destacada');
    expect(foto.epigrafe).toBe('El taller, un martes cualquiera.');
  });

  test('reordenar con ↑↓ cambia el orden de los bloques que se guardan', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockAdmin(page, {
      pagina_nosotros_contenido: [
        { id: 'b1', tipo: 'parrafo', md: 'PRIMERO' },
        { id: 'b2', tipo: 'parrafo', md: 'SEGUNDO' },
      ],
    }, (b) => { putBody = b; });

    await page.goto('/admin/configuracion?tab=paginas');
    await expect(page.getByText('Bloques (2)')).toBeVisible();

    await page.getByRole('button', { name: 'Mover abajo' }).first().click();
    await page.getByRole('button', { name: 'Guardar Nosotros' }).click();
    await expect(page.getByText('¡Guardado!')).toBeVisible();

    expect(putBody.bloques[0].md).toBe('SEGUNDO');
    expect(putBody.bloques[1].md).toBe('PRIMERO');
  });
});

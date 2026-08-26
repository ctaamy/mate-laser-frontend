import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Mejora: la posición de los botones del Hero estaba atada 1 a 1 a la
// alineación del texto (datos.alineacion) — no había forma de, por ejemplo,
// centrar el título pero dejar el botón a la izquierda. Se agrega
// datos.boton_posicion, opcional: vacío = hereda la alineación del texto
// (comportamiento histórico, no rompe heroes ya publicados); con un valor
// propio, el botón se posiciona independientemente.
// Ver justifyDeAlineacion(datos.boton_posicion || datos.alineacion) en
// HomeSecciones.tsx, y el SelectField "Posición de los botones" en
// EditorEstilo (Configuracion.tsx).

async function mockHome(page: import('@playwright/test').Page, seccion: any, onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: [seccion] });
  });
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

test.describe('Hero — posición de los botones', () => {
  test('sin boton_posicion, el botón hereda la alineación del texto (comportamiento histórico)', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola', botones: [{ texto: 'Comprar', link: '/x' }] }], alineacion: 'center' },
    });
    await page.goto('/');

    const wrapper = page.getByRole('link', { name: 'Comprar' }).locator('..');
    await expect(wrapper).toHaveCSS('justify-content', 'center');
  });

  test('con boton_posicion definido, el botón se mueve sin tocar la alineación del texto', async ({ page }) => {
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: {
        slides: [{ titulo: 'Hola', botones: [{ texto: 'Comprar', link: '/x' }] }],
        alineacion: 'left', boton_posicion: 'right',
      },
    });
    await page.goto('/');

    const titulo = page.getByRole('heading', { level: 1 });
    await expect(titulo).toHaveCSS('text-align', 'left');

    const wrapper = page.getByRole('link', { name: 'Comprar' }).locator('..');
    await expect(wrapper).toHaveCSS('justify-content', 'flex-end');
  });

  test('admin: elegir una posición de botón distinta a la alineación se guarda en boton_posicion', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHome(page, {
      id: 'hero-1', tipo: 'hero', activo: true, orden: 0,
      datos: { slides: [{ titulo: 'Hola' }], alineacion: 'left' },
    }, (body) => { putBody = body; });

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click(); // expandir
    await page.getByRole('button', { name: 'Estilo' }).first().click();

    const select = page.getByText('Posición de los botones', { exact: true }).locator('..').locator('select');
    await expect(select).toHaveValue(''); // default: "Igual que la alineación del texto"
    await select.selectOption('right');

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody.secciones[0].datos.boton_posicion).toBe('right');
  });
});

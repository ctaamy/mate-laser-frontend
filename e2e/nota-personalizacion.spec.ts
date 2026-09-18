import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Nota "¿Cómo funciona el grabado?" del módulo de grabado de la PDP
// (NotaPersonalizacion.tsx). Criterios acordados con ux-reviewer:
//  1. Con el toggle apagado el link se ve sin abrir nada, mide >= 44px de alto
//     y tocarlo no cambia el toggle ni el precio.
//  2. Tap, Enter y Espacio abren y cierran, y aria-expanded acompaña. Al abrir,
//     la nota queda entera visible sobre la barra fija de mobile.
//  3. La nota muestra el personalizado_max_chars real del producto. Al activar
//     el toggle, link y nota desaparecen y queda el campo como siempre.

const LINK = '¿Cómo funciona el grabado?';

async function abrirPDP(page: Page, overrides: Record<string, unknown> = {}) {
  const producto = { ...PRODUCTO_MOCK, ...overrides };
  await page.route(`**/api/v1/productos/${producto.slug}`, (route) => route.fulfill({ json: producto }));
  // Tema global y navbar (montados globalmente vía Layout/App): sin esto el
  // test queda acoplado al backend real de desarrollo.
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
  // Cuotas bancarias (CuotasBanner) y tira de recomendados: sin mock, la request
  // se cuela a la red real (ver fixtures.ts / personalizacion.spec.ts).
  await page.route(/\/api\/v1\/productos\/[^/]+\/promociones-bancarias$/, (route) =>
    route.fulfill({ json: { tiene_promo_sin_interes: false, cuotas: 12, sin_interes: false } }),
  );
  await page.route(/\/api\/v1\/productos\/[^/]+\/recomendados(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], algoritmo: 'heuristica' } }),
  );
  await page.goto(`/productos/${producto.slug}`);
  await expect(page.getByRole('heading', { name: producto.nombre })).toBeVisible();
  return producto;
}

const link = (page: Page) => page.getByRole('button', { name: LINK });

test.describe('Nota "¿Cómo funciona el grabado?" en la PDP', () => {
  test('con el grabado apagado se ve el link y la explicación está cerrada', async ({ page }) => {
    await abrirPDP(page);

    await expect(link(page)).toBeVisible();
    await expect(link(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('al tocar el link se abre la nota con el tope de caracteres real del producto, y al volver a tocar se cierra', async ({ page }) => {
    await abrirPDP(page, { personalizado_max_chars: 45 });

    await link(page).click();
    await expect(link(page)).toHaveAttribute('aria-expanded', 'true');
    const nota = page.getByRole('note');
    await expect(nota).toBeVisible();
    await expect(nota).toContainText('Grabamos con láser el texto que elijas');
    await expect(nota).toContainText('hasta 45 caracteres');

    await link(page).click();
    await expect(link(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('abrir la nota no prende el grabado: el campo de texto sigue oculto y el precio no cambia', async ({ page }) => {
    // Con costo de grabado, prender el toggle SÍ sumaría $2.000 al precio:
    // que siga en $8.000 prueba que abrir la nota no lo prendió.
    await abrirPDP(page, { costo_grabado: 2000 });
    const precio = page.getByText('$8.000', { exact: true }).first();
    await expect(precio).toBeVisible();

    await link(page).click();
    await expect(page.getByRole('note')).toBeVisible();

    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).not.toBeVisible();
    await expect(precio).toHaveText('$8.000');
  });

  test('con teclado: Enter y Espacio abren y cierran', async ({ page }) => {
    await abrirPDP(page);

    await link(page).focus();
    await page.keyboard.press('Enter');
    await expect(link(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(link(page)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('note')).toBeVisible();
  });

  test('al activar el grabado, el link y la nota desaparecen y queda el campo de texto', async ({ page }) => {
    await abrirPDP(page);

    await link(page).click();
    await expect(page.getByRole('note')).toBeVisible();

    await page.getByText('Grabado personalizado').click();

    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).toBeVisible();
    await expect(link(page)).toHaveCount(0);
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('al apagar el grabado de nuevo, el link vuelve cerrado', async ({ page }) => {
    await abrirPDP(page);

    await link(page).click();
    await page.getByText('Grabado personalizado').click(); // prende: se va la nota
    await expect(link(page)).toHaveCount(0);
    await page.getByText('Grabado personalizado').click(); // apaga: vuelve el link

    await expect(link(page)).toBeVisible();
    await expect(link(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('producto sin grabado personalizado: no hay link ni nota', async ({ page }) => {
    await abrirPDP(page, { apto_grabado: false, personalizado_habilitado: false });

    await expect(page.getByText('Grabado personalizado')).not.toBeVisible();
    await expect(link(page)).toHaveCount(0);
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('mobile: el link mide al menos 44px de alto', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await abrirPDP(page);

    const caja = await link(page).boundingBox();
    expect(caja).not.toBeNull();
    expect(caja!.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile: la nota abierta no queda tapada por la barra fija de "Agregar al carrito"', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await abrirPDP(page);

    // Peor caso: el link queda pegado al borde de abajo, justo donde la barra
    // fija está apoyada. Sin el scrollIntoView de la nota, esta quedaría
    // completamente detrás de la barra.
    await link(page).evaluate((el) => {
      const { top } = el.getBoundingClientRect();
      window.scrollBy(0, top - (window.innerHeight - 90));
    });
    await link(page).click();

    const nota = page.getByRole('note');
    await expect(nota).toBeVisible();
    const barra = page
      .getByRole('button', { name: /Agregar al carrito/i })
      .locator('xpath=ancestor::div[contains(@class,"sticky")][1]');

    // La expansión (220ms) y el scroll suave posterior tardan un poco: se
    // espera a que la caja de la nota deje de moverse antes de medir.
    await expect
      .poll(
        async () => {
          const n = await nota.boundingBox();
          const b = await barra.boundingBox();
          if (!n || !b) return false;
          const dentroDelViewport = n.y >= 0 && n.y + n.height <= 812;
          const sinSolaparBarra = n.y + n.height <= b.y + 1 || n.y >= b.y + b.height - 1;
          return dentroDelViewport && sinSolaparBarra;
        },
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test('abrir y cerrar la nota no genera errores en la consola', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errores.push(msg.text()); });
    page.on('pageerror', (err) => errores.push(err.message));

    await abrirPDP(page);
    await link(page).click();
    await expect(page.getByRole('note')).toBeVisible();
    await link(page).click();
    await page.getByText('Grabado personalizado').click();
    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).toBeVisible();

    // Ruido de red de recursos no mockeados (favicon, Georef): no es lógica bajo test.
    const relevantes = errores.filter((e) => !e.includes('ERR_CONNECTION_REFUSED') && !e.includes('Failed to load resource'));
    expect(relevantes).toEqual([]);
  });
});

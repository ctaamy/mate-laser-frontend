import { test, expect } from '@playwright/test';
import { PRODUCTO_MOCK } from './fixtures';

// Valida que los campos de personalización (texto, color, apto_grabado)
// aparezcan/desaparezcan según la config de cada producto, en la página de
// detalle (ProductoDetalle.tsx) — no hay un modal separado, la sección de
// personalización es inline dentro de la misma página.

async function mockProducto(page: import('@playwright/test').Page, overrides: Record<string, any>) {
  const producto = { ...PRODUCTO_MOCK, ...overrides };
  await page.route(`**/api/v1/productos/${producto.slug}`, (route) =>
    route.fulfill({ json: producto }),
  );
  return producto;
}

test.describe('Personalización de producto', () => {
  test('producto apto_grabado con colores: muestra toggle, colores y campo de texto', async ({ page }) => {
    await mockProducto(page, {});
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    const toggle = page.getByText('Grabado personalizado');
    await expect(toggle).toBeVisible();

    // Antes de activar, no se ven los campos de personalización
    await expect(page.getByText('Color de grabado')).not.toBeVisible();
    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).not.toBeVisible();

    await toggle.click();

    await expect(page.getByText('Color de grabado')).toBeVisible();
    for (const color of PRODUCTO_MOCK.colores_disponibles) {
      await expect(page.getByRole('button', { name: color })).toBeVisible();
    }

    const inputTexto = page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder);
    await expect(inputTexto).toBeVisible();
    await inputTexto.fill('Para Juan');
    await expect(page.getByText(`9/${PRODUCTO_MOCK.personalizado_max_chars}`)).toBeVisible();

    // Seleccionar color y confirmar que queda marcado
    await page.getByRole('button', { name: 'negro' }).click();
    await expect(page.getByText('· negro')).toBeVisible();
  });

  test('producto sin apto_grabado: no muestra ninguna opción de personalización', async ({ page }) => {
    await mockProducto(page, { apto_grabado: false, personalizado_habilitado: false });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await expect(page.getByRole('heading', { name: PRODUCTO_MOCK.nombre })).toBeVisible();
    await expect(page.getByText('Grabado personalizado')).not.toBeVisible();
    await expect(page.getByText('Grabado láser', { exact: true })).not.toBeVisible(); // badge de la imagen
  });

  test('producto apto_grabado pero sin colores configurados: oculta el selector de color', async ({ page }) => {
    await mockProducto(page, { colores_disponibles: [] });
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByText('Grabado personalizado').click();

    await expect(page.getByText('Color de grabado')).not.toBeVisible();
    await expect(page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder)).toBeVisible();
  });

  test('agregar al carrito con personalización: el flujo se completa sin errores de consola', async ({ page }) => {
    const erroresConsola: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()); });
    page.on('pageerror', (err) => erroresConsola.push(err.message));

    await mockProducto(page, {});
    await page.goto(`/productos/${PRODUCTO_MOCK.slug}`);

    await page.getByText('Grabado personalizado').click();
    await page.getByRole('button', { name: 'negro' }).click();
    await page.getByPlaceholder(PRODUCTO_MOCK.personalizado_placeholder).fill('Para Juan');
    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    await expect(page.getByText('✓ Agregado')).toBeVisible();
    // Ignoramos ruido de red de recursos no mockeados (ej. favicon); no es
    // parte de la lógica de la app bajo test.
    const erroresRelevantes = erroresConsola.filter((e) => !e.includes('ERR_CONNECTION_REFUSED'));
    expect(erroresRelevantes).toEqual([]);
  });
});

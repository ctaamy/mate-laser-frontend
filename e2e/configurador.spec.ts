import { test, expect } from '@playwright/test';

// E2E hermético del configurador "Diseñá tu mate": mockeamos GET /configurador/pasos
// y POST .../disponibilidad vía page.route (mismo patrón que fixtures.ts), completamos
// los 6 pasos salteando uno (bombilla) y verificamos que el resumen lo refleja y que
// se puede agregar al carrito.

const PASOS = [
  {
    id: 'paso-material',
    nombre: 'Material',
    slug: 'material',
    orden: 0,
    salteable: false,
    nota_texto: null,
    permite_upload: false,
    es_resumen: false,
    opciones: [
      {
        id: 'op-calabaza',
        variante_id: 'var-calabaza',
        nombre_visible: 'Calabaza',
        descripcion_corta: 'Mate de calabaza natural',
        imagen_url: null,
        precio: 5000,
        precio_base_producto: 5000,
        sinStock: false,
      },
      {
        id: 'op-acero',
        variante_id: 'var-acero',
        nombre_visible: 'Acero',
        descripcion_corta: 'Mate de acero inoxidable',
        imagen_url: null,
        precio: 6500,
        precio_base_producto: 5000,
        sinStock: false,
      },
    ],
  },
  {
    id: 'paso-tamano',
    nombre: 'Tamaño',
    slug: 'tamano',
    orden: 1,
    salteable: false,
    nota_texto: null,
    permite_upload: false,
    es_resumen: false,
    opciones: [
      {
        id: 'op-chico',
        variante_id: 'var-chico',
        nombre_visible: 'Chico',
        descripcion_corta: null,
        imagen_url: null,
        precio: 0,
        precio_base_producto: 0,
        sinStock: false,
      },
      {
        id: 'op-grande',
        variante_id: 'var-grande',
        nombre_visible: 'Grande',
        descripcion_corta: null,
        imagen_url: null,
        precio: 500,
        precio_base_producto: 0,
        sinStock: false,
      },
    ],
  },
  {
    id: 'paso-diseno',
    nombre: 'Diseño',
    slug: 'diseno',
    orden: 2,
    salteable: true,
    nota_texto: 'Envianos tu diseño por WhatsApp al 11-5555-5555 para confirmar los detalles finales.',
    permite_upload: true,
    es_resumen: false,
    opciones: [],
  },
  {
    id: 'paso-bombilla',
    nombre: 'Bombilla',
    slug: 'bombilla',
    orden: 3,
    salteable: true,
    nota_texto: null,
    permite_upload: false,
    es_resumen: false,
    opciones: [
      {
        id: 'op-bombilla-acero',
        variante_id: 'var-bombilla-acero',
        nombre_visible: 'Bombilla de acero',
        descripcion_corta: null,
        imagen_url: null,
        precio: 800,
        precio_base_producto: 800,
        sinStock: false,
      },
    ],
  },
  {
    id: 'paso-regalo',
    nombre: 'Regalo',
    slug: 'regalo',
    orden: 4,
    salteable: true,
    nota_texto: null,
    permite_upload: false,
    es_resumen: false,
    opciones: [
      {
        id: 'op-caja-regalo',
        variante_id: 'var-caja-regalo',
        nombre_visible: 'Caja de regalo',
        descripcion_corta: null,
        imagen_url: null,
        precio: 300,
        precio_base_producto: 300,
        sinStock: false,
      },
    ],
  },
  {
    id: 'paso-resumen',
    nombre: 'Resumen',
    slug: 'resumen',
    orden: 5,
    salteable: false,
    nota_texto: null,
    permite_upload: false,
    es_resumen: true,
    opciones: [],
  },
];

async function mockConfigurador(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/configurador/pasos', (route) => route.fulfill({ json: PASOS }));
  await page.route('**/api/v1/configurador/pasos/*/disponibilidad', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: {} });
  });
}

test.describe('Configurador "Diseñá tu mate"', () => {
  test('completa el flujo salteando bombilla y agrega al carrito con el resumen correcto', async ({ page }) => {
    await mockConfigurador(page);
    await page.goto('/disena-tu-mate');

    await expect(page.getByRole('heading', { name: 'Diseñá tu mate' })).toBeVisible();

    // Paso 1: Material
    await expect(page.getByRole('heading', { name: 'Material' })).toBeVisible();
    await page.getByRole('button', { name: /Calabaza/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2: Tamaño
    await expect(page.getByRole('heading', { name: 'Tamaño' })).toBeVisible();
    await page.getByRole('button', { name: /Chico/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3: Diseño — mostramos el banner de nota_texto y salteamos
    await expect(page.getByRole('heading', { name: 'Diseño' })).toBeVisible();
    await expect(page.getByText(/Envianos tu diseño por WhatsApp/)).toBeVisible();
    await page.getByRole('button', { name: 'Saltear paso' }).click();

    // Paso 4: Bombilla — salteamos también
    await expect(page.getByRole('heading', { name: 'Bombilla' })).toBeVisible();
    await page.getByRole('button', { name: 'Saltear paso' }).click();

    // Paso 5: Regalo
    await expect(page.getByRole('heading', { name: 'Regalo' })).toBeVisible();
    await page.getByRole('button', { name: /Caja de regalo/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 6: Resumen
    await expect(page.getByRole('heading', { name: 'Resumen de tu mate' })).toBeVisible();
    await expect(page.getByText('Calabaza')).toBeVisible();
    await expect(page.getByText('Chico')).toBeVisible();
    await expect(page.getByText('Sin diseño', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin bombilla', { exact: true })).toBeVisible();
    await expect(page.getByText('Caja de regalo')).toBeVisible();
    await expect(page.getByText('Sin diseño personalizado')).toBeVisible();

    await page.getByRole('button', { name: /Agregar al carrito/i }).click();

    await expect(page).toHaveURL(/\/carrito/);

    const carrito = await page.evaluate(() => {
      const raw = localStorage.getItem('carrito-storage');
      return raw ? JSON.parse(raw) : null;
    });
    expect(carrito.state.items).toHaveLength(1);
    const item = carrito.state.items[0];
    expect(item.selecciones_configurador.length).toBe(3); // material + tamaño + regalo (bombilla y diseño salteados)
    expect(item.precio_unitario).toBe(5000 + 0 + 300);
  });
});

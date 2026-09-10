import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Variante 'banda' (banda plana) de como_funciona (datos.variante === 'banda'):
// franja a lo ancho, 3 pasos en fila con ícono fino a la izquierda + texto a
// la derecha, hairlines de 1px verticales entre columnas (desktop) que pasan
// a horizontales al apilar (< lg). Número "1." chico dentro del título. Sin
// cards, sin hover, sin número grande.
// La variante 'tarjetas' (default) está cubierta por como-funciona-rediseno.spec.ts.

async function mockHome(page: import('@playwright/test').Page, secciones: any[], config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: secciones }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: config }));
}

const BASE = { id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0 };
const PASOS = [
  { icono: 'Palette', titulo: 'Elegí y personalizá', desc: 'Sumá tu texto, logo o imagen.' },
  { icono: 'CheckCircle2', titulo: 'Aprobás el diseño', desc: 'Lo confirmás antes de grabar.' },
  { icono: 'Truck', titulo: 'Lo grabamos y te llega', desc: 'Envío a todo el país con seguimiento.' },
];

// Fila de un paso: el <div> más cercano con "gap-4" (el wrapper flex del paso).
const fila = (page: import('@playwright/test').Page, titulo: string) =>
  page.getByText(titulo).locator('xpath=ancestor::div[contains(@class,"gap-4")][1]');

test.describe('como_funciona — variante banda plana', () => {
  test('el número va chico, antepuesto al título ("1. …"), sin badge grande aparte', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('1. Elegí y personalizá')).toBeVisible();
    await expect(page.getByText('2. Aprobás el diseño')).toBeVisible();
    await expect(page.getByText('3. Lo grabamos y te llega')).toBeVisible();
    // Nada de badge "01" con padStart (eso es de tarjetas).
    await expect(page.getByText('01', { exact: true })).toHaveCount(0);
  });

  test('no renderiza cards con hover (sin ancestro .group)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('1. Elegí y personalizá').locator('xpath=ancestor::div[contains(@class,"group")]')).toHaveCount(0);
  });

  test('íconos a medida (no lucide), decorativos y de trazo fino', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-palette')).toHaveCount(0);
    const icono = fila(page, '1. Elegí y personalizá').locator('svg').first();
    await expect(icono).toBeVisible();
    await expect(icono).toHaveAttribute('aria-hidden', 'true');
    const sw = await icono.getAttribute('stroke-width');
    expect(parseFloat(sw || '99')).toBeLessThanOrEqual(1.6);
  });

  test('hairlines verticales entre columnas en desktop: border-left en los pasos 2+ y 0 en el 1º', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: PASOS, texto_color: '#ffffff' } }]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const grid = fila(page, '1. Elegí y personalizá').locator('xpath=ancestor::div[contains(@class,"grid")][1]');
    const cols = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(' ').length).toBe(3);

    const bl1 = await fila(page, '1. Elegí y personalizá').evaluate(el => parseFloat(getComputedStyle(el).borderLeftWidth));
    const bl2 = await fila(page, '2. Aprobás el diseño').evaluate(el => parseFloat(getComputedStyle(el).borderLeftWidth));
    const bt1 = await fila(page, '1. Elegí y personalizá').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(bl1).toBe(0);
    expect(bl2).toBeGreaterThan(0);
    expect(bt1).toBe(0); // en desktop no hay hairline horizontal
  });

  test('en pantallas chicas colapsa a una columna y los hairlines pasan a horizontales', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: PASOS, texto_color: '#ffffff' } }]);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    const grid = fila(page, '1. Elegí y personalizá').locator('xpath=ancestor::div[contains(@class,"grid")][1]');
    const cols = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(' ').length).toBe(1);

    const bt2 = await fila(page, '2. Aprobás el diseño').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    const bl2 = await fila(page, '2. Aprobás el diseño').evaluate(el => parseFloat(getComputedStyle(el).borderLeftWidth));
    const bt1 = await fila(page, '1. Elegí y personalizá').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(bt2).toBeGreaterThan(0);
    expect(bl2).toBe(0);
    expect(bt1).toBe(0); // el 1º no lleva hairline
  });

  test('el título de sección es opcional: sin datos.titulo no hay <h2>', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', titulo: '', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('1. Elegí y personalizá')).toBeVisible(); // la franja sí está
    const seccion = page.getByText('1. Elegí y personalizá').locator('xpath=ancestor::section[1]');
    await expect(seccion.locator('h2')).toHaveCount(0);
  });

  test('con datos.titulo, se renderiza el <h2>', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', titulo: 'Cómo comprar', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Cómo comprar' })).toBeVisible();
  });

  test('sin datos.pasos usa los 3 pasos default, con íconos a medida', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda' } }]);
    await page.goto('/');
    await expect(page.getByText('1. Elegí y personalizá')).toBeVisible();
    await expect(page.getByText('2. Aprobás el diseño')).toBeVisible();
    await expect(page.getByText('3. Lo grabamos y te llega')).toBeVisible();
    await expect(page.locator('svg.lucide-truck')).toHaveCount(0);
    await expect(fila(page, '3. Lo grabamos y te llega').locator('svg').first()).toBeVisible();
  });

  test('un 4º paso cae de nuevo en un ícono de librería (lucide)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'banda', pasos: [
      ...PASOS,
      { icono: 'Gift', titulo: 'Paso extra', desc: 'Cuarto paso.' },
    ] } }]);
    await page.goto('/');
    await expect(fila(page, '4. Paso extra').locator('svg.lucide-gift')).toBeVisible();
  });

  test('default (sin datos.variante) sigue siendo tarjetas — con .group y badge chico', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('Elegí y personalizá', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")]')).not.toHaveCount(0);
    await expect(page.getByText('1. Elegí y personalizá')).toHaveCount(0);
  });
});

test.describe('como_funciona — editor del admin (variante + agregar/quitar pasos)', () => {
  test('cambiar "Estilo visual" a banda y pasar de 4 a 3 pasos se guarda', async ({ page }) => {
    await loginComoAdmin(page);
    let guardadas: any[] | null = null;
    const seccion = {
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: {
        variante: 'tarjetas', titulo: '¿Cómo funciona?',
        pasos: [
          { icono: 'Palette', titulo: 'Uno', desc: 'a' },
          { icono: 'CheckCircle2', titulo: 'Dos', desc: 'b' },
          { icono: 'Zap', titulo: 'Tres', desc: 'c' },
          { icono: 'Package', titulo: 'Cuatro', desc: 'd' },
        ],
      },
    };
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        guardadas = route.request().postDataJSON().secciones;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: guardadas ?? [seccion] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: {} }) : route.continue());

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Contenido' }).first().click();

    await page.getByText('Estilo visual', { exact: true }).locator('..').locator('select').selectOption('banda');

    await expect(page.getByText(/^Pasos \(4\)$/)).toBeVisible();
    await page.getByText('Paso 4', { exact: true }).locator('..').getByRole('button').last().click();
    await expect(page.getByText(/^Pasos \(3\)$/)).toBeVisible();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(guardadas![0].datos.variante).toBe('banda');
    expect(guardadas![0].datos.pasos).toHaveLength(3);
    expect(guardadas![0].datos.pasos.map((p: any) => p.titulo)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  test('"Agregar paso" suma un paso vacío con ícono de fallback', async ({ page }) => {
    await loginComoAdmin(page);
    let guardadas: any[] | null = null;
    const seccion = {
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: { variante: 'banda', titulo: 'x', pasos: [{ icono: 'Palette', titulo: 'Uno', desc: 'a' }] },
    };
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        guardadas = route.request().postDataJSON().secciones;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: guardadas ?? [seccion] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: {} }) : route.continue());

    await page.goto('/admin/configuracion');
    const tarjeta = page.locator('.bg-white.border.rounded-xl.overflow-hidden').first();
    await tarjeta.getByRole('button').nth(3).click();
    await page.getByRole('button', { name: 'Contenido' }).first().click();

    await expect(page.getByText(/^Pasos \(1\)$/)).toBeVisible();
    await page.getByRole('button', { name: 'Agregar paso' }).click();
    await expect(page.getByText(/^Pasos \(2\)$/)).toBeVisible();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();
    expect(guardadas![0].datos.pasos).toHaveLength(2);
    expect(guardadas![0].datos.pasos[1].titulo).toBe('');
    expect(guardadas![0].datos.pasos[1].icono).toBeTruthy();
  });
});

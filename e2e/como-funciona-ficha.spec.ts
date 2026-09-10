import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Variante 'ficha' (ficha técnica) de como_funciona (datos.variante === 'ficha'):
// lista vertical, número grande y fino en columna izquierda + ícono a medida
// como sello, título + descripción a la derecha, reglas hairline de 1px
// arriba / entre filas / abajo. Sin cards ni hover.
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

const fila = (page: import('@playwright/test').Page, titulo: string) =>
  page.getByText(titulo, { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]');

test.describe('como_funciona — variante ficha técnica', () => {
  test('el número va como elemento propio y grande (01/02/03), no antepuesto al título', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: PASOS } }]);
    await page.goto('/');
    // Título limpio, sin "1. " adelante.
    await expect(page.getByText('Elegí y personalizá', { exact: true })).toBeVisible();
    await expect(page.getByText('1. Elegí y personalizá')).toHaveCount(0);
    const n1 = page.getByText('01', { exact: true });
    await expect(n1).toBeVisible();
    const fs = await n1.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThan(30); // en tarjetas el badge "01" es ~11px
  });

  test('no renderiza cards con hover (sin ancestro .group)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('Elegí y personalizá', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")]')).toHaveCount(0);
  });

  test('íconos a medida (no lucide), decorativos y de trazo fino', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.locator('svg.lucide-palette')).toHaveCount(0);
    const icono = fila(page, 'Elegí y personalizá').locator('svg').first();
    await expect(icono).toBeVisible();
    await expect(icono).toHaveAttribute('aria-hidden', 'true');
    const sw = await icono.getAttribute('stroke-width');
    expect(parseFloat(sw || '99')).toBeLessThanOrEqual(1.6);
  });

  test('reglas hairline: el contenedor tiene border arriba y abajo; las filas 2+ un border-top y la 1ª no', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: PASOS, texto_color: '#ffffff' } }]);
    await page.goto('/');
    const lista = fila(page, 'Elegí y personalizá').locator('xpath=ancestor::div[contains(@class,"border-y")][1]');
    const box = await lista.evaluate(el => {
      const s = getComputedStyle(el);
      return { top: parseFloat(s.borderTopWidth), bottom: parseFloat(s.borderBottomWidth) };
    });
    expect(box.top).toBeGreaterThan(0);
    expect(box.bottom).toBeGreaterThan(0);

    const bt1 = await fila(page, 'Elegí y personalizá').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    const bt2 = await fila(page, 'Aprobás el diseño').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(bt1).toBe(0);
    expect(bt2).toBeGreaterThan(0);
  });

  test('mantiene la columna de número + contenido en mobile (no colapsa a una sola)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: PASOS } }]);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    const cols = await fila(page, 'Aprobás el diseño').evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(' ').length).toBe(2);
    await expect(page.getByText('02', { exact: true })).toBeVisible();
  });

  test('sin datos.pasos usa los 3 pasos default, con íconos a medida', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha' } }]);
    await page.goto('/');
    await expect(page.getByText('Elegí y personalizá', { exact: true })).toBeVisible();
    await expect(page.getByText('Aprobás el diseño', { exact: true })).toBeVisible();
    await expect(page.getByText('Lo grabamos y te llega', { exact: true })).toBeVisible();
    await expect(page.locator('svg.lucide-truck')).toHaveCount(0);
    await expect(fila(page, 'Lo grabamos y te llega').locator('svg').first()).toBeVisible();
  });

  test('un 4º paso cae de nuevo en un ícono de librería (lucide)', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { variante: 'ficha', pasos: [
      ...PASOS,
      { icono: 'Gift', titulo: 'Paso extra', desc: 'Cuarto paso.' },
    ] } }]);
    await page.goto('/');
    await expect(fila(page, 'Paso extra').locator('svg.lucide-gift')).toBeVisible();
  });

  test('default (sin datos.variante) sigue siendo tarjetas — con .group y badge chico', async ({ page }) => {
    await mockHome(page, [{ ...BASE, datos: { pasos: PASOS } }]);
    await page.goto('/');
    await expect(page.getByText('Elegí y personalizá', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")]')).not.toHaveCount(0);
    const fs = await page.getByText('01', { exact: true }).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeLessThan(20);
  });
});

test.describe('como_funciona — editor del admin (variante + agregar/quitar pasos)', () => {
  test('cambiar "Estilo visual" a ficha y pasar de 4 a 3 pasos se guarda', async ({ page }) => {
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

    await page.getByText('Estilo visual', { exact: true }).locator('..').locator('select').selectOption('ficha');

    // Quitar el 4º paso.
    await expect(page.getByText(/^Pasos \(4\)$/)).toBeVisible();
    await page.getByText('Paso 4', { exact: true }).locator('..').getByRole('button').last().click();
    await expect(page.getByText(/^Pasos \(3\)$/)).toBeVisible();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(guardadas![0].datos.variante).toBe('ficha');
    expect(guardadas![0].datos.pasos).toHaveLength(3);
    expect(guardadas![0].datos.pasos.map((p: any) => p.titulo)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  test('"Agregar paso" suma un paso vacío con ícono de fallback', async ({ page }) => {
    await loginComoAdmin(page);
    let guardadas: any[] | null = null;
    const seccion = {
      id: 'cf-1', tipo: 'como_funciona', activo: true, orden: 0,
      datos: { variante: 'ficha', titulo: 'x', pasos: [{ icono: 'Palette', titulo: 'Uno', desc: 'a' }] },
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

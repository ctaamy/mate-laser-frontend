import { test, expect } from '@playwright/test';
import { loginComoAdmin, mockBackendAdminProductos, PRODUCTO_ADMIN_MOCK } from './fixtures-admin';

// Auditoría UX del panel admin — puntos 1 y 2 del plan priorizado: varias
// acciones sensibles (cambiar estado de una orden, confirmar pago, eliminar
// producto/cupón/sección/slide, desconectar una API de envío) ejecutaban la
// mutación directo al click, sin ningún paso de confirmación. Se agrega el
// mismo patrón que ya usaba Categorías (window.confirm nativo). Estos tests
// verifican ambos lados: cancelar NO dispara la mutación, confirmar SÍ.

test.describe('Confirmación al cambiar estado de una orden', () => {
  const ORDEN_MOCK = {
    id: 'orden-conf-1', estado: 'pendiente', total: 8000, metodo_pago: 'mercadopago',
    creado_en: new Date().toISOString(), usuarios: { nombre: 'Juan', apellido: 'Pérez' },
  };

  async function mockOrdenes(page: import('@playwright/test').Page, onPut: (body: any) => void) {
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_MOCK] } }));
    await page.route(`**/api/v1/ordenes/${ORDEN_MOCK.id}`, (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      onPut(route.request().postDataJSON());
      return route.fulfill({ json: { ...ORDEN_MOCK, ...route.request().postDataJSON() } });
    });
  }

  test('cancelar la confirmación no cambia el estado', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockOrdenes(page, (body) => { putBody = body; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    // Hay dos <select>: el filtro de estado de la lista y el del modal —
    // se acota por el label "Estado" (dentro del modal) para no confundirlos.
    await page.getByText('Estado', { exact: true }).locator('..').locator('select').selectOption('cancelado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.waitForTimeout(300);

    expect(putBody).toBeNull();
    await expect(page.getByRole('heading', { name: /Orden #/ })).toBeVisible();
  });

  test('confirmar el cambio de estado (incluido "cancelado") sí dispara la mutación', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockOrdenes(page, (body) => { putBody = body; });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Gestionar' }).click();
    // Hay dos <select>: el filtro de estado de la lista y el del modal —
    // se acota por el label "Estado" (dentro del modal) para no confundirlos.
    await page.getByText('Estado', { exact: true }).locator('..').locator('select').selectOption('cancelado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('heading', { name: /Orden #/ })).not.toBeVisible();
    expect(putBody).toMatchObject({ estado: 'cancelado' });
  });
});

test.describe('Confirmación al confirmar pago de una orden', () => {
  const ORDEN_RESERVADA = {
    id: 'orden-conf-2', estado: 'reservado', total: 5000, metodo_pago: 'mercadopago',
    creado_en: new Date().toISOString(), usuarios: null,
  };

  async function mockOrdenes(page: import('@playwright/test').Page, onPost: () => void) {
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [ORDEN_RESERVADA] } }));
    await page.route(`**/api/v1/pagos/confirmar/${ORDEN_RESERVADA.id}`, (route) => {
      onPost();
      return route.fulfill({ json: { ok: true } });
    });
  }

  test('cancelar la confirmación no marca el pago como confirmado', async ({ page }) => {
    await loginComoAdmin(page);
    let disparado = false;
    await mockOrdenes(page, () => { disparado = true; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Confirmar pago' }).click();
    await page.waitForTimeout(300);

    expect(disparado).toBe(false);
  });

  test('confirmar sí dispara la confirmación de pago', async ({ page }) => {
    await loginComoAdmin(page);
    let disparado = false;
    await mockOrdenes(page, () => { disparado = true; });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/ordenes');
    await page.getByRole('button', { name: 'Confirmar pago' }).click();
    await page.waitForTimeout(300);

    expect(disparado).toBe(true);
  });
});

test.describe('Confirmación al eliminar un producto', () => {
  test('cancelar no elimina el producto', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    let eliminado = false;
    await page.route(`**/api/v1/productos/${PRODUCTO_ADMIN_MOCK.id}`, (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      eliminado = true;
      return route.fulfill({ json: { ok: true } });
    });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').last().click();
    await page.waitForTimeout(300);

    expect(eliminado).toBe(false);
    await expect(page.getByText(PRODUCTO_ADMIN_MOCK.nombre)).toBeVisible();
  });

  test('confirmar sí elimina el producto', async ({ page }) => {
    await loginComoAdmin(page);
    await mockBackendAdminProductos(page);
    let eliminado = false;
    await page.route(`**/api/v1/productos/${PRODUCTO_ADMIN_MOCK.id}`, (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      eliminado = true;
      return route.fulfill({ json: { ok: true } });
    });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/productos');
    await page.locator('tr', { hasText: PRODUCTO_ADMIN_MOCK.nombre }).getByRole('button').last().click();
    await page.waitForTimeout(300);

    expect(eliminado).toBe(true);
  });
});

test.describe('Confirmación al eliminar un cupón', () => {
  const CUPON_MOCK = {
    id: 'cupon-conf-1', codigo: 'VERANO10', tipo: 'porcentaje', valor: 10,
    max_usos: 100, usos_realizados: 3, vence_en: null, activo: true,
  };

  async function mockCupones(page: import('@playwright/test').Page, onDelete: () => void) {
    await page.route('**/api/v1/cupones', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: [CUPON_MOCK] });
    });
    await page.route(`**/api/v1/cupones/${CUPON_MOCK.id}`, (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      onDelete();
      return route.fulfill({ json: { ok: true } });
    });
  }

  test('cancelar no elimina el cupón', async ({ page }) => {
    await loginComoAdmin(page);
    let eliminado = false;
    await mockCupones(page, () => { eliminado = true; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON_MOCK.codigo }).getByRole('button').last().click();
    await page.waitForTimeout(300);

    expect(eliminado).toBe(false);
  });

  test('confirmar sí elimina el cupón', async ({ page }) => {
    await loginComoAdmin(page);
    let eliminado = false;
    await mockCupones(page, () => { eliminado = true; });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/cupones');
    await page.locator('tr', { hasText: CUPON_MOCK.codigo }).getByRole('button').last().click();
    await page.waitForTimeout(300);

    expect(eliminado).toBe(true);
  });
});

test.describe('Confirmación al desconectar una API de envío', () => {
  const METODO_MOCK = {
    id: 1, nombre: 'Andreani', proveedor: 'andreani', descripcion: '',
    costo_fijo: 3000, activo: true, api_conectada: true, orden: 1,
  };

  async function mockEnvios(page: import('@playwright/test').Page, onDelete: () => void) {
    await page.route('**/api/v1/envios/admin/todos', (route) => route.fulfill({ json: [METODO_MOCK] }));
    await page.route('**/api/v1/configuracion', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });
    await page.route(`**/api/v1/envios/${METODO_MOCK.id}/credenciales`, (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      onDelete();
      return route.fulfill({ json: { ok: true } });
    });
  }

  test('cancelar no desconecta la API', async ({ page }) => {
    await loginComoAdmin(page);
    let desconectado = false;
    await mockEnvios(page, () => { desconectado = true; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Gestionar API' }).click(); // despliega el panel con "Desconectar"
    await page.getByRole('button', { name: 'Desconectar' }).click();
    await page.waitForTimeout(300);

    expect(desconectado).toBe(false);
  });

  test('confirmar sí desconecta la API', async ({ page }) => {
    await loginComoAdmin(page);
    let desconectado = false;
    await mockEnvios(page, () => { desconectado = true; });
    page.on('dialog', d => d.accept());

    await page.goto('/admin/envios');
    await page.getByRole('button', { name: 'Gestionar API' }).click(); // despliega el panel con "Desconectar"
    await page.getByRole('button', { name: 'Desconectar' }).click();
    await page.waitForTimeout(300);

    expect(desconectado).toBe(true);
  });
});

test.describe('Confirmación al eliminar una sección o un slide en Configuración', () => {
  const HERO_2_SLIDES = {
    id: 'hero-conf-1', tipo: 'hero', activo: true, orden: 0,
    datos: { slides: [{ titulo: 'Slide 1' }, { titulo: 'Slide 2' }] },
  };
  const BANNER = {
    id: 'banner-conf-1', tipo: 'banner_texto', activo: true, orden: 1,
    datos: { texto: 'Envío gratis' },
  };

  async function mockConfiguracion(page: import('@playwright/test').Page, onPut: (body: any) => void) {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
      if (route.request().method() === 'PUT') {
        onPut(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: [HERO_2_SLIDES, BANNER] });
    });
    await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({ json: {} });
    });
  }

  test('cancelar no elimina el bloque "Banner de texto"', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/configuracion');
    const tarjetaBanner = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Banner de texto' });
    await tarjetaBanner.getByRole('button').last().click();
    await page.waitForTimeout(300);

    expect(putBody).toBeNull();
    await expect(tarjetaBanner).toBeVisible();
  });

  test('confirmar sí elimina el bloque, avisando qué se pierde', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });
    let mensajeDialogo = '';
    page.on('dialog', d => { mensajeDialogo = d.message(); d.accept(); });

    await page.goto('/admin/configuracion');
    const tarjetaBanner = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Banner de texto' });
    await tarjetaBanner.getByRole('button').last().click();

    expect(mensajeDialogo).toMatch(/título|imágenes|botones|estilos/i);
    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const secciones = putBody.secciones as any[];
    expect(secciones.find((s: any) => s.tipo === 'banner_texto')).toBeUndefined();
    expect(secciones.find((s: any) => s.tipo === 'hero')).toBeTruthy();
  });

  test('cancelar no elimina el slide del hero', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });
    page.on('dialog', d => d.dismiss());

    await page.goto('/admin/configuracion');
    const tarjetaHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' }).first();
    await tarjetaHero.getByRole('button').nth(3).click(); // expandir la card

    // El título "Slide 1" también aparece en el <textarea> (contenido) y en
    // la vista previa en vivo — se acota al <span> del header del slide.
    const slide1Header = tarjetaHero.locator('span.text-gray-800', { hasText: 'Slide 1' });
    await slide1Header.locator('..').getByRole('button').first().click();
    await page.waitForTimeout(300);

    expect(putBody).toBeNull();
    await expect(slide1Header).toBeVisible();
    await expect(tarjetaHero.locator('span.text-gray-800', { hasText: 'Slide 2' })).toBeVisible();
  });

  test('confirmar sí elimina el slide, avisando qué se pierde', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockConfiguracion(page, (body) => { putBody = body; });
    let mensajeDialogo = '';
    page.on('dialog', d => { mensajeDialogo = d.message(); d.accept(); });

    await page.goto('/admin/configuracion');
    const tarjetaHero = page.locator('.bg-white.border.rounded-xl.overflow-hidden').filter({ hasText: 'Hero' }).first();
    await tarjetaHero.getByRole('button').nth(3).click(); // expandir la card

    const slide1Header = tarjetaHero.locator('span.text-gray-800', { hasText: 'Slide 1' });
    await slide1Header.locator('..').getByRole('button').first().click();

    expect(mensajeDialogo).toMatch(/título|imagen|botones|estilos/i);
    await expect(slide1Header).toHaveCount(0);

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const heroSec = (putBody.secciones as any[]).find((s: any) => s.tipo === 'hero');
    expect(heroSec.datos.slides).toHaveLength(1);
    expect(heroSec.datos.slides[0].titulo).toBe('Slide 2');
  });
});

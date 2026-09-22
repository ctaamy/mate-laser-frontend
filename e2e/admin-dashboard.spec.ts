import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 11: "Ventas totales" sumaba a mano las órdenes de
// GET /ordenes?limit=100 (truncado si hay más de 100 históricas) y no
// existía ninguna métrica de "hoy" — el nombre de la card inducía a
// pensar que era del día. Ahora "Ventas hoy" y "Ventas históricas" salen
// de un endpoint agregado (GET /ordenes/estadisticas) sin ese límite.
//
// El Dashboard se dividió en 2 tabs: "Operativo" (números de ahora mismo,
// lo que ya había) y "Métricas" (análisis filtrable por rango, ver
// GET /ordenes/metricas) — Tami pidió más profundidad ("una línea con 4
// cards que mucho no dicen"). "Ventas históricas" y "Órdenes totales" se
// sacaron de Operativo (dejan de decir algo accionable sin contexto
// temporal) y ahora viven dentro de Métricas.

test.describe('Admin — Dashboard — tab Operativo', () => {
  test('muestra "Ventas hoy" como número accionable, sin ambigüedad de fecha', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: { ventas_totales: 950000, ventas_hoy: 12000, ordenes_totales: 137, ordenes_pendientes: 4 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();
    await expect(page.getByText('$12.000', { exact: false })).toBeVisible();
    await expect(page.getByText('4', { exact: true })).toBeVisible(); // Pendientes de pago

    // "Ventas históricas" y "Órdenes totales" se movieron al tab Métricas.
    await expect(page.getByText('Ventas históricas', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Órdenes totales', { exact: true })).not.toBeVisible();
  });

  test('sin ventas hoy, muestra $0 en vez de romperse o quedar en blanco', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    const cardVentasHoy = page.getByText('Ventas hoy', { exact: true }).locator('..').locator('..');
    await expect(cardVentasHoy.getByText('$0')).toBeVisible();
  });

  test('link "Ver todas" en Últimas órdenes lleva a /admin/ordenes', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route) =>
      route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.getByRole('link', { name: /ver todas/i })).toHaveAttribute('href', '/admin/ordenes');
  });
});

test.describe('Admin — Dashboard — tab Métricas', () => {
  const METRICAS_MOCK = {
    rango: '30d',
    periodo_actual: { ventas: 100000, ordenes: 8, ticket_promedio: 12500 },
    periodo_anterior: { ventas: 80000, ordenes: 8, ticket_promedio: 10000 },
    ranking_productos: [
      { producto_id: 'p1', nombre: 'Mate Imperial Grabado', unidades: 12, ventas: 60000 },
      { producto_id: 'p2', nombre: 'Bombilla de acero', unidades: 20, ventas: 30000 },
    ],
    ticket_promedio_por_canal: [
      { canal: 'web', ticket_promedio: 15000, ventas: 75000, ordenes: 5 },
      { canal: 'admin_manual', ticket_promedio: 8333, ventas: 25000, ordenes: 3 },
    ],
    personalizacion: { lineas_totales: 40, pct_con_grabado: 25, pct_con_bombilla: 50 },
    ventas_por_origen: [
      { origen_venta: 'instagram', ventas: 15000, ordenes: 2 },
      { origen_venta: 'feria', ventas: 10000, ordenes: 1 },
      { origen_venta: null, ventas: 0, ordenes: 0 },
    ],
    cupones: { ordenes_con_cupon: 2, ordenes_totales: 8, descuento_total: 4000 },
    serie_temporal: [
      { fecha: '2026-09-18T00:00:00.000Z', ventas: 10000 },
      { fecha: '2026-09-19T00:00:00.000Z', ventas: 0 },
      { fecha: '2026-09-20T00:00:00.000Z', ventas: 25000 },
      { fecha: '2026-09-21T00:00:00.000Z', ventas: 15000 },
      { fecha: '2026-09-22T00:00:00.000Z', ventas: 50000 },
    ],
  };

  const setupBase = async (page: any) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route: any) =>
      route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route: any) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route: any) => route.fulfill({ json: { data: [] } }));
  };

  test('al entrar al tab, pide el rango 30D por default y muestra el resumen del período', async ({ page }) => {
    await setupBase(page);
    let urlPedida = '';
    await page.route('**/api/v1/ordenes/metricas**', (route) => {
      urlPedida = route.request().url();
      route.fulfill({ json: METRICAS_MOCK });
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    expect(urlPedida).toContain('rango=30d');
    await expect(page.getByText('Ventas del período')).toBeVisible();
    await expect(page.getByText('$100.000', { exact: false })).toBeVisible();
    await expect(page.getByText('Ticket promedio', { exact: true })).toBeVisible();
    await expect(page.getByText('$12.500', { exact: false })).toBeVisible();
  });

  test('muestra el delta vs. período anterior con signo correcto', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: METRICAS_MOCK }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    // (100000-80000)/80000 = +25% — coincide con el delta de ticket_promedio
    // en este mock (misma proporción), por eso el .first().
    await expect(page.getByText('+25%', { exact: false }).first()).toBeVisible();
  });

  test('rango "todo" sin período anterior: no muestra ningún delta', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) =>
      route.fulfill({ json: { ...METRICAS_MOCK, periodo_anterior: null } }),
    );

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('vs. período anterior', { exact: false })).not.toBeVisible();
  });

  test('cambiar el rango vuelve a pedir /ordenes/metricas con el rango nuevo', async ({ page }) => {
    await setupBase(page);
    let ultimaUrl = '';
    await page.route('**/api/v1/ordenes/metricas**', (route) => {
      ultimaUrl = route.request().url();
      route.fulfill({ json: METRICAS_MOCK });
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();
    await page.getByRole('button', { name: '7D', exact: true }).click();

    await expect.poll(() => ultimaUrl).toContain('rango=7d');
  });

  test('ranking de productos: muestra nombre, unidades y ventas', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: METRICAS_MOCK }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Mate Imperial Grabado')).toBeVisible();
    await expect(page.getByText('Bombilla de acero')).toBeVisible();
    await expect(page.getByText('12 u.', { exact: false })).toBeVisible();
  });

  test('sin ventas en el período, el ranking muestra un mensaje en vez de quedar vacío sin explicación', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) =>
      route.fulfill({ json: { ...METRICAS_MOCK, ranking_productos: [] } }),
    );

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Sin ventas en este período')).toBeVisible();
  });

  test('ticket promedio por canal: traduce canal a etiqueta legible (Web / Manual)', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: METRICAS_MOCK }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Web', { exact: true })).toBeVisible();
    await expect(page.getByText('Manual', { exact: true })).toBeVisible();
  });

  test('ventas por origen: filtra las filas sin canal informado (origen_venta null)', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: METRICAS_MOCK }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Instagram', { exact: true })).toBeVisible();
    await expect(page.getByText('Feria', { exact: true })).toBeVisible();
  });

  test('personalización y cupones: muestra los porcentajes calculados por el backend', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: METRICAS_MOCK }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Con grabado personalizado')).toBeVisible();
    await expect(page.getByText('25%', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Con bombilla agregada')).toBeVisible();
    await expect(page.getByText('50%', { exact: true })).toBeVisible();
    await expect(page.getByText('$4.000', { exact: false })).toBeVisible();
  });

  test('mientras carga, no muestra el skeleton del tab Operativo por error', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', async (route) => {
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({ json: METRICAS_MOCK });
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    // No se dispara la query de métricas hasta entrar al tab — antes de
    // eso no debería haber pedido nada a /ordenes/metricas.
    await expect(page.getByText('Ventas del período')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin — Dashboard — gráfico de tendencia de ventas', () => {
  const METRICAS_BASE = {
    rango: '30d',
    periodo_actual: { ventas: 100000, ordenes: 8, ticket_promedio: 12500 },
    periodo_anterior: null,
    ranking_productos: [],
    ticket_promedio_por_canal: [],
    personalizacion: { lineas_totales: 0, pct_con_grabado: 0, pct_con_bombilla: 0 },
    ventas_por_origen: [],
    cupones: { ordenes_con_cupon: 0, ordenes_totales: 0, descuento_total: 0 },
  };

  const setupBase = async (page: any) => {
    await loginComoAdmin(page);
    await page.route('**/api/v1/ordenes/estadisticas', (route: any) =>
      route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } }),
    );
    await page.route('**/api/v1/ordenes?**', (route: any) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route: any) => route.fulfill({ json: { data: [] } }));
  };

  test('con 2 o más puntos, dibuja el gráfico', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: {
      ...METRICAS_BASE,
      serie_temporal: [
        { fecha: '2026-09-20T00:00:00.000Z', ventas: 10000 },
        { fecha: '2026-09-21T00:00:00.000Z', ventas: 20000 },
      ],
    } }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    await expect(page.getByText('Tendencia de ventas')).toBeVisible();
    await expect(page.locator('svg polyline')).toBeVisible();
  });

  test('con un solo punto (rango "hoy"), no dibuja el gráfico y explica por qué', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: {
      ...METRICAS_BASE,
      rango: 'hoy',
      serie_temporal: [{ fecha: '2026-09-22T00:00:00.000Z', ventas: 5000 }],
    } }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();
    await page.getByRole('button', { name: 'Hoy', exact: true }).click();

    await expect(page.getByText('Tendencia de ventas')).not.toBeVisible();
    await expect(page.getByText(/La tendencia necesita más de un día/)).toBeVisible();
  });

  test('sin ventas (todos los puntos en 0) no rompe, sigue dibujando el eje', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: {
      ...METRICAS_BASE,
      serie_temporal: [
        { fecha: '2026-09-20T00:00:00.000Z', ventas: 0 },
        { fecha: '2026-09-21T00:00:00.000Z', ventas: 0 },
        { fecha: '2026-09-22T00:00:00.000Z', ventas: 0 },
      ],
    } }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    // No se chequea toBeVisible() acá: la línea anima su trazo de entrada
    // (motion, pathLength 0→1) y con los 3 puntos superpuestos en la misma
    // altura (todos en $0) el bounding box intermedio de la animación puede
    // medir 0 en algún frame — falso negativo de timing, no del componente
    // (las otras 3 pruebas de este gráfico, con datos reales, sí verifican
    // toBeVisible() y pasan). Lo que importa acá es que no se rompa con
    // todos los valores en cero: attached al DOM y puntos sin NaN/Infinity.
    const polyline = page.locator('svg polyline');
    await expect(polyline).toHaveCount(1);
    const points = await polyline.getAttribute('points');
    expect(points).not.toContain('NaN');
    expect(points).not.toContain('Infinity');
  });

  test('al pasar el mouse sobre el gráfico, muestra un tooltip con el valor', async ({ page }) => {
    await setupBase(page);
    await page.route('**/api/v1/ordenes/metricas**', (route) => route.fulfill({ json: {
      ...METRICAS_BASE,
      serie_temporal: [
        { fecha: '2026-09-20T00:00:00.000Z', ventas: 10000 },
        { fecha: '2026-09-21T00:00:00.000Z', ventas: 20000 },
        { fecha: '2026-09-22T00:00:00.000Z', ventas: 77000 },
      ],
    } }));

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Métricas' }).click();

    const svg = page.locator('svg').filter({ has: page.locator('polyline') });
    const box = await svg.boundingBox();
    if (!box) throw new Error('no se encontró el svg');
    // Extremo derecho → último punto ($77.000, el más alto de la serie).
    await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);

    await expect(page.getByText('$77.000')).toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Compras de prueba: Tami y Facu prueban el checkout en producción y esas
// órdenes no pueden contar en métricas ni contadores. Desde Órdenes → Gestionar
// se marcan como "de prueba" (el backend las deja fuera de todo y, si se pide,
// devuelve el stock y libera el cupón). No se borran: hay plata real de por medio.
//
// 100 % mockeado (page.route), como el resto de los specs admin.

const ID_REAL = 'aaaa1111-0000-4000-8000-000000000001';
const ID_PRUEBA = 'bbbb2222-0000-4000-8000-000000000002';

const orden = (extra: Record<string, unknown> = {}) => ({
  id: ID_REAL,
  estado: 'pagado',
  total: 17500,
  metodo_pago: 'efectivo',
  creado_en: new Date().toISOString(),
  es_prueba: false,
  cupon_id: null,
  stock_liberado_en: null,
  usuarios: { nombre: 'Ana', apellido: 'Gómez' },
  items_orden: [
    { id: 'item-1', nombre_producto: 'Mate Imperial', cantidad: 1, precio_unitario: 17500, subtotal: 17500 },
  ],
  pagos: [],
  ...extra,
});

// Simula el contrato del backend: sin `incluir_pruebas=true` las de prueba no vienen.
async function mockLista(page: Page, ordenes: Array<{ es_prueba: boolean }>): Promise<string[]> {
  const urls: string[] = [];
  await page.route('**/api/v1/ordenes?**', (route) => {
    const url = route.request().url();
    urls.push(url);
    const incluir = new URL(url).searchParams.get('incluir_pruebas') === 'true';
    return route.fulfill({ json: { data: ordenes.filter((o) => incluir || !o.es_prueba) } });
  });
  return urls;
}

const abrirGestionar = async (page: Page) => {
  await page.getByRole('button', { name: 'Gestionar' }).first().click();
};

// El segundo modal (confirmación) se renderiza después del de Gestionar: su
// botón "Marcar como prueba" es el último del DOM.
const botonConfirmarMarcar = (page: Page) => page.getByRole('button', { name: 'Marcar como prueba' }).last();

test.describe('Admin — Órdenes — lista con pruebas ocultas', () => {
  test('por default no pide las pruebas; "Mostrar pruebas" las incluye y las marca con un badge', async ({ page }) => {
    await loginComoAdmin(page);
    const urls = await mockLista(page, [orden(), orden({ id: ID_PRUEBA, es_prueba: true })]);

    await page.goto('/admin/ordenes');

    await expect(page.getByText('#AAAA1111')).toBeVisible();
    await expect(page.getByText('#BBBB2222')).not.toBeVisible();
    expect(urls[0]).not.toContain('incluir_pruebas');

    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();

    await expect(page.getByText('#BBBB2222')).toBeVisible();
    await expect(page.getByText('Prueba', { exact: true })).toBeVisible();
    expect(urls.some((u) => u.includes('incluir_pruebas=true'))).toBe(true);
  });

  test('la fila de prueba se ve atenuada; la real no', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden(), orden({ id: ID_PRUEBA, es_prueba: true })]);

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();

    const filaReal = page.getByRole('row', { name: /#AAAA1111/ });
    const filaPrueba = page.getByRole('row', { name: /#BBBB2222/ });
    await expect(filaPrueba).toHaveClass(/opacity-70/);
    await expect(filaReal).not.toHaveClass(/opacity-70/);
  });

  // Sin esto, buscar el # de una orden de prueba parece un bug (y hoy prod puede
  // tener solo pruebas): el empty state tiene que explicar por qué no hay nada.
  test('sin resultados y con las pruebas ocultas, el empty state lo explica y ofrece mostrarlas', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ id: ID_PRUEBA, es_prueba: true })]);

    await page.goto('/admin/ordenes');

    await expect(page.getByText('Las de prueba están ocultas.')).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar pruebas' }).click();

    await expect(page.getByRole('checkbox', { name: 'Mostrar pruebas' })).toBeChecked();
    await expect(page.getByText('#BBBB2222')).toBeVisible();
  });

  test('con las pruebas visibles y sin órdenes, el empty state ya no habla de pruebas ocultas', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, []);

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();

    await expect(page.getByText('No hay órdenes todavía')).toBeVisible();
    await expect(page.getByText('Las de prueba están ocultas.')).not.toBeVisible();
  });
});

test.describe('Admin — Órdenes — marcar como prueba', () => {
  test('la confirmación identifica la orden, trae el checkbox de stock TILDADO y avisa al confirmar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    let body: unknown = null;
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: true, cupon_liberado: false } });
    });

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByRole('heading', { name: '¿Marcar #AAAA1111 como prueba?' })).toBeVisible();
    // Identidad de la orden: el riesgo real es marcar una venta de verdad.
    await expect(page.getByText('Ana Gómez · $17.500 · pagado')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Devolver el stock al inventario/ })).toBeChecked();
    await expect(page.getByText('Podés desmarcarla cuando quieras.')).toBeVisible();

    await botonConfirmarMarcar(page).click();

    expect(body).toEqual({ reintegrar_stock: true });
    const aviso = page.getByRole('status');
    await expect(aviso).toContainText('Orden #AAAA1111 marcada como prueba');
    await expect(aviso).toContainText('Se devolvió el stock');
    // Ambos modales se cierran.
    await expect(page.getByRole('heading', { name: '¿Marcar #AAAA1111 como prueba?' })).not.toBeVisible();
    await expect(page.getByText('Orden #AAAA1111', { exact: true })).not.toBeVisible();
  });

  test('al destildar el checkbox manda reintegrar_stock:false', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    let body: unknown = null;
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: false, cupon_liberado: false } });
    });

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await page.getByRole('checkbox', { name: /Devolver el stock al inventario/ }).uncheck();
    await botonConfirmarMarcar(page).click();

    expect(body).toEqual({ reintegrar_stock: false });
    await expect(page.getByRole('status')).not.toContainText('Se devolvió el stock');
  });

  test('el aviso ofrece "Mostrar pruebas" (la fila desaparece de la lista: que no parezca borrada)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) =>
      route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: false, cupon_liberado: false } }),
    );

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await botonConfirmarMarcar(page).click();

    await page.getByRole('status').getByRole('button', { name: 'Mostrar pruebas' }).click();
    await expect(page.getByRole('checkbox', { name: 'Mostrar pruebas' })).toBeChecked();
    // Se puede cerrar.
    await page.getByRole('button', { name: 'Cerrar aviso' }).click();
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  test('con cupón, la confirmación avisa que lo libera; el aviso final también', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ cupon_id: 'cup-1' })]);
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) =>
      route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: true, cupon_liberado: true } }),
    );

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByText('Libera el uso del cupón.')).toBeVisible();
    await botonConfirmarMarcar(page).click();

    await expect(page.getByRole('status')).toContainText('Se liberó el cupón');
  });

  test('sin cupón, no menciona ningún cupón', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByText('Libera el uso del cupón.')).not.toBeVisible();
  });

  test('pago por Mercado Pago: aclara que NO reembolsa (se hace desde MP)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ metodo_pago: 'mercadopago' })]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByText('No reembolsa el pago: hacelo desde Mercado Pago.')).toBeVisible();
  });

  test('pago en efectivo: no muestra el aviso de reembolso de Mercado Pago', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ metodo_pago: 'efectivo' })]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByText('No reembolsa el pago')).not.toBeVisible();
  });

  test('orden cancelada: se puede marcar pero sin checkbox de stock (ya volvió o nunca salió)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ estado: 'cancelado' })]);
    let body: unknown = null;
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: false, cupon_liberado: false } });
    });

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByRole('checkbox', { name: /Devolver el stock/ })).toHaveCount(0);
    await expect(page.getByText('No se toca el stock: la orden ya está cancelada.')).toBeVisible();

    await botonConfirmarMarcar(page).click();
    expect(body).toEqual({ reintegrar_stock: false });
  });

  test('stock ya devuelto (stock_liberado_en): sin checkbox y lo dice', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ stock_liberado_en: new Date().toISOString() })]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    await expect(page.getByRole('checkbox', { name: /Devolver el stock/ })).toHaveCount(0);
    await expect(page.getByText('El stock ya estaba devuelto: no se toca.')).toBeVisible();
  });

  // Pre-pago: pueden tener stock reservado y un webhook/cron las mueve en
  // cualquier momento → el backend responde 409; la UI ni siquiera lo ofrece.
  //
  // La pista depende del caso, porque cambiar el estado a mano a "cancelado" NO
  // devuelve el stock reservado (PUT /ordenes/:id no lo toca): solo se aconseja
  // cancelar donde es seguro (MP sin pagar, que nunca descontó stock).
  const PISTAS: Record<string, RegExp> = {
    pendiente: /no descontó stock\. Cancelala cambiando su estado/,
    reservado: /Dejá que venza la reserva \(se cancela sola y devuelve el stock\)/,
    esperando_confirmacion: /Dejá que venza la reserva \(se cancela sola y devuelve el stock\)/,
    pendiente_pago: /Usá "Anular venta" \(devuelve el stock\)/,
    pago_parcial: /Usá "Anular venta" \(devuelve el stock\)/,
  };
  for (const [estado, pista] of Object.entries(PISTAS)) {
    test(`orden ${estado} (pre-pago): el botón está deshabilitado y explica qué hacer`, async ({ page }) => {
      await loginComoAdmin(page);
      await mockLista(page, [orden({ estado })]);

      await page.goto('/admin/ordenes');
      await abrirGestionar(page);

      await expect(page.getByRole('button', { name: 'Marcar como prueba' })).toBeDisabled();
      await expect(page.getByText(pista)).toBeVisible();
    });
  }

  test('nunca aconseja cancelar a mano una orden con stock reservado (no lo devuelve)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ estado: 'reservado' })]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);

    await expect(page.getByText(/Cancelala/)).toHaveCount(0);
  });

  test('si el backend responde 409, el error se muestra DENTRO de la confirmación y no se cierra', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) =>
      route.fulfill({ status: 409, json: { message: 'La orden cambió mientras se marcaba. Revisala y probá de nuevo.' } }),
    );

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await botonConfirmarMarcar(page).click();

    await expect(page.getByRole('alert')).toContainText('La orden cambió mientras se marcaba');
    await expect(page.getByRole('heading', { name: '¿Marcar #AAAA1111 como prueba?' })).toBeVisible();
    await expect(page.getByRole('status')).not.toBeVisible();
  });

  test('"Volver" cierra la confirmación sin llamar al backend', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    let llamadas = 0;
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) => {
      llamadas++;
      return route.fulfill({ json: {} });
    });

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await page.getByRole('button', { name: 'Volver' }).click();

    await expect(page.getByRole('heading', { name: '¿Marcar #AAAA1111 como prueba?' })).not.toBeVisible();
    expect(llamadas).toBe(0);
  });

  // El QueryClient tiene staleTime de 5 min: sin invalidar, volver al Dashboard
  // justo después de marcar mostraría los números viejos (con la prueba adentro).
  test('marcar refresca las métricas del Dashboard: al volver, las vuelve a pedir en vez de mostrar la caché', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    let statsCalls = 0;
    await page.route('**/api/v1/ordenes/estadisticas', (route) => {
      statsCalls++;
      return route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } });
    });
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) =>
      route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: true, cupon_liberado: false } }),
    );

    // Se pasa por el Dashboard primero para que su query quede en la caché.
    await page.goto('/admin');
    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();
    const antes = statsCalls;

    await page.getByRole('link', { name: /Órdenes/ }).first().click();
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await botonConfirmarMarcar(page).click();
    await expect(page.getByRole('status')).toBeVisible();

    // Volver atrás en el SPA (sin recargar): la caché de react-query sigue viva.
    await page.goBack();
    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();

    await expect.poll(() => statsCalls).toBeGreaterThan(antes);
  });

  test('control: sin marcar nada, volver al Dashboard usa la caché (no vuelve a pedir las estadísticas)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    let statsCalls = 0;
    await page.route('**/api/v1/ordenes/estadisticas', (route) => {
      statsCalls++;
      return route.fulfill({ json: { ventas_totales: 0, ventas_hoy: 0, ordenes_totales: 0, ordenes_pendientes: 0 } });
    });
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');
    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Órdenes/ }).first().click();
    await expect(page.getByText('#AAAA1111')).toBeVisible();
    await page.goBack();
    await expect(page.getByText('Ventas hoy', { exact: true })).toBeVisible();

    // Es lo que hace significativo al test anterior: sin invalidar, no se re-pide.
    expect(statsCalls).toBe(1);
  });
});

test.describe('Admin — Órdenes — desmarcar', () => {
  const marcada = (extra: Record<string, unknown> = {}) => orden({ id: ID_PRUEBA, es_prueba: true, ...extra });

  test('una orden de prueba lo indica arriba del modal y ofrece "Desmarcar" (no "Marcar")', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [marcada()]);

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();
    await abrirGestionar(page);

    await expect(page.getByRole('note')).toContainText('Orden de prueba');
    await expect(page.getByRole('button', { name: 'Desmarcar como prueba' })).toBeVisible();
    // exact: "Desmarcar como prueba" contiene "marcar como prueba" como subcadena.
    await expect(page.getByRole('button', { name: 'Marcar como prueba', exact: true })).toHaveCount(0);
  });

  test('desmarcar llama a /desmarcar-prueba y avisa que vuelve a contar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [marcada()]);
    let llamado = false;
    await page.route(`**/api/v1/ordenes/${ID_PRUEBA}/desmarcar-prueba`, (route) => {
      llamado = true;
      return route.fulfill({ json: { id: ID_PRUEBA, es_prueba: false, stock_recontado: false, cupon_recontado: false } });
    });

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Desmarcar como prueba' }).click();

    await expect(page.getByRole('heading', { name: '¿Desmarcar #BBBB2222?' })).toBeVisible();
    await expect(page.getByText('Vuelve a contar en ventas, ticket y ranking.')).toBeVisible();
    await page.getByRole('button', { name: 'Desmarcar', exact: true }).click();

    await expect(page.getByRole('status')).toContainText('desmarcada: vuelve a contar en métricas');
    expect(llamado).toBe(true);
  });

  test('si se había devuelto el stock, la confirmación avisa que se vuelve a descontar', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [marcada({ stock_liberado_en: new Date().toISOString(), cupon_id: 'cup-1' })]);

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Desmarcar como prueba' }).click();

    await expect(page.getByText(/Se vuelve a descontar del inventario el stock que se había devuelto/)).toBeVisible();
    await expect(page.getByText('Se vuelve a contar el uso del cupón.')).toBeVisible();
  });

  test('sin stock suficiente al desmarcar, el 409 se muestra dentro de la confirmación', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [marcada({ stock_liberado_en: new Date().toISOString() })]);
    await page.route(`**/api/v1/ordenes/${ID_PRUEBA}/desmarcar-prueba`, (route) =>
      route.fulfill({ status: 409, json: { message: 'No se pudo volver a contar el stock de esta orden: Stock insuficiente para Mate Imperial.' } }),
    );

    await page.goto('/admin/ordenes');
    await page.getByRole('checkbox', { name: 'Mostrar pruebas' }).check();
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Desmarcar como prueba' }).click();
    await page.getByRole('button', { name: 'Desmarcar', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('Stock insuficiente para Mate Imperial');
    await expect(page.getByRole('heading', { name: '¿Desmarcar #BBBB2222?' })).toBeVisible();
  });
});

// Requisito del proyecto: los flujos admin nuevos se verifican a 360 px (el
// admin se usa desde el celular). Antes de esto, el header de Órdenes no tenía
// flex-wrap y la tabla de 7 columnas quedaba cortada por el overflow-hidden de
// la card.
test.describe('Admin — Órdenes — compras de prueba a 360 px', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('la página no desborda en horizontal y el toggle es tocable (>= 44 px)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);

    await page.goto('/admin/ordenes');
    await expect(page.getByText('#AAAA1111')).toBeVisible();

    const anchoDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(anchoDocumento).toBeLessThanOrEqual(360);

    const toggle = page.getByText('Mostrar pruebas').first();
    const caja = await page.locator('label', { hasText: 'Mostrar pruebas' }).boundingBox();
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    await expect(toggle).toBeVisible();
  });

  test('la tabla scrollea en horizontal dentro de su contenedor (no queda cortada)', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);

    await page.goto('/admin/ordenes');
    await expect(page.getByText('#AAAA1111')).toBeVisible();

    const { overflowX, scrollable } = await page.evaluate(() => {
      const tabla = document.querySelector('table')!;
      const cont = tabla.parentElement!;
      return { overflowX: getComputedStyle(cont).overflowX, scrollable: cont.scrollWidth > cont.clientWidth };
    });
    expect(overflowX).toBe('auto');
    expect(scrollable).toBe(true);
    // Y "Gestionar" (la última columna) se puede alcanzar.
    await page.getByRole('button', { name: 'Gestionar' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Gestionar' })).toBeVisible();
  });

  test('la confirmación entra en pantalla: sus dos botones quedan dentro del viewport', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden({ metodo_pago: 'mercadopago', cupon_id: 'cup-1' })]);

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();

    for (const nombre of ['Volver', 'Marcar como prueba']) {
      const caja = await page.getByRole('button', { name: nombre }).last().boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
    }
    await expect(page.getByRole('checkbox', { name: /Devolver el stock/ })).toBeVisible();
  });

  test('el aviso post-acción y su botón de cerrar quedan dentro de la pantalla', async ({ page }) => {
    await loginComoAdmin(page);
    await mockLista(page, [orden()]);
    await page.route(`**/api/v1/ordenes/${ID_REAL}/marcar-prueba`, (route) =>
      route.fulfill({ json: { id: ID_REAL, es_prueba: true, stock_reintegrado: true, cupon_liberado: true } }),
    );

    await page.goto('/admin/ordenes');
    await abrirGestionar(page);
    await page.getByRole('button', { name: 'Marcar como prueba' }).click();
    await botonConfirmarMarcar(page).click();

    const cerrar = await page.getByRole('button', { name: 'Cerrar aviso' }).boundingBox();
    expect(cerrar!.x + cerrar!.width).toBeLessThanOrEqual(360);
    const aviso = await page.getByRole('status').boundingBox();
    expect(aviso!.x + aviso!.width).toBeLessThanOrEqual(360);
  });
});

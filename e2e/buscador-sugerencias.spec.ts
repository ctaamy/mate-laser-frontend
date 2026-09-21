import { test, expect, type Page } from '@playwright/test';

// Fase 1 (buscador funcional) + Fase 2 (autocompletado):
// - El término vive en la URL (?q=): el buscador del navbar navega a
//   /productos?q=… y la página lo lee, lo siembra en el input y filtra.
// - Mientras se tipea aparece un dropdown de sugerencias (GET
//   /productos/sugerencias?q=…); ↑/↓ + Enter navega al PDP, Esc cierra.
// - El <select> de orden escribe ?orden=… en la URL.

const PRODUCTOS = [
  { id: 'p1', nombre: 'Mate Imperial de Algarrobo', slug: 'mate-imperial', precio_base: 12000, disponible: true, cantidad_maxima: 5, apto_grabado: true, colores_disponibles: [], personalizado_habilitado: false, personalizado_max_chars: 30, activo: true, destacado: true, orden: 1, creado_en: new Date().toISOString(), imagenes_producto: [] },
  { id: 'p2', nombre: 'Mate Torpedo de Algarrobo', slug: 'mate-torpedo', precio_base: 9000, disponible: true, cantidad_maxima: 5, apto_grabado: false, colores_disponibles: [], personalizado_habilitado: false, personalizado_max_chars: 30, activo: true, destacado: false, orden: 2, creado_en: new Date().toISOString(), imagenes_producto: [] },
];

async function mockApi(page: Page) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (r) => r.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (r) => r.request().method() === 'GET' ? r.fulfill({ json: {} }) : r.continue());
  await page.route(/\/api\/v1\/categorias$/, (r) => r.fulfill({ json: [] }));

  // Un solo handler para todo /productos* — ramifica según la ruta. Se
  // registra al final para ganarle a cualquier patrón previo.
  await page.route(/\/api\/v1\/productos(\/|\?|$)/, (route) => {
    const url = new URL(route.request().url());
    const sp = url.searchParams;

    if (url.pathname.endsWith('/productos/sugerencias')) {
      const q = (sp.get('q') || '').toLowerCase();
      const items = PRODUCTOS
        .filter((p) => q.split(/\s+/).filter(Boolean).every((t) => p.nombre.toLowerCase().includes(t)))
        .map((p) => ({ nombre: p.nombre, slug: p.slug, imagen: null }));
      return route.fulfill({ json: items });
    }

    const slugMatch = url.pathname.match(/\/productos\/([a-z0-9-]+)$/);
    if (slugMatch) {
      const p = PRODUCTOS.find((x) => x.slug === slugMatch[1]) ?? PRODUCTOS[0];
      return route.fulfill({ json: { ...p, tipos_opcion: [], variantes_producto: [], resenas_producto: [] } });
    }

    // Listado del catálogo: filtra por search= y ordena por orden=.
    const search = (sp.get('search') || '').toLowerCase();
    let data = PRODUCTOS.filter((p) => !search || p.nombre.toLowerCase().includes(search));
    if (sp.get('orden') === 'precio_asc') data = [...data].sort((a, b) => a.precio_base - b.precio_base);
    return route.fulfill({ json: { data, total: data.length, page: 1, totalPages: 1 } });
  });
}

test.describe('Buscador — URL, filtro y sugerencias', () => {
  test.beforeEach(async ({ page }) => { await mockApi(page); });

  test('el buscador del navbar navega a /productos?q= y la página lo aplica', async ({ page }) => {
    await page.goto('/');
    const pill = page.getByPlaceholder('Buscar', { exact: true });
    await pill.fill('torpedo');
    await pill.press('Enter');

    await expect(page).toHaveURL(/\/productos\?q=torpedo/);
    await expect(page.getByPlaceholder('Buscar producto...')).toHaveValue('torpedo');
    await expect(page.getByText('Mate Torpedo de Algarrobo')).toBeVisible();
    await expect(page.getByText('Mate Imperial de Algarrobo')).toHaveCount(0);
  });

  test('entrar directo a /productos?q= siembra el input y filtra', async ({ page }) => {
    await page.goto('/productos?q=imperial');
    await expect(page.getByPlaceholder('Buscar producto...')).toHaveValue('imperial');
    await expect(page.getByText('Mate Imperial de Algarrobo')).toBeVisible();
    await expect(page.getByText('Mate Torpedo de Algarrobo')).toHaveCount(0);
  });

  test('el dropdown de sugerencias aparece al tipear y filtra por palabra (AND)', async ({ page }) => {
    await page.goto('/productos');
    const input = page.getByPlaceholder('Buscar producto...');
    // scope al listbox del buscador — el <select> de orden también tiene <option>s.
    const opciones = page.getByRole('listbox').getByRole('option');
    await input.fill('mate');
    await expect(opciones).toHaveCount(2);

    await input.fill('mate torp');
    // toHaveText con array = exactamente 1 opción y su texto matchea — atómico,
    // sin ventana de carrera entre el count y el contains mientras debouncea.
    await expect(opciones).toHaveText([/Torpedo/]);

    await input.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  // Regresión del "eco" de la URL. Tras una pausa de 300ms, Productos escribe
  // ?q= con replace; ese cambio vuelve por el router con prioridad baja
  // (startTransition), así que puede llegar cuando el usuario ya siguió tipeando.
  // Si se lo trata como navegación externa, pisa el input con el valor viejo
  // (se "comían" letras). Con la suite completa en 4 workers la ventana se abre
  // sola, pero con el spec solo casi nunca → el test de arriba pasaba 5/5.
  // Acá la ventana se fuerza sin depender de tiempos: apenas history.replaceState
  // escribe ?q=mate (y antes de que el router lo commitee) el "usuario" tipea.
  test('un tecleo entre la escritura de ?q= y su eco en el router no se pierde', async ({ page }) => {
    await page.addInitScript(() => {
      const replaceState = history.replaceState.bind(history);
      let tipeado = false;
      history.replaceState = (...args: Parameters<History['replaceState']>) => {
        replaceState(...args);
        if (!tipeado && String(args[2]).endsWith('?q=mate')) {
          tipeado = true;
          const el = document.querySelector<HTMLInputElement>('input[placeholder="Buscar producto..."]')!;
          // setter nativo + evento 'input': la forma en que React detecta un cambio en un input controlado.
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, 'mate torp');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
    });

    await page.goto('/productos');
    const input = page.getByPlaceholder('Buscar producto...');

    // El <title> pasa a "Búsqueda" en el mismo commit en que el router entrega
    // ?q=mate: es el eco. Se captura el valor del input en ESE instante, dentro
    // de la página — desde acá un poll llegaría tarde, cuando un ping-pong ya
    // pudo devolver el valor y taparía el bug.
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>('input[placeholder="Buscar producto..."]')!;
      new MutationObserver((_, obs) => {
        if (!document.title.startsWith('Búsqueda')) return;
        obs.disconnect();
        (window as unknown as { __valorAlEco: string }).__valorAlEco = el.value;
      }).observe(document.querySelector('title')!, { childList: true, characterData: true, subtree: true });
    });

    await input.fill('mate');
    // Cuando llega el eco el input debe seguir mostrando lo último que tipeó el usuario.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __valorAlEco?: string }).__valorAlEco))
      .toBe('mate torp');

    // Y converge: la URL alcanza lo tipeado, el input lo conserva y el catálogo filtra.
    await expect(page).toHaveURL(/[?&]q=mate(\+|%20)torp$/);
    await expect(input).toHaveValue('mate torp');
    await expect(page.getByText('Mate Imperial de Algarrobo')).toHaveCount(0);
    await expect(page.getByText('Mate Torpedo de Algarrobo').first()).toBeVisible();
  });

  // El anti-eco de Productos ignora solo los REPLACE (sus propias escrituras):
  // la navegación externa — PUSH del navbar, POP del botón "atrás" — tiene que
  // seguir reflejándose en el input.
  test('el botón atrás vuelve el input al término anterior', async ({ page }) => {
    await page.goto('/productos?q=imperial');
    const input = page.getByPlaceholder('Buscar producto...');
    await expect(input).toHaveValue('imperial');

    const pill = page.getByPlaceholder('Buscar', { exact: true });
    await pill.fill('torpedo');
    await pill.press('Enter');
    await expect(page).toHaveURL(/\/productos\?q=torpedo/);
    await expect(input).toHaveValue('torpedo');

    await page.goBack();
    await expect(page).toHaveURL(/\/productos\?q=imperial/);
    await expect(input).toHaveValue('imperial');
    await expect(page.getByText('Mate Imperial de Algarrobo')).toBeVisible();
    await expect(page.getByText('Mate Torpedo de Algarrobo')).toHaveCount(0);
  });

  test('↓ + Enter en una sugerencia navega al producto', async ({ page }) => {
    await page.goto('/productos');
    const input = page.getByPlaceholder('Buscar producto...');
    const opciones = page.getByRole('listbox').getByRole('option');
    await input.fill('imperial');
    await expect(opciones).toHaveCount(1);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/productos\/mate-imperial$/);
  });

  test('el orden se refleja en la URL', async ({ page }) => {
    await page.goto('/productos');
    await page.locator('select').selectOption('precio_asc');
    await expect(page).toHaveURL(/orden=precio_asc/);
  });
});

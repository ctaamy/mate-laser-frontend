import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Fase 3 del navbar como bloque: tipo de menú (Tradicional / Hamburguesa)
// para desktop/tablet, y nav_links migrado de clave suelta a datos.links
// (array editable con agregar/quitar/reordenar, mismo patrón que
// footer.links/footer.redes — ver EnlacesEditor en Configuracion.tsx).
//
// En mobile el menú SIEMPRE es hamburguesa sin importar la elección del
// admin (patrón estándar de ecommerce, evita que muchos links rompan el
// layout) — ver Navbar.tsx: el botón/panel de hamburguesa nunca se oculta
// por debajo del breakpoint md, solo se EXTIENDE a desktop si tipo_menu es
// 'hamburguesa'.

const NAVBAR_TRADICIONAL = {
  id: 'nav-1', tipo: 'navbar', activo: true, orden: -1,
  datos: {
    tipo_menu: 'tradicional',
    links: [
      { label: 'Productos', href: '/productos' },
      { label: 'Nosotros', href: '/#nosotros' },
    ],
  },
};

async function mockHomepage(page: import('@playwright/test').Page, seccionesIniciales: any[], onPut?: (body: any) => void) {
  await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => {
    if (route.request().method() === 'PUT') {
      onPut?.(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: seccionesIniciales });
  });
}

async function mockConfig(page: import('@playwright/test').Page, config: Record<string, any> = {}) {
  await page.route(/\/api\/v1\/configuracion\/estado-publicacion$/, (route) => route.fulfill({ json: { hayCambios: false } }));
  await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: config });
  });
}

test.describe('Admin — Tipo de menú del navbar', () => {
  test('cambiar a Hamburguesa se refleja al instante en el preview, sin escribir nada hasta "Guardar inicio"', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [NAVBAR_TRADICIONAL], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    // Acotado al mini-preview de NavbarCard (también existe el mismo texto
    // en el panel grande "Vista previa en vivo" — ambos deben reaccionar,
    // pero se verifica uno para no ambigüar el selector).
    const previewEditor = page.getByTestId('navbar-preview-editor');

    // Arranca en Tradicional: el preview muestra los links inline
    await expect(previewEditor.getByText('Productos', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Hamburguesa', exact: true }).click();

    // El preview cambia al instante (puro estado en memoria) — ya no muestra
    // los links inline, muestra el ícono de hamburguesa en su lugar. Se
    // verifica en AMBOS previews (mini-preview del editor y vista en vivo).
    await expect(previewEditor.getByText('Productos', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('navbar-preview-live').getByText('Productos', { exact: true })).toHaveCount(0);

    // Nada se escribió todavía: ni un PUT disparado por tipear/clickear.
    expect(putBody).toBeNull();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    expect(putBody).toBeTruthy();
    const navSec = (putBody.secciones as any[]).find((s) => s.tipo === 'navbar');
    expect(navSec.datos.tipo_menu).toBe('hamburguesa');
  });

  test('avisa (sin bloquear) cuando hay muchos links en modo Tradicional', async ({ page }) => {
    const muchosLinks = Array.from({ length: 8 }, (_, i) => ({ label: `Link ${i + 1}`, href: `/link-${i + 1}` }));
    await loginComoAdmin(page);
    await mockHomepage(page, [{ ...NAVBAR_TRADICIONAL, datos: { tipo_menu: 'tradicional', links: muchosLinks } }]);
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    await expect(page.getByText(/considerá Hamburguesa/i)).toBeVisible();
  });
});

test.describe('Admin — Links del navbar (agregar / quitar / reordenar)', () => {
  test('permite agregar, quitar y reordenar links, y persistirlos', async ({ page }) => {
    await loginComoAdmin(page);
    let putBody: any = null;
    await mockHomepage(page, [NAVBAR_TRADICIONAL], (body) => { putBody = body; });
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    // Dos niveles arriba: el título y el botón "Agregar" comparten la fila
    // de header; los inputs de cada link son hijos del card completo (un
    // nivel más arriba que esa fila).
    const seccionLinks = page.getByText('Links de navegación', { exact: true }).locator('..').locator('..');

    // Arranca con 2 links (Productos, Nosotros)
    await expect(seccionLinks.locator('input').first()).toHaveValue('Productos');

    // Agrega uno nuevo
    await seccionLinks.getByRole('button', { name: 'Agregar' }).click();
    const labelInputs = seccionLinks.locator('input').and(page.locator('[placeholder="Etiqueta"]'));
    await expect(labelInputs).toHaveCount(3);

    // Reordena: sube el segundo link ("Nosotros") una posición
    await seccionLinks.locator('button[aria-label="Mover arriba"]').nth(1).click();
    await expect(labelInputs.nth(0)).toHaveValue('Nosotros');
    await expect(labelInputs.nth(1)).toHaveValue('Productos');

    // Elimina el tercero (el recién agregado)
    await seccionLinks.locator('button[aria-label="Eliminar enlace"]').last().click();

    await page.getByRole('button', { name: 'Guardar inicio' }).click();
    await expect(page.getByText('¡Guardado correctamente!')).toBeVisible();

    const navSec = (putBody.secciones as any[]).find((s) => s.tipo === 'navbar');
    expect(navSec.datos.links).toHaveLength(2);
    expect(navSec.datos.links[0].label).toBe('Nosotros');
    expect(navSec.datos.links[1].label).toBe('Productos');
  });
});

test.describe('Sitio público — mobile siempre usa hamburguesa', () => {
  test('con tipo_menu "tradicional", en viewport mobile igual se muestra el botón de hamburguesa (no los links inline)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [NAVBAR_TRADICIONAL] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    const nav = page.locator('nav');
    // Los links inline (fila desktop) no ocupan espacio en mobile — siguen
    // en el DOM (oculto por CSS), no removidos, por eso se chequea viewport.
    await expect(nav.getByText('Productos', { exact: true })).not.toBeInViewport();

    // El botón de hamburguesa sí está disponible y funciona.
    await nav.locator('button').last().click();

    // El panel desplegable de mobile es un <nav> propio, separado del
    // principal (que sigue conteniendo el link "Productos" oculto por CSS
    // en su fila desktop) — se acota al último <nav> para no ambigüar.
    const panelMobile = page.locator('nav').last();
    await expect(panelMobile.getByText('Productos', { exact: true })).toBeVisible();
  });

  test('con tipo_menu "hamburguesa", en desktop también se usa el menú desplegable en vez de los links inline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
      route.fulfill({ json: [{ ...NAVBAR_TRADICIONAL, datos: { ...NAVBAR_TRADICIONAL.datos, tipo_menu: 'hamburguesa' } }] }),
    );
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

    await page.goto('/');

    // Sin los links inline visibles de entrada dentro del navbar (el footer
    // también tiene un link "Productos" por default — se acota a <nav>).
    const nav = page.locator('nav');
    await expect(nav.getByText('Productos', { exact: true })).toHaveCount(0);

    // ...pero el botón de menú (visible también en desktop en este modo) los despliega.
    await nav.locator('button').last().click();
    const panelMobile = page.locator('nav').last();
    await expect(panelMobile.getByText('Productos', { exact: true })).toBeVisible();
  });
});

// Fase 4: posición del ícono hamburguesa (izquierda/derecha) + estilo de
// desplegado como dropdown angosto anclado al mismo lado del ícono (no un
// overlay completo ni un drawer lateral).
test.describe('Admin — Posición del ícono hamburguesa', () => {
  test('cambiar la posición se refleja al instante en el mini-preview y en la vista previa en vivo', async ({ page }) => {
    await loginComoAdmin(page);
    await mockHomepage(page, [{ ...NAVBAR_TRADICIONAL, datos: { ...NAVBAR_TRADICIONAL.datos, tipo_menu: 'hamburguesa' } }]);
    await mockConfig(page);

    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar navbar' }).click();

    const hamburgerIcon = 'svg path[d="M3 6h18M3 12h18M3 18h18"]';

    for (const testid of ['navbar-preview-editor', 'navbar-preview-live']) {
      const preview = page.getByTestId(testid);
      const logo = preview.getByText('matelaser studio', { exact: true });

      // Default (recién migrado, sin elegir nada): derecha — ícono después del logo.
      let hb = (await preview.locator(hamburgerIcon).boundingBox())!;
      let lg = (await logo.boundingBox())!;
      expect(hb.x).toBeGreaterThan(lg.x);
    }

    await page.getByRole('button', { name: 'Izquierda', exact: true }).click();

    for (const testid of ['navbar-preview-editor', 'navbar-preview-live']) {
      const preview = page.getByTestId(testid);
      const logo = preview.getByText('matelaser studio', { exact: true });

      const hb = (await preview.locator(hamburgerIcon).boundingBox())!;
      const lg = (await logo.boundingBox())!;
      expect(hb.x).toBeLessThan(lg.x);
    }
  });
});

test.describe('Sitio público — posición del ícono y dropdown anclado', () => {
  for (const posicion of ['izquierda', 'derecha'] as const) {
    test(`tipo_menu hamburguesa + posición ${posicion}: ícono y dropdown se alinean del lado correcto (desktop)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
        route.fulfill({
          json: [{ ...NAVBAR_TRADICIONAL, datos: { ...NAVBAR_TRADICIONAL.datos, tipo_menu: 'hamburguesa', menu_posicion: posicion } }],
        }),
      );
      await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

      await page.goto('/');

      const nav = page.locator('nav').first();
      const hamburger = nav.getByLabel('Abrir menú');
      const navBox = (await nav.boundingBox())!;
      const hbBox = (await hamburger.boundingBox())!;
      const hbCentroX = hbBox.x + hbBox.width / 2;
      const navCentroX = navBox.x + navBox.width / 2;

      if (posicion === 'izquierda') expect(hbCentroX).toBeLessThan(navCentroX);
      else expect(hbCentroX).toBeGreaterThan(navCentroX);

      await hamburger.click();

      // El dropdown es angosto (no full-width) y anclado al mismo lado del ícono.
      const panel = page.locator('nav').last();
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.width).toBeLessThan(1280 * 0.9); // no cubre toda la pantalla

      if (posicion === 'izquierda') expect(panelBox.x).toBeLessThan(100);
      else expect(panelBox.x + panelBox.width).toBeGreaterThan(1280 - 100);

      await expect(panel.getByText('Productos', { exact: true })).toBeVisible();
    });
  }

  for (const posicion of ['izquierda', 'derecha'] as const) {
    test(`en mobile, con posición ${posicion} y tipo_menu tradicional, el menú sigue siendo hamburguesa y se despliega del lado correcto`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 700 });
      await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) =>
        route.fulfill({
          json: [{ ...NAVBAR_TRADICIONAL, datos: { ...NAVBAR_TRADICIONAL.datos, tipo_menu: 'tradicional', menu_posicion: posicion } }],
        }),
      );
      await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: {} }));

      await page.goto('/');

      const nav = page.locator('nav').first();
      const hamburger = nav.getByLabel('Abrir menú');
      await expect(hamburger).toBeVisible();

      const navBox = (await nav.boundingBox())!;
      const hbBox = (await hamburger.boundingBox())!;
      const hbCentroX = hbBox.x + hbBox.width / 2;
      const navCentroX = navBox.x + navBox.width / 2;

      if (posicion === 'izquierda') expect(hbCentroX).toBeLessThan(navCentroX);
      else expect(hbCentroX).toBeGreaterThan(navCentroX);

      await hamburger.click();
      const panel = page.locator('nav').last();
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.width).toBeLessThan(375 * 0.9);

      if (posicion === 'izquierda') expect(panelBox.x).toBeLessThan(50);
      else expect(panelBox.x + panelBox.width).toBeGreaterThan(375 - 50);

      await expect(panel.getByText('Productos', { exact: true })).toBeVisible();
    });
  }
});

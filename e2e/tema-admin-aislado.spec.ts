import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';

// Auditoría UX — punto 3: el panel admin no debe depender NUNCA del tema
// que el propio admin configura para sus clientes en el sitio público.
// useThemeGlobal() (App.tsx) sigue seteando --color-bg/--color-texto/
// --font-family-base en :root sin condicionar por ruta, pero ahora esas
// variables solo se consumen dentro de la clase ".tema-publico" (aplicada
// en la raíz de Layout.tsx) — index.css ya no las aplica al <body> global.
// Ver AdminLayout.tsx (colores propios, sin la clase) y los <h1>/<h2> y
// celdas clave de las 7 secciones admin (colores explícitos agregados).
//
// Nota: no se hardcodea el rgb exacto de "text-gray-900" en las
// aserciones del admin porque Tailwind v4 puede emitirlo en oklch()
// según el navegador/versión — lo que importa es que NO sea el magenta
// del tema público, no el valor exacto del gris.

const MAGENTA = 'rgb(255, 0, 255)';

const TEMA_EXTREMO = {
  tema_bg_color: '#00ffff',   // cian
  tema_texto_color: '#ff00ff', // magenta
  tema_font_family: 'Georgia, serif',
};

test.describe('Aislamiento del tema público respecto del panel admin', () => {
  test('el sitio público SÍ aplica el tema configurado (control, confirma que el mock funciona)', async ({ page }) => {
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: TEMA_EXTREMO }));

    await page.goto('/');

    // El tema se aplica en la raíz del layout público (clase "tema-publico"),
    // no en el <body> — ver Layout.tsx e index.css.
    await expect(page.locator('.tema-publico')).toHaveCSS('color', MAGENTA);
  });

  test('el panel admin NO hereda el tema público (texto/tipografía quedan con los valores propios del admin)', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: TEMA_EXTREMO }));
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('/admin');

    await expect(page.locator('body')).not.toHaveCSS('color', MAGENTA);
    await expect(page.locator('.tema-publico')).toHaveCount(0);

    const titulo = page.getByRole('heading', { name: 'Dashboard' });
    await expect(titulo).toBeVisible();
    await expect(titulo).not.toHaveCSS('color', MAGENTA);
    await expect(titulo).not.toHaveCSS('font-family', /Georgia/);
  });

  test('navegar del sitio público al admin por routing del cliente (sin recarga completa) tampoco filtra el tema', async ({ page }) => {
    await loginComoAdmin(page);
    await page.route(/\/api\/v1\/configuracion\/homepage(\/borrador)?$/, (route) => route.fulfill({ json: [] }));
    await page.route(/\/api\/v1\/configuracion(\/borrador)?$/, (route) => route.fulfill({ json: TEMA_EXTREMO }));
    await page.route('**/api/v1/ordenes?**', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/v1/productos/admin/todos**', (route) => route.fulfill({ json: { data: [] } }));

    // Arranca en el sitio público (aplica el tema) y navega al admin
    // clickeando el link "Panel admin" del dropdown de usuario — navegación
    // client-side de React Router, SIN recarga completa. Esto es justamente
    // el caso que un fix a nivel de mount/unmount de useThemeGlobal() (en
    // vez de scoping por CSS) podría dejar roto: las variables de :root
    // quedarían "pegadas" al último valor del tema público.
    await page.goto('/');
    await expect(page.locator('.tema-publico')).toHaveCSS('color', MAGENTA);

    await page.getByRole('button', { name: 'Cuenta' }).click();
    await page.getByText('Panel admin', { exact: true }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toHaveCSS('color', MAGENTA);
  });
});

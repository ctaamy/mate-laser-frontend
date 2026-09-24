import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { mockCaja, mov } from './fixtures-caja';

// "Caja y compras" en el celu: la carga desde el celu, en el momento, es un
// requisito (no un extra). Se prueba a 360 px, el ancho de un Android chico.
// El proyecto `chromium` del CI corre este archivo tal cual.

test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

const sinScrollHorizontal = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Caja a 360 px', () => {
  test('Resumen: sin scroll horizontal, con los grupos por titular cerrados y el botón flotante a mano', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja');

    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    expect(await sinScrollHorizontal(page)).toBe(true);

    // Una pantalla sin scroll: el grupo de un titular con varias cuentas arranca cerrado y se abre con un toque.
    const grupoFacu = page.getByTestId('grupo-titular').filter({ hasText: 'Banco Facu' });
    const detalles = grupoFacu.locator('details');
    expect(await detalles.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
    await grupoFacu.locator('summary').click();
    expect(await detalles.evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);

    await expect(page.getByTestId('fab-gasto')).toBeVisible();
    // El "+ Gasto" del encabezado es de escritorio: en el celu queda solo el flotante y los botones del Resumen.
    await expect(page.getByRole('button', { name: 'Gasto' })).toHaveCount(2);
  });

  test('el botón flotante abre la hoja pegada abajo, con Guardar a la vista sin scrollear', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja');

    await page.getByTestId('fab-gasto').click();
    const hoja = page.getByRole('dialog', { name: 'Nuevo gasto' });
    await expect(hoja).toBeVisible();

    const caja = await hoja.boundingBox();
    expect(caja).not.toBeNull();
    // Anclada al borde inferior y a todo el ancho, como una hoja del celu.
    expect(Math.round(caja!.y + caja!.height)).toBe(740);
    expect(Math.round(caja!.width)).toBe(360);

    const guardar = await hoja.getByRole('button', { name: 'Guardar', exact: true }).boundingBox();
    expect(guardar).not.toBeNull();
    expect(guardar!.y).toBeGreaterThanOrEqual(0);
    expect(guardar!.y + guardar!.height).toBeLessThanOrEqual(740);
    expect(guardar!.height).toBeGreaterThanOrEqual(36);
    expect(await sinScrollHorizontal(page)).toBe(true);
  });

  test('cargar un gasto completo con el pulgar: chips grandes, monto numérico, y se guarda', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    const hoja = page.getByRole('dialog', { name: 'Nuevo gasto' });

    await expect(hoja.getByLabel('Monto')).toHaveAttribute('inputmode', 'decimal');
    for (const chip of await hoja.getByRole('radio').all()) {
      const b = await chip.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(40); // objetivo táctil mínimo
    }

    await hoja.getByLabel('Monto').fill('2500');
    await hoja.getByRole('radio', { name: 'Insumos' }).click();
    await hoja.getByRole('radio', { name: 'Efectivo' }).click();
    await hoja.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect.poll(() => cap.movimientos.length).toBe(1);
    expect(cap.movimientos[0]).toMatchObject({ tipo: 'gasto', cuenta_id: 'c-efectivo', monto: 2500, categoria: 'insumos' });
    await expect(hoja).toHaveCount(0);
  });

  test('con la hoja abierta la página de atrás no se mueve', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja?nuevo=gasto');
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByRole('dialog', { name: 'Nuevo gasto' })).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('Movimientos: tarjetas sin scroll horizontal, con un textos largo incluido', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, {
      movimientos: [
        mov({ id: 'm-a', nota: 'Compra de insumos muy larga para ver cómo se comporta el texto en una pantalla angosta sin romper el diseño' }),
        mov({ id: 'm-b', monto: -1234567.5, cuenta: { id: 'c-mp', nombre: 'Mercado Pago (Facu)', tipo: 'mercadopago', titular: 'Facu' } }),
      ],
    });
    await page.goto('/admin/caja/movimientos');
    await expect(page.getByTestId('movimiento-caja')).toHaveCount(2);
    expect(await sinScrollHorizontal(page)).toBe(true);
    await expect(page.getByTestId('movimiento-caja').nth(1)).toContainText('−$1.234.567,50');

    // Las pestañas y los filtros entran en el ancho.
    await expect(page.getByRole('link', { name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salidas' })).toBeVisible();
  });

  test('Contar la caja y pasar plata funcionan en la hoja del celu', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=arqueo');
    const hoja = page.getByRole('dialog', { name: 'Contar la caja' });
    await hoja.getByLabel('¿Cuánto hay?').fill('4980');
    await hoja.getByRole('button', { name: 'Ver la diferencia' }).click();
    await expect(hoja.getByText('Faltan $20')).toBeVisible();
    await hoja.getByRole('button', { name: 'Anotar la diferencia' }).click();
    await expect.poll(() => cap.arqueos.length).toBe(2);
    expect(await sinScrollHorizontal(page)).toBe(true);
  });
});

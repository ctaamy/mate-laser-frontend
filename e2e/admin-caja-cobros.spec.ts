import { test, expect } from '@playwright/test';
import { loginComoAdmin } from './fixtures-admin';
import { mockCaja } from './fixtures-caja';

// "Caja y compras" (Fase 2): los cobros entran solos a la caja. La pantalla los
// pide al abrirse y con "Actualizar", muestra la plata que Mercado Pago todavía
// no libera y avisa cuando un cobro no se pudo ubicar en ninguna cuenta.
// El backend está simulado (ver fixtures-caja.ts).

const sinCuenta = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    pago_id: `p-${i}`,
    orden_id: `o-${i}`,
    proveedor: 'efectivo',
    monto: 2500,
    pagado_en: new Date().toISOString(),
  }));

test.describe('Caja — cobros automáticos', () => {
  test('al abrir sincroniza una vez; "Actualizar" lo repite forzado', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);

    await page.goto('/admin/caja');
    await expect(page.getByTestId('total-negocio')).toBeVisible();
    await expect.poll(() => cap.sincronizaciones.length).toBe(1);
    // Sin cuerpo: con "null" como JSON el backend real responde 400 (lo detectó la corrida con backend real).
    expect(cap.sincronizaciones[0]).toEqual({ forzar: false, cuerpo: null });

    // Cambiar de pestaña y volver no vuelve a sincronizar: el hub se monta una sola vez.
    await page.getByRole('link', { name: 'Movimientos' }).click();
    await page.getByRole('link', { name: 'Resumen' }).click();
    expect(cap.sincronizaciones).toHaveLength(1);

    await page.getByRole('button', { name: 'Actualizar cobros' }).click();
    await expect.poll(() => cap.sincronizaciones.length).toBe(2);
    expect(cap.sincronizaciones[1]).toEqual({ forzar: true, cuerpo: null });
  });

  test('la plata disponible descuenta lo que Mercado Pago todavía no libera, y lo explica', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { aLiberar: 4000 });

    await page.goto('/admin/caja');

    // Las cuentas suman 130.500 (los 4.000 de MP ya están ahí, pero MP todavía no los libera): se pueden usar 126.500.
    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    await expect(page.getByTestId('a-liberar')).toContainText('$4.000');
    await expect(page.getByTestId('a-liberar')).toContainText('todavía no se libera');
    // La cuenta de Mercado Pago muestra su saldo completo y aclara cuánto está por liberarse.
    const facu = page.getByTestId('grupo-titular').filter({ hasText: 'Mercado Pago (Facu)' });
    await expect(facu).toContainText('incluye $4.000 a liberar');
  });

  test('sin plata a liberar no aparece el aviso', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja');
    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    await expect(page.getByTestId('a-liberar')).toHaveCount(0);
    await expect(page.getByTestId('cobros-sin-cuenta')).toHaveCount(0);
  });

  test('si hay cobros sin cuenta lo avisa, y "Elegir cuentas" abre Mis cuentas', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { sync: { sin_cuenta: sinCuenta(2) } });

    await page.goto('/admin/caja');

    const aviso = page.getByTestId('cobros-sin-cuenta');
    await expect(aviso).toContainText('Hay 2 cobros ($5.000)');
    await expect(aviso).toContainText('no sabemos en qué cuenta entró');
    await aviso.getByRole('button', { name: 'Elegir cuentas' }).click();
    await expect(page.getByRole('dialog', { name: 'Mis cuentas' })).toBeVisible();
  });

  test('un error al sincronizar avisa sin romper el Resumen', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.route('**/api/v1/caja/sincronizar**', (r) => r.fulfill({ status: 500, json: { message: 'boom' } }));

    await page.goto('/admin/caja');

    await expect(page.getByTestId('total-negocio')).toHaveText('$126.500');
    await expect(page.getByText('No pudimos actualizar los cobros ahora')).toBeVisible();
  });
});

test.describe('Caja — qué cuenta recibe qué', () => {
  test('Mis cuentas muestra cuál recibe cada cosa, y solo ofrece lo que corresponde a cada tipo', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page);
    await page.goto('/admin/caja?nuevo=cuentas');

    const hoja = page.getByRole('dialog', { name: 'Mis cuentas' });
    const fila = (nombre: string) => hoja.getByTestId('fila-cuenta').filter({ hasText: nombre });

    await expect(fila('Banco Tami').getByTestId('cuenta-recibe')).toHaveText('Recibe las transferencias de la web');
    await expect(fila('Efectivo').getByTestId('cuenta-recibe')).toHaveText('Recibe el efectivo de las ventas');
    await expect(fila('Banco Facu').getByTestId('cuenta-recibe')).toHaveCount(0);

    // Banco: ofrece transferencias. Efectivo: ofrece el efectivo de las ventas. Mercado Pago: nada (ya recibe los pagos de MP).
    await fila('Banco Facu').getByRole('button', { name: 'Editar' }).click();
    await expect(hoja.getByLabel('Esta cuenta recibe').locator('option')).toHaveText(['Nada en especial', 'Las transferencias de la web']);
    await hoja.getByRole('button', { name: 'Cancelar' }).click(); // en edición el nombre queda en un input: la fila ya no se encuentra por texto

    await fila('Efectivo').getByRole('button', { name: 'Editar' }).click();
    await expect(hoja.getByLabel('Esta cuenta recibe').locator('option')).toHaveText(['Nada en especial', 'El efectivo de las ventas']);
    await hoja.getByRole('button', { name: 'Cancelar' }).click();

    await fila('Mercado Pago (Facu)').getByRole('button', { name: 'Editar' }).click();
    await expect(hoja.getByLabel('Esta cuenta recibe')).toHaveCount(0);
  });

  test('elegir la cuenta manda `recibe` y vuelve a sincronizar forzado (así se anotan los cobros que estaban esperando)', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=cuentas');

    const hoja = page.getByRole('dialog', { name: 'Mis cuentas' });
    await hoja.getByTestId('fila-cuenta').filter({ hasText: 'Banco Facu' }).getByRole('button', { name: 'Editar' }).click();
    await hoja.getByLabel('Esta cuenta recibe').selectOption('transferencias_web');
    const antes = cap.sincronizaciones.length;
    await hoja.getByRole('button', { name: 'Guardar' }).click();

    await expect.poll(() => cap.cuentasActualizadas.length).toBe(1);
    expect(cap.cuentasActualizadas[0].id).toBe('c-banco-facu');
    expect(cap.cuentasActualizadas[0].body).toMatchObject({ recibe: 'transferencias_web' });
    await expect.poll(() => cap.sincronizaciones.length).toBeGreaterThan(antes);
    expect(cap.sincronizaciones.at(-1)).toEqual({ forzar: true, cuerpo: null });
  });

  test('editar solo el nombre no toca `recibe` ni vuelve a sincronizar', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page);
    await page.goto('/admin/caja?nuevo=cuentas');

    const hoja = page.getByRole('dialog', { name: 'Mis cuentas' });
    await hoja.getByTestId('fila-cuenta').filter({ hasText: 'Banco Facu' }).getByRole('button', { name: 'Editar' }).click();
    await hoja.getByLabel('Alias (opcional)').fill('facu.mp');
    const antes = cap.sincronizaciones.length;
    await hoja.getByRole('button', { name: 'Guardar' }).click();

    await expect.poll(() => cap.cuentasActualizadas.length).toBe(1);
    expect(Object.keys(cap.cuentasActualizadas[0].body)).not.toContain('recibe');
    expect(cap.sincronizaciones).toHaveLength(antes);
  });

  test('paso inicial: elegir la cuenta que recibe las transferencias de la web la manda en el setup', async ({ page }) => {
    await loginComoAdmin(page);
    const cap = await mockCaja(page, { configurada: false });
    await page.goto('/admin/caja');

    await page.getByLabel('¿A qué cuenta llegan las transferencias de los pedidos de la web?').selectOption({ label: 'Banco' });
    await page.getByRole('button', { name: 'Empezar' }).click();

    await expect.poll(() => cap.setups.length).toBe(1);
    const cuentas = (cap.setups[0] as { cuentas: { nombre: string; recibe?: string }[] }).cuentas;
    expect(cuentas.find((c) => c.nombre === 'Banco')?.recibe).toBe('transferencias_web');
    expect(cuentas.filter((c) => c.recibe)).toHaveLength(1);
  });
});

test.describe('Caja — cobros a 360 px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('Resumen con plata a liberar y cobros sin cuenta: sin scroll horizontal, con Actualizar a mano', async ({ page }) => {
    await loginComoAdmin(page);
    await mockCaja(page, { aLiberar: 1234567.5, sync: { sin_cuenta: sinCuenta(3) } });
    await page.goto('/admin/caja');

    await expect(page.getByTestId('a-liberar')).toBeVisible();
    await expect(page.getByTestId('cobros-sin-cuenta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar cobros' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

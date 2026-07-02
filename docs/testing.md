# Testing E2E/UI con Playwright

Tests de UI (funcional + visual) para el frontend, en paralelo al testing de
backend documentado en `qa/`. Corren contra un backend **mockeado** vía
`page.route` (no Postgres real) — mismo patrón en todos los specs.

```
e2e/
  fixtures.ts                        mocks: producto + checkout + Mercado Pago
  fixtures-admin.ts                  mocks: auth admin + productos admin
  personalizacion.spec.ts            funcional
  checkout.spec.ts                   funcional (resultado de pago: aprobado/rechazado)
  checkout-pasos.spec.ts             funcional (pasos visibles/clickeables)
  admin-productos.spec.ts            funcional (incluye el bug de "Guardar")
  visual/
    *.visual.spec.ts                 regresión visual
    baseline/                        screenshots baseline (se commitean)
```

`playwright.config.ts` define dos projects para poder correrlos por separado:
`chromium` (todo `e2e/` excepto `visual/`) y `visual` (solo `e2e/visual/`).

## 1. Correr los tests

```bash
npm run test:e2e             # funcionales, rápidos, para cada PR
npm run test:visual          # regresión visual, contra el baseline commiteado
npx playwright test          # todo junto (funcional + visual)
npx playwright show-report   # ver el último reporte con traces/screenshots
```

`test:e2e` no debería fallar por temas visuales — si falla, es un bug real
(elemento que no aparece, flujo que no se completa, error de consola).

## 2. Un test visual falló — ¿bug real o cambio intencional?

Cuando `npm run test:visual` falla, Playwright deja tres imágenes en
`test-results/<nombre-del-test>/`:

- `*-expected.png` → el baseline commiteado
- `*-actual.png` → lo que se renderizó ahora
- `*-diff.png` → el diff resaltado en rojo

Miralas (`npx playwright show-report` es más cómodo que buscar los PNG a
mano) y preguntate:

- **¿El diff está en una zona que no tocaste?** (ej. cambiaste el checkout y
  el diff aparece en el admin) → probablemente un flake, no un bug. Volvé a
  correr el test antes de asumir nada.
- **¿El diff refleja un cambio que SÍ hiciste a propósito** (moviste un
  botón, cambiaste un color, agregaste un campo)? → cambio intencional,
  actualizá el baseline (paso 3).
- **¿El diff muestra algo que no debería haber cambiado** (un layout roto,
  un elemento que desapareció, texto pisado)? → bug real. No actualices el
  baseline; arreglá el código y volvé a correr el test para confirmar que
  vuelve a matchear el baseline viejo.

Ante la duda, el baseline es la fuente de verdad de "cómo se ve hoy en
producción" — actualizarlo sin estar seguro de que el cambio es intencional
equivale a aprobar una regresión sin darte cuenta.

## 3. Actualizar el baseline (cambio intencional)

```bash
npm run test:visual:update
```

Esto regenera **todos** los PNG en `e2e/visual/baseline/`. Revisá el diff de
git de esos PNG antes de commitear — si se regeneraron imágenes que no
esperabas tocar, algo más cambió de lo que pensás (revisá el punto 2 de
nuevo).

Para actualizar solo un archivo de test puntual:

```bash
npx playwright test e2e/visual/checkout.visual.spec.ts --project=visual --update-snapshots
```

## 4. Decisiones de estabilización (replicar en tests nuevos)

Los tests visuales son inherentemente más frágiles que los funcionales.
Estas cuatro decisiones aparecieron porque los primeros intentos daban
falsos positivos random. Si agregás un test visual nuevo, aplicá el mismo
patrón desde el principio en vez de descubrirlo de nuevo por las malas:

### a. Enmascarar inputs de texto con contenido dinámico

El cursor/caret de un `<input>` con foco puede quedar en distinta posición
de render entre corridas (parpadeo) y genera diffs de pocos píxeles que no
son un bug real. Usá la opción `mask` de `toHaveScreenshot`:

```ts
const inputTexto = page.getByPlaceholder('...');
await expect(locator).toHaveScreenshot('nombre.png', { mask: [inputTexto] });
```

También ayuda sacar el foco del input antes del screenshot
(`await page.locator('h1').first().focus()`) para evitar el caret parpadeante.

### b. Esperar a que terminen las animaciones de framer-motion

Playwright congela animaciones **CSS** automáticamente antes de un
screenshot, pero las animaciones de `framer-motion` (como el panel que se
expande al activar "Grabado personalizado", `transition={{ duration: 0.22 }}`
en `ProductoDetalle.tsx`) corren vía JS/inline styles y no se detectan.
Agregá un `waitForTimeout` un poco mayor a la duración de la transición:

```ts
await page.waitForTimeout(300); // la transición dura 220ms
```

### c. Limpiar `localStorage` antes de cada test visual

El carrito (`carrito-storage`) y el auth (`auth-storage-v2`) persisten en
`localStorage` vía `zustand/persist`. Si un test deja algo en el carrito, el
próximo test puede arrancar con el badge del header mostrando "1 producto" y
correr todo el layout — un falso positivo que no tiene nada que ver con lo
que ese test valida. Limpiá el storage al principio de cada test:

```ts
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  // ...mocks de rutas...
});
```

(No hace falta en los tests de admin, porque ahí sembramos `auth-storage-v2`
a propósito para simular el login — ver `fixtures-admin.ts`.)

### d. Acotar el screenshot al componente, no a toda la página

`expect(page).toHaveScreenshot(...)` captura el header, nav y cualquier
estado global (carrito, toasts) que no tiene relación con lo que el test
está verificando. Preferí escrutar la región relevante con un locator:

```ts
const panelInfo = (page: Page) =>
  page.locator('h1').first().locator('xpath=ancestor::div[contains(@class,"flex-col") and contains(@class,"gap-7")]');

await expect(panelInfo(page)).toHaveScreenshot('inicial.png');
```

Esto reduce la superficie de flake y hace que el diff, cuando aparece, sea
sobre el componente que realmente te importa (no un pixel perdido en el
header).

## Notas

- `maxDiffPixelRatio: 0.02` está configurado globalmente en
  `playwright.config.ts` — tolera diferencias mínimas de antialiasing sin
  esconder regresiones reales.
- Los tests contra Mercado Pago (`checkout.spec.ts`, `checkout-pasos.spec.ts`)
  mockean el SDK real (`sdk.mercadopago.com`); pueden aparecer errores de
  consola `ERR_CONNECTION_REFUSED` de recursos de analytics/fraude del SDK
  real que no están mockeados — se filtran explícitamente en los asserts de
  "sin errores de consola" porque no son parte de la lógica de la app.

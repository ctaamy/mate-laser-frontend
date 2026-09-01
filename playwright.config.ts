import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  snapshotPathTemplate: '{testDir}/visual/baseline/{testFilePath}/{arg}{ext}',
  projects: [
    // El smoke test post-deploy (e2e/smoke/) corre aparte, con
    // playwright.smoke.config.ts, contra el frontend ya deployado — nunca
    // acá, que levanta el dev server local.
    { name: 'chromium', testIgnore: ['**/visual/**', '**/smoke/**'], use: { ...devices['Desktop Chrome'] } },
    { name: 'visual', testMatch: '**/visual/**', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    // Pago.tsx no monta el Brick de MP si falta VITE_MP_PUBLIC_KEY (o si
    // arranca con "TEST-XXX", nuestro placeholder de docs). Sin esta env
    // var el componente corta antes de llamar bricks().create(...), por
    // lo que window.__mpBrickSettings nunca se setea y los tests de
    // checkout.spec.ts / pago-no-preferencia-mp.spec.ts cuelgan 30s en
    // waitForFunction. El SDK real está mockeado (ver e2e/fixtures.ts),
    // así que cualquier public key con formato válido alcanza.
    env: {
      VITE_MP_PUBLIC_KEY: 'TEST-e2e-fake-public-key',
    },
  },
});

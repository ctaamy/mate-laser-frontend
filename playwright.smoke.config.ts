import { defineConfig, devices } from '@playwright/test';

// Config del smoke test post-deploy (ver e2e/smoke/).
//
// A diferencia de playwright.config.ts NO levanta webServer: corre contra un
// frontend YA deployado, cuya URL llega en SMOKE_BASE_URL. Se dispara desde
// .github/workflows/deploy.yml, después del `flyctl deploy` del frontend.
//
// Uso local:  SMOKE_BASE_URL=https://mate-laser-frontend.fly.dev npm run test:smoke

const baseURL = process.env.SMOKE_BASE_URL;
if (!baseURL) {
  throw new Error(
    'SMOKE_BASE_URL no seteada — es la URL del frontend deployado a chequear ' +
      '(ej. https://mate-laser-frontend.fly.dev)',
  );
}

export default defineConfig({
  testDir: './e2e/smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // El SDK de MP y su infra a veces tardan; un retry evita rojos por red.
  retries: 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 90_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

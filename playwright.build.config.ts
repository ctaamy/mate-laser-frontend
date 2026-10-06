import { defineConfig, devices } from '@playwright/test';

// Verificación contra el BUILD de producción (minificado, con chunks y hash), servido
// con `serve` y las mismas cabeceras que en Fly. Los e2e normales (playwright.config.ts)
// corren contra el dev server de Vite, donde no existen los chunks: no pueden ver un
// chunk que falta, la caché de assets ni un error que solo aparece al minificar.
//
//   npm run test:build
export default defineConfig({
  testDir: './e2e-build',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'build', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx serve -s dist -l 4173 --no-request-logging',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
    // Mismo motivo que en playwright.config.ts: sin una public key con formato válido
    // Pago.tsx no monta el Brick (el SDK real está mockeado en e2e/fixtures.ts).
    // VITE_API_URL: la CSP de producción (public/serve.json) solo deja conectar a la
    // API real, así que el build usa esa URL; las requests las interceptan los mocks.
    env: {
      VITE_MP_PUBLIC_KEY: 'TEST-e2e-fake-public-key',
      VITE_API_URL: 'https://api.matelaserstudio.com.ar/api/v1',
    },
  },
});

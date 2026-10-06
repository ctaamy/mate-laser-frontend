import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Preconnect al origen de la API: el navegador abre la conexión (DNS + TLS) en
// paralelo mientras baja el JS, en vez de recién cuando la app hace la primera
// request. VITE_API_URL se hornea en el build (ver Dockerfile), así que el link
// se agrega acá y no a mano en index.html. Sin la variable (dev, tests) no se
// agrega nada. `crossorigin`: las requests a la API son CORS, que usan otro pool
// de conexiones que un preconnect sin ese atributo.
function preconnectApi(apiUrl: string | undefined): Plugin {
  return {
    name: 'mls-preconnect-api',
    transformIndexHtml() {
      if (!apiUrl) return []
      try {
        const { origin } = new URL(apiUrl)
        return [{ tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head-prepend' as const }]
      } catch {
        return []
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
      react(),
      tailwindcss(),
      preconnectApi(env.VITE_API_URL),
    ],
  }
})

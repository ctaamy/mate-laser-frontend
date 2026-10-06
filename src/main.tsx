import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'
import { recargarPorChunkFaltante } from './lib/cargaDeRutas'

initAnalytics()

// Vite avisa con este evento cuando falla la precarga de un chunk (típico: la app
// quedó abierta de antes de un deploy y el archivo con hash ya no existe). Se
// recarga una vez para traer el index.html nuevo; si ya se recargó hace poco no se
// previene el error y lo muestra el límite de ruta, así no hay loop de recargas.
window.addEventListener('vite:preloadError', (evento) => {
  if (recargarPorChunkFaltante()) evento.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

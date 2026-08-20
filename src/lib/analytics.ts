// Analítica de visitas — Umami Cloud (cookie-less, sin banner de consentimiento
// necesario). Se inyecta el script SOLO en producción y solo si el ID está
// configurado — así el tráfico de dev/localhost y de otros entornos (staging,
// si algún día existe) nunca ensucia las métricas reales del sitio.
export function initAnalytics() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!import.meta.env.PROD || !websiteId) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://cloud.umami.is/script.js';
  script.setAttribute('data-website-id', websiteId);
  document.head.appendChild(script);
}

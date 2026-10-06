import { useEffect } from 'react';
import { useConfiguracion } from './useConfiguracion';
import { jsonLdOrganizacion } from '../lib/seo';
import { useHomepageSecciones } from './useHomepageSecciones';
import { upsertJsonLd } from './usePageMeta';

// Mantiene al día el JSON-LD "Organization" con lo que el negocio carga en el
// admin: config de la tienda (nombre, descripción, teléfono de WhatsApp) y el
// footer del page builder (redes, y mail/teléfono si los completa). Si cambian
// ahí, cambian solos acá — sin tocar código ni redeployar.
//
// Reusa las mismas queries que Navbar/Footer/PaginaEstatica (misma key → una
// sola request). Hasta que ambas respondan queda el valor base de index.html.
// Va en Layout: el sitio público lo tiene montado siempre.
export function useOrganizacionSeo() {
  const { data: config } = useConfiguracion();
  const { data: secciones } = useHomepageSecciones();

  const footer = secciones?.find((s) => s.tipo === 'footer')?.datos;
  const clave = config && secciones ? JSON.stringify(jsonLdOrganizacion({ config, footer })) : '';

  useEffect(() => {
    if (!clave) return;
    return upsertJsonLd('organizacion', [JSON.parse(clave)]);
  }, [clave]);
}

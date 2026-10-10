import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface PaginaContenido {
  titulo: string | null;
  markdown: string | null;
  contenido: unknown;
}

// Contenido publicado de una página (/terminos, /nosotros…). Vive en su propio
// endpoint: dentro de GET /configuracion eran ~34 kB de los 46 kB que bajaban
// todos los visitantes en cada carga, aunque solo se usan al abrir la página.
export function usePaginaContenido(slug: string) {
  return useQuery<PaginaContenido>({
    queryKey: ['configuracion', 'pagina', slug],
    queryFn: () => api.get(`/configuracion/pagina/${slug}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

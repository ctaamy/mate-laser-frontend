import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useConfiguracion(estado: 'publicado' | 'borrador' = 'publicado') {
  const url = estado === 'borrador' ? '/configuracion/borrador' : '/configuracion';
  return useQuery<Record<string, any>>({
    queryKey: ['configuracion', estado],
    queryFn: () => api.get(url).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

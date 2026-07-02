import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useConfiguracion() {
  return useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

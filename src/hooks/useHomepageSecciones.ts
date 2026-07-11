import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface Seccion {
  id: string;
  tipo: string;
  activo: boolean;
  orden: number;
  datos: Record<string, any>;
}

export function useHomepageSecciones(estado: 'publicado' | 'borrador' = 'publicado') {
  const url = estado === 'borrador' ? '/configuracion/homepage/borrador' : '/configuracion/homepage';
  return useQuery<Seccion[]>({
    queryKey: ['homepage', estado],
    queryFn: () => api.get(url).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

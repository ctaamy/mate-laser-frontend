import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

export interface Sugerencia {
  nombre: string;
  slug: string;
  imagen: string | null;
}

/**
 * Sugerencias para el dropdown del buscador. Debouncea el término (150ms) y
 * pega a GET /productos/sugerencias?q=. `enabled` deja apagar la query cuando
 * el dropdown está cerrado. `keepPreviousData` evita el parpadeo entre teclas.
 */
export function useSugerencias(termino: string, enabled = true) {
  const q = useDebouncedValue(termino.trim(), 150);
  const activa = enabled && q.length >= 1;

  const { data, isFetching } = useQuery<Sugerencia[]>({
    queryKey: ['sugerencias', q],
    queryFn: () =>
      api.get('/productos/sugerencias', { params: { q } }).then((r) => r.data),
    enabled: activa,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  return {
    sugerencias: activa ? data ?? [] : [],
    isFetching: activa && isFetching,
    termino: q,
  };
}

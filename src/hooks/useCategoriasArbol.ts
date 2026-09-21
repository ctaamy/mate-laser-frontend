import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { construirArbol, type ArbolCategorias } from '../lib/categoriasArbol';
import type { Categoria } from '../types';

// Fuente única del árbol de categorías para navbar, menú mobile y sidebar del
// catálogo (misma queryKey ['categorias'] que el resto del sitio → una sola
// request cacheada).
export function useCategoriasArbol(opts: { ocultarVacias?: boolean; seleccionadaId?: number | null } = {}) {
  const query = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });
  const { ocultarVacias, seleccionadaId } = opts;
  const arbol: ArbolCategorias = useMemo(
    () => construirArbol(query.data, { ocultarVacias, seleccionadaId }),
    [query.data, ocultarVacias, seleccionadaId],
  );
  return { ...arbol, isLoading: query.isLoading };
}

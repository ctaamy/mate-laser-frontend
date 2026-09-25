import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { CuentaCaja, ListaMovimientos, MovimientoCaja, ResultadoArqueo, SaldosCaja } from '../lib/caja';

// Todo lo de caja cuelga de ['caja', ...]: una operación exitosa invalida el
// árbol entero (saldos, listas y cuentas cambian juntos).
const RAIZ = ['caja'] as const;

export interface FiltrosMovimientos {
  cuenta_id?: string;
  tipo?: 'entrada' | 'salida';
  categoria?: string;
}

export function useSaldos() {
  return useQuery({
    queryKey: [...RAIZ, 'saldos'],
    queryFn: () => api.get<SaldosCaja>('/caja/saldos').then((r) => r.data),
  });
}

export function useCuentas(archivadas = false) {
  return useQuery({
    queryKey: [...RAIZ, 'cuentas', archivadas],
    queryFn: () =>
      api.get<CuentaCaja[]>('/caja/cuentas', { params: archivadas ? { archivadas: true } : undefined }).then((r) => r.data),
  });
}

/** Lista por cursor (nunca por página: dos personas cargan a la vez). */
export function useMovimientos(filtros: FiltrosMovimientos, limit = 30) {
  return useInfiniteQuery({
    queryKey: [...RAIZ, 'movimientos', filtros, limit],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<ListaMovimientos>('/caja/movimientos', { params: { ...filtros, limit, cursor: pageParam } })
        .then((r) => r.data),
    getNextPageParam: (ultima) => ultima.next_cursor ?? undefined,
  });
}

export interface NuevoMovimiento {
  tipo: 'gasto' | 'ingreso';
  cuenta_id: string;
  monto: number;
  categoria: string;
  fecha?: string;
  nota?: string;
  clave_cliente: string;
  devolver?: boolean;
}

export interface NuevaTransferencia {
  cuenta_origen_id: string;
  cuenta_destino_id: string;
  monto: number;
  fecha?: string;
  nota?: string;
  clave_cliente: string;
}

export interface NuevaCuenta {
  nombre: string;
  tipo: string;
  titular?: string;
  alias?: string;
  saldo_inicial?: number;
  fecha_inicio: string;
}

export interface SetupCaja {
  fecha_inicio: string;
  cuentas: { nombre: string; tipo: string; titular?: string; saldo_inicial: number }[];
  socios: string[];
}

export function useCajaMutaciones() {
  const qc = useQueryClient();
  const refrescar = () => qc.invalidateQueries({ queryKey: RAIZ });

  return {
    crearMovimiento: useMutation({
      mutationFn: (d: NuevoMovimiento) => api.post('/caja/movimientos', d).then((r) => r.data),
      onSuccess: refrescar,
    }),
    corregirMovimiento: useMutation({
      mutationFn: ({ id, ...d }: NuevoMovimiento & { id: string }) => api.put(`/caja/movimientos/${id}`, d).then((r) => r.data),
      onSuccess: refrescar,
    }),
    anularMovimiento: useMutation({
      mutationFn: (id: string) => api.post(`/caja/movimientos/${id}/anular`).then((r) => r.data),
      onSuccess: refrescar,
    }),
    transferir: useMutation({
      mutationFn: (d: NuevaTransferencia) => api.post('/caja/transferencias', d).then((r) => r.data),
      onSuccess: refrescar,
    }),
    // `dryRun`: solo muestra la diferencia, no anota nada (no refresca).
    arqueo: useMutation({
      mutationFn: ({ dryRun, ...d }: { cuenta_id: string; contado: number; clave_cliente: string; nota?: string; dryRun: boolean }) =>
        api.post<ResultadoArqueo>('/caja/arqueo', d, { params: dryRun ? { dry_run: true } : undefined }).then((r) => r.data),
      onSuccess: (_r, v) => (v.dryRun ? undefined : refrescar()),
    }),
    crearCuenta: useMutation({
      mutationFn: (d: NuevaCuenta) => api.post<CuentaCaja>('/caja/cuentas', d).then((r) => r.data),
      onSuccess: refrescar,
    }),
    actualizarCuenta: useMutation({
      mutationFn: ({ id, ...d }: { id: string } & Partial<Omit<NuevaCuenta, 'tipo'>> & { orden?: number }) =>
        api.put<CuentaCaja>(`/caja/cuentas/${id}`, d).then((r) => r.data),
      onSuccess: refrescar,
    }),
    archivarCuenta: useMutation({
      mutationFn: (id: string) => api.post(`/caja/cuentas/${id}/archivar`).then((r) => r.data),
      onSuccess: refrescar,
    }),
    desarchivarCuenta: useMutation({
      mutationFn: (id: string) => api.post(`/caja/cuentas/${id}/desarchivar`).then((r) => r.data),
      onSuccess: refrescar,
    }),
    setup: useMutation({
      mutationFn: (d: SetupCaja) => api.post<CuentaCaja[]>('/caja/setup', d).then((r) => r.data),
      onSuccess: refrescar,
    }),
  };
}

export type { MovimientoCaja };

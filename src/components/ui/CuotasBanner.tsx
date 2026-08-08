import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import api from '../../lib/api';

interface PromoResuelta {
  tiene_promo_sin_interes: boolean;
  cuotas: number;
  banco?: string;
  descripcion?: string;
  sin_interes: boolean;
}

// Mismo TTL que el cache in-memory del backend (5min) — evita que
// CuotasBanner refetchee individualmente algo que el batch ya trajo fresco.
const STALE_TIME_MS = 5 * 60 * 1000;

const QUERY_KEY = (productoId: string) => ['promo-bancaria', productoId];

// Contexto de batch — lo provee <CuotasBannerBatchProvider> alrededor de una
// grilla con muchos productos, para resolver todas las promos bancarias en
// una sola llamada (POST /productos/promociones-bancarias) en vez de un GET
// por card. Si CuotasBanner se usa sin este provider (ej. el PDP, un solo
// producto), simplemente hace su propio fetch individual — mismo componente,
// mismo prop, sin que el caller tenga que saber cuál modo aplica.
const BatchContext = createContext<{ data: Record<string, PromoResuelta> | undefined; isLoading: boolean } | null>(null);

export function CuotasBannerBatchProvider({ productoIds, children }: { productoIds: string[]; children: React.ReactNode }) {
  const idsKey = productoIds.join(',');
  const { data, isLoading } = useQuery<Record<string, PromoResuelta>>({
    queryKey: ['promo-bancaria-batch', idsKey],
    queryFn: () => api.post('/productos/promociones-bancarias', { ids: productoIds }).then(r => r.data),
    enabled: productoIds.length > 0,
    staleTime: STALE_TIME_MS,
  });

  return <BatchContext.Provider value={{ data, isLoading }}>{children}</BatchContext.Provider>;
}

function Skeleton() {
  // Alto fijo (16px, mismo que ícono+texto de 12px) para no generar layout
  // shift cuando la promo termina de resolver.
  return <div className="h-4 w-28 bg-black/[0.05] rounded animate-pulse" />;
}

function Contenido({ promo }: { promo: PromoResuelta | undefined }) {
  if (!promo) return null;
  const color = promo.tiene_promo_sin_interes ? '#6FA97C' : '#8A867A';
  const texto = promo.tiene_promo_sin_interes
    ? `${promo.cuotas} cuotas sin interés${promo.banco ? ` con ${promo.banco}` : ''}`
    : `Hasta ${promo.cuotas} cuotas`;

  return (
    <div className="flex items-center gap-1.5 text-[12px]" style={{ color }}>
      <CreditCard size={13} />
      <span>{texto}</span>
    </div>
  );
}

export default function CuotasBanner({ productoId }: { productoId: string }) {
  const batch = useContext(BatchContext);
  const queryClient = useQueryClient();

  // Dentro de un provider: no dispara fetch propio, solo lee del mapa
  // batch. `enabled: false` bloquea el fetch individual pero sigue
  // dejando leer/escribir la key de cache para que ambos modos convivan.
  const individual = useQuery<PromoResuelta>({
    queryKey: QUERY_KEY(productoId),
    queryFn: () => api.get(`/productos/${productoId}/promociones-bancarias`).then(r => r.data),
    enabled: batch === null,
    staleTime: STALE_TIME_MS,
  });

  const promo = useMemo(() => {
    if (batch !== null) return batch.data?.[productoId];
    return individual.data;
  }, [batch, individual.data, productoId]);

  const cargando = batch !== null ? batch.isLoading : individual.isLoading;
  const error = batch === null && individual.isError;

  // Deja la data sembrada bajo la key individual también, por si el mismo
  // producto se visita después fuera de un provider de batch (ej. el
  // usuario entra al PDP luego de verlo en la grilla) — reaprovecha el
  // fetch en vez de pedirlo de nuevo dentro del TTL.
  useEffect(() => {
    if (batch !== null && promo && queryClient.getQueryData(QUERY_KEY(productoId)) === undefined) {
      queryClient.setQueryData(QUERY_KEY(productoId), promo);
    }
  }, [batch, promo, productoId, queryClient]);

  if (error) return null;
  if (cargando && !promo) return <Skeleton />;
  // Silencioso: id sin match en el batch (producto inexistente, etc.) — no
  // rompe la card.
  if (!promo) return null;

  return <Contenido promo={promo} />;
}

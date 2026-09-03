import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { Producto } from '../../types/index';
import ProductGrid from './ProductGrid';

// Slugs de categoría donde NO se muestra la tira de recomendados. Pensado para
// la línea B2B de cartelería LED: ux-reviewer no quiere el carrusel (banner de
// cuotas, estética de regalo) en una PDP de comprador comercial. Cargar acá el
// slug real cuando se confirme.
const CATEGORIAS_SIN_RECOMENDADOS: string[] = [];

interface Props {
  slug: string;
  categoriaSlug?: string;
}

// Fase 1 de "productos recomendados": tira "También te puede interesar" al pie
// de la PDP, alimentada por GET /productos/:slug/recomendados (heurística por
// categoría en el backend). Decisiones firmadas con arquitecto / ux-reviewer /
// cm-marketing:
//   - título fijo neutro (no promete una curaduría que la Fase 1 no hace)
//   - card solo-link, sin "agregar al carrito": la persona está mirando OTRO
//     producto y un add a ciegas (sin variante ni grabado) repite el bug del
//     agregado silencioso
//   - menos de 2 resultados / error / mientras carga: no se renderiza nada
//     (una tira flaca o un skeleton acá es peor que la ausencia)
export default function ProductosRecomendados({ slug, categoriaSlug }: Props) {
  const oculta = !!categoriaSlug && CATEGORIAS_SIN_RECOMENDADOS.includes(categoriaSlug);

  const { data } = useQuery<{ data: Producto[]; algoritmo?: string }>({
    queryKey: ['recomendados', slug],
    queryFn: () => api.get(`/productos/${slug}/recomendados`).then((r) => r.data),
    enabled: !!slug && !oculta,
    staleTime: 5 * 60 * 1000,
  });

  const productos = data?.data ?? [];
  if (oculta || productos.length < 2) return null;

  return (
    <section aria-labelledby="recomendados-titulo" className="border-t border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <h2
          id="recomendados-titulo"
          className="text-lg md:text-xl font-bold tracking-tight text-black mb-6 md:mb-8"
        >
          También te puede interesar
        </h2>
        <ProductGrid
          productos={productos}
          onAgregar={() => {}}
          variant="grid"
          scroll
          cols={4}
          bleedClassName="-mx-4 px-4 sm:mx-0 sm:px-0"
          regionLabel="Productos recomendados"
        />
      </div>
    </section>
  );
}

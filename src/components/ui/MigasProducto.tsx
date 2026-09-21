import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Miga } from '../../lib/migas';
import { categoriaIdDeHref } from '../../lib/categoriasArbol';
import { trackCategoriaClick } from '../../lib/analytics';

// Métrica: click en un nivel de las migas. "Productos" = 'todos'; los niveles de
// categoría llevan su id y nivel (con padre: primero raíz, después hija).
function contarClick(migas: Miga[], m: Miga) {
  if (m.path === '/productos') { trackCategoriaClick('migas', 'todos'); return; }
  const id = categoriaIdDeHref(m.path);
  if (id === null) return;
  const niveles = migas.filter((x) => categoriaIdDeHref(x.path) !== null);
  trackCategoriaClick('migas', { id, nombre: m.nombre }, niveles.length === 2 && niveles[1] === m ? 'hija' : 'raiz');
}

const foco = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';

// Breadcrumb de la ficha de producto. Un solo <nav> con dos presentaciones del
// mismo recorrido: en desktop la trilla completa (<ol>, el último ítem es la
// página actual, sin link y con elipsis si no entra); en mobile solo un link de
// retorno de 44px al nivel de arriba — el nombre del producto ya está en el H1
// justo debajo y una trilla larga en 360px obliga a leer de más. El nivel que
// no se ve queda oculto con display:none, así los lectores de pantalla no lo
// anuncian dos veces.
export default function MigasProducto({ migas }: { migas: Miga[] }) {
  const retorno = [...migas].reverse().find((m) => m.path && m.nombre !== 'Inicio');

  return (
    <nav aria-label="Migas de pan" className="border-b border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {retorno && (
          <Link
            to={retorno.path!}
            onClick={() => contarClick(migas, retorno)}
            className={`md:hidden -ml-1 flex min-h-11 items-center gap-1 pr-2 text-sm font-medium text-black/60 hover:text-black transition-colors ${foco}`}
          >
            <ChevronLeft size={16} aria-hidden /> {retorno.nombre}
          </Link>
        )}

        <ol className="hidden md:flex items-center gap-2 py-3 text-xs font-medium text-black/60">
          {migas.map((m, i) => {
            const ultima = i === migas.length - 1;
            return (
              <Fragment key={`${m.nombre}-${i}`}>
                {ultima ? (
                  <li aria-current="page" className="min-w-0 max-w-[30ch] truncate text-black/80" title={m.nombre}>
                    {m.nombre}
                  </li>
                ) : (
                  <li className="flex flex-shrink-0 items-center gap-2">
                    <Link to={m.path!} onClick={() => contarClick(migas, m)} className={`hover:text-black transition-colors ${foco}`}>{m.nombre}</Link>
                    <ChevronRight size={10} aria-hidden />
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

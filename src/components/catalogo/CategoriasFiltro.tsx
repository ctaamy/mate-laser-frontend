import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { NodoCategoria } from '../../lib/categoriasArbol';

interface Props {
  raices: NodoCategoria[];
  seleccionadaId: number | null;
  onSelect: (id: number | null) => void;
}

// El contador va aria-hidden: el nombre accesible del botón sigue siendo solo
// el de la categoría (lo leen lectores de pantalla y los tests por nombre).
function Cantidad({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span aria-hidden className="ml-3 flex-shrink-0 text-xs tabular-nums text-black/50">{n}</span>;
}

// Categorías del catálogo en acordeón: solo se ve abierta la rama activa (la
// raíz elegida o la que contiene la subcategoría elegida); el chevron abre y
// cierra a mano. Se usa en la sidebar de desktop y en el drawer mobile.
export function CategoriasFiltro({ raices, seleccionadaId, onSelect }: Props) {
  const ramaActiva = raices.find((r) => r.id === seleccionadaId || r.hijas.some((h) => h.id === seleccionadaId))?.id ?? null;
  // null = seguir a la selección; -1 = el usuario cerró la rama activa; id = abrió esa.
  const [manual, setManual] = useState<number | null>(null);
  const [selPrevia, setSelPrevia] = useState(seleccionadaId);
  if (selPrevia !== seleccionadaId) {
    setSelPrevia(seleccionadaId);
    setManual(null);
  }
  const abierta = manual === null ? ramaActiva : manual === -1 ? null : manual;

  const fila = (activa: boolean) =>
    `flex min-h-10 w-full items-center justify-between border-l-2 py-2 pl-3 pr-2 text-left text-sm transition-colors ${
      activa
        ? 'border-black bg-black/[0.05] font-medium text-black'
        : 'border-transparent text-black/70 hover:bg-black/[0.04] hover:text-black'
    }`;

  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={() => onSelect(null)} aria-current={seleccionadaId === null ? 'true' : undefined} className={fila(seleccionadaId === null)}>
        Todos
      </button>
      {raices.map((r) => {
        const abre = abierta === r.id;
        return (
          <div key={r.id}>
            <div className="flex items-stretch">
              <button
                onClick={() => onSelect(r.id)}
                aria-current={seleccionadaId === r.id ? 'true' : undefined}
                className={`${fila(seleccionadaId === r.id)} flex-1`}
              >
                <span>{r.nombre}</span>
                <Cantidad n={r.cantidad_productos} />
              </button>
              {r.hijas.length > 0 && (
                <button
                  onClick={() => setManual(abre ? -1 : r.id)}
                  aria-expanded={abre}
                  aria-label={`${abre ? 'Contraer' : 'Expandir'} ${r.nombre}`}
                  className="flex w-10 flex-shrink-0 items-center justify-center text-black/50 hover:text-black transition-colors"
                >
                  <ChevronRight size={14} className={`transition-transform ${abre ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>
            {abre && (
              <div className="ml-3 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-black/10">
                {r.hijas.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onSelect(h.id)}
                    aria-current={seleccionadaId === h.id ? 'true' : undefined}
                    className={`${fila(seleccionadaId === h.id)} -ml-px`}
                  >
                    <span>{h.nombre}</span>
                    <Cantidad n={h.cantidad_productos} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Atajo mobile sobre la grilla: una fila de chips con las raíces y, si la
// activa tiene subcategorías, una segunda fila con ellas. Cambiar de categoría
// es un toque, sin abrir el drawer de filtros.
export function CategoriasChips({ raices, seleccionadaId, onSelect }: Props) {
  const activa = raices.find((r) => r.id === seleccionadaId || r.hijas.some((h) => h.id === seleccionadaId));
  const contenedor = useRef<HTMLDivElement>(null);
  // La fila scrollea en horizontal: al elegir (o llegar por URL) la categoría
  // activa se centra, si no puede quedar fuera de pantalla.
  useEffect(() => {
    contenedor.current
      ?.querySelectorAll<HTMLElement>('[aria-pressed="true"]')
      .forEach((el) => el.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }, [seleccionadaId]);
  const chip = (activo: boolean) =>
    `flex-shrink-0 min-h-10 rounded-full border px-4 text-sm transition-colors ${
      activo ? 'border-black bg-black text-white' : 'border-black/20 text-black/75 hover:border-black/50'
    }`;
  const fila = 'flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div ref={contenedor} className="md:hidden mb-4 flex flex-col gap-2" data-testid="categorias-chips">
      <div className={fila}>
        <button onClick={() => onSelect(null)} aria-pressed={seleccionadaId === null} className={chip(seleccionadaId === null)}>Todos</button>
        {raices.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.id)} aria-pressed={activa?.id === r.id} className={chip(activa?.id === r.id)}>
            {r.nombre}
          </button>
        ))}
      </div>
      {activa && activa.hijas.length > 0 && (
        <div className={fila}>
          <button onClick={() => onSelect(activa.id)} aria-pressed={seleccionadaId === activa.id} className={chip(seleccionadaId === activa.id)}>
            Todo {activa.nombre}
          </button>
          {activa.hijas.map((h) => (
            <button key={h.id} onClick={() => onSelect(h.id)} aria-pressed={seleccionadaId === h.id} className={chip(seleccionadaId === h.id)}>
              {h.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

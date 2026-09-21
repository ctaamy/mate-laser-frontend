import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { NodoCategoria } from '../../lib/categoriasArbol';

interface NavLink { label: string; href: string }

interface Props {
  navLinks: NavLink[];
  raices: NodoCategoria[];
  navColor: string;
  pathname: string;
  search: string;
}

// Links del panel mobile/hamburguesa. El link a /productos pasa a ser un
// acordeón con las categorías (antes se listaban las 21 planas debajo de los
// links, duplicando "Diseños" y saliéndose de la pantalla). La fila solo
// expande; "Ver todos los productos" es la primera opción adentro. Si el admin
// sacó el link a /productos, las categorías igual quedan disponibles en un
// acordeón "Categorías" al final. Cerrar el menú al navegar lo resuelve el
// <nav> contenedor (Navbar.tsx).
export default function MenuMobileLinks({ navLinks, raices, navColor, pathname, search }: Props) {
  const hayCategorias = raices.length > 0;
  const idxProductos = navLinks.findIndex((l) => l.href === '/productos');

  // Estando en el catálogo el menú abre con la rama de la categoría actual.
  const catActual = Number(new URLSearchParams(search).get('categoria_id')) || null;
  const [catsAbiertas, setCatsAbiertas] = useState(pathname === '/productos');
  const [rama, setRama] = useState<number | null>(
    () => raices.find((r) => r.id === catActual || r.hijas.some((h) => h.id === catActual))?.id ?? null,
  );

  const filaLink = 'flex min-h-11 items-center px-4 py-2.5 rounded-xl text-sm transition-colors';
  const tenue = { color: navColor, opacity: 0.85 } as const;

  const acordeon = (label: string, activo: boolean) => (
    <div>
      <button
        type="button"
        onClick={() => setCatsAbiertas((v) => !v)}
        aria-expanded={catsAbiertas}
        aria-controls="menu-categorias"
        className="flex min-h-12 w-full items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors"
        style={{ color: navColor, backgroundColor: activo ? `${navColor}0d` : 'transparent', fontWeight: activo ? 600 : 400 }}
      >
        {label}
        <ChevronDown size={16} className={`transition-transform ${catsAbiertas ? 'rotate-180' : ''}`} style={{ opacity: 0.5 }} />
      </button>
      <AnimatePresence initial={false}>
        {catsAbiertas && (
          <motion.div
            id="menu-categorias"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-3 mb-1 flex flex-col border-l" style={{ borderColor: `${navColor}20` }}>
              <Link to="/productos" className={filaLink} style={{ color: navColor, fontWeight: 600 }}>
                Ver todos los productos
              </Link>
              {raices.map((r) =>
                r.hijas.length === 0 ? (
                  <Link key={r.id} to={`/productos?categoria_id=${r.id}`} className={filaLink} style={tenue}>
                    {r.nombre}
                  </Link>
                ) : (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setRama((v) => (v === r.id ? null : r.id))}
                      aria-expanded={rama === r.id}
                      className={`${filaLink} w-full justify-between`}
                      style={tenue}
                    >
                      {r.nombre}
                      <ChevronDown size={14} className={`transition-transform ${rama === r.id ? 'rotate-180' : ''}`} style={{ opacity: 0.4 }} />
                    </button>
                    {rama === r.id && (
                      <div className="ml-3 flex flex-col border-l" style={{ borderColor: `${navColor}15` }}>
                        <Link to={`/productos?categoria_id=${r.id}`} className={filaLink} style={{ color: navColor, fontWeight: 500 }}>
                          Todo {r.nombre}
                        </Link>
                        {r.hijas.map((h) => (
                          <Link key={h.id} to={`/productos?categoria_id=${h.id}`} className={filaLink} style={{ color: navColor, opacity: 0.65 }}>
                            {h.nombre}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {navLinks.map((link, i) => {
        const esProductos = i === idxProductos && hayCategorias;
        const active = pathname === link.href;
        return (
          <motion.div
            key={`${link.href}-${i}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          >
            {esProductos ? (
              acordeon(link.label, pathname === '/productos')
            ) : (
              <Link
                to={link.href}
                className="flex min-h-12 items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  color: navColor,
                  backgroundColor: active ? `${navColor}0d` : 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {link.label}
                {active && <motion.span layoutId="mobile-dot" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navColor }} />}
              </Link>
            )}
          </motion.div>
        );
      })}
      {idxProductos === -1 && hayCategorias && acordeon('Categorías', false)}
    </>
  );
}

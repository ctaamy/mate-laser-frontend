import { Link } from 'react-router-dom';
import type { NodoCategoria } from '../../lib/categoriasArbol';
import { trackCategoriaClick } from '../../lib/analytics';

interface Props {
  raices: NodoCategoria[];
  navBorder: string;
  onNavigate: () => void;
}

// Contenido del desplegable de "Productos" (desktop). Una columna por raíz con
// subcategorías —el título de la columna lleva a toda la raíz— y las raíces sin
// subcategorías juntas en una última columna "Más". Sin contadores (acá se
// navega, no se compara). El panel y su posicionamiento viven en Navbar.tsx;
// todo hereda los colores del navbar que configura el admin.
export default function MegaMenuCategorias({ raices, navBorder, onNavigate }: Props) {
  const conHijas = raices.filter((r) => r.hijas.length > 0);
  const sinHijas = raices.filter((r) => r.hijas.length === 0);
  const linea = { borderColor: navBorder } as const;
  const titulo = 'block border-b pb-2 mb-1.5 text-sm font-semibold hover:underline underline-offset-4';
  const enlace = 'block py-1.5 text-sm opacity-75 hover:opacity-100 hover:underline underline-offset-4 transition-opacity';

  return (
    // Cualquier link del panel lo cierra (también si la URL no cambia).
    <div className="max-w-7xl mx-auto px-6 py-7" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) onNavigate(); }}>
      <div className="grid gap-x-8 gap-y-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))' }}>
        {conHijas.map((r) => (
          <div key={r.id}>
            <Link to={`/productos?categoria_id=${r.id}`} className={titulo} style={linea} onClick={() => trackCategoriaClick('navbar_panel', r)}>{r.nombre}</Link>
            {r.hijas.map((h) => (
              <Link key={h.id} to={`/productos?categoria_id=${h.id}`} className={enlace} onClick={() => trackCategoriaClick('navbar_panel', h)}>{h.nombre}</Link>
            ))}
          </div>
        ))}
        {sinHijas.length > 0 && (
          <div>
            {conHijas.length > 0 && <div className="border-b pb-2 mb-1.5 text-sm font-semibold" style={linea}>Más</div>}
            {sinHijas.map((r) => (
              <Link key={r.id} to={`/productos?categoria_id=${r.id}`} className={enlace} onClick={() => trackCategoriaClick('navbar_panel', r)}>{r.nombre}</Link>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 border-t pt-4" style={linea}>
        <Link to="/productos" className="text-sm font-semibold hover:underline underline-offset-4" onClick={() => trackCategoriaClick('navbar_panel', 'todos')}>Ver todos los productos</Link>
      </div>
    </div>
  );
}

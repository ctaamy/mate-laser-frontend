import { Link } from 'react-router-dom';
import type { NodoCategoria } from '../../lib/categoriasArbol';

interface Props {
  raiz: NodoCategoria;
  navBorder: string;
  onNavigate: () => void;
}

// Desplegable compacto de un link del navbar que apunta a una categoría raíz
// (ej. "Diseños" → /productos?categoria_id=N): "Ver todo" + sus subcategorías.
// Vive dentro del wrapper del link (Navbar.tsx), pegado a la base de la barra;
// el contenedor pone posición, fondo y colores del navbar.
export default function SubmenuCategoria({ raiz, navBorder, onNavigate }: Props) {
  const fila = 'block px-5 py-2 text-sm whitespace-nowrap hover:underline underline-offset-4';
  return (
    // Cualquier link del panel lo cierra (también si la URL no cambia).
    <div className="py-2" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) onNavigate(); }}>
      <Link to={`/productos?categoria_id=${raiz.id}`} className={`${fila} font-semibold`}>
        Ver todo {raiz.nombre}
      </Link>
      <div className="mx-5 my-1 border-t" style={{ borderColor: navBorder }} />
      {raiz.hijas.map((h) => (
        <Link key={h.id} to={`/productos?categoria_id=${h.id}`} className={`${fila} opacity-75 hover:opacity-100 transition-opacity`}>
          {h.nombre}
        </Link>
      ))}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { metaNoEncontrado } from '../lib/seo';

// Catch-all de las rutas públicas. Antes una URL inexistente renderizaba una
// pantalla en blanco (con HTTP 200): mala experiencia y un "soft 404" para
// Google. El status real 404 recién se puede dar del lado servidor (Fase 2 de
// docs/seo.md); mientras tanto, noindex del lado cliente.
const META = metaNoEncontrado('pagina');

export default function NoEncontrada() {
  usePageMeta(META);

  return (
    <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center gap-4 text-center">
      <h1 className="text-base font-medium text-black/60">No encontramos esta página</h1>
      <p className="text-sm text-black/40 max-w-sm">
        Puede que el link esté mal escrito o que la página ya no exista.
      </p>
      <Link
        to="/productos"
        className="mt-2 bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors"
      >
        Ver productos
      </Link>
    </div>
  );
}

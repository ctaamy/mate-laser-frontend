import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Envuelve el <Outlet /> de un layout: mientras llega el chunk de la pantalla
// muestra un indicador (el navbar y el footer siguen en su lugar, así la página
// no salta), y si el chunk no se puede traer ofrece reintentar en vez de dejar la
// pantalla en blanco.

function Cargando() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite" aria-busy="true">
      <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

class LimiteDeError extends Component<{ children: ReactNode; ruta: string }, { fallo: boolean; ruta: string }> {
  state = { fallo: false, ruta: this.props.ruta };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  // Un error en una pantalla no se queda pegado al navegar a otra. Se resetea
  // sin remontar a los hijos (un `key` por ruta le reiniciaría el estado a
  // pantallas que hoy lo conservan al cambiar de parámetro, como /productos/:slug).
  static getDerivedStateFromProps(props: { ruta: string }, state: { ruta: string }) {
    return props.ruta !== state.ruta ? { fallo: false, ruta: props.ruta } : null;
  }

  componentDidCatch(error: unknown) {
    console.error('No se pudo cargar la pantalla:', error);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p className="text-sm text-black/70 max-w-sm">
          No pudimos cargar esta pantalla. Puede ser tu conexión o que la tienda se haya actualizado.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-black text-white px-5 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors"
        >
          Recargar
        </button>
      </div>
    );
  }
}

export default function LimiteDeRuta({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <LimiteDeError ruta={pathname}>
      <Suspense fallback={<Cargando />}>{children}</Suspense>
    </LimiteDeError>
  );
}

export { Cargando };

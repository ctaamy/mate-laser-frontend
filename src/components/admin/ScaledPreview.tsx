import { useEffect, useRef, useState } from 'react';

// Renderiza `children` a un ancho de escritorio fijo (para que las clases
// responsive `md:`/`lg:` del sitio se vean como en producción) y lo escala
// visualmente para que entre en el panel angosto del editor — el clásico
// truco de "iframe sin iframe" (evita CORS/assets duplicados: reusa los
// mismos componentes React, no una URL aparte).
const ANCHO_FRAME = 1280;

type Zoom = 'fit' | '100';

export default function ScaledPreview({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [scale, setScale] = useState(1);
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const actualizar = () => {
      const s = zoom === '100' ? 1 : outer.clientWidth / ANCHO_FRAME;
      setScale(s);
      setAlto(inner.scrollHeight * s);
    };
    actualizar();

    const ro = new ResizeObserver(actualizar);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [zoom]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Barra de zoom fija — vive fuera del área que scrollea, así los
          controles quedan siempre visibles aunque el preview sea largo. */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--line)] bg-white flex-shrink-0">
        <span className="text-[10px] text-[var(--ink-soft)] uppercase tracking-wider font-semibold mr-1">Zoom</span>
        <button onClick={() => setZoom('fit')} type="button"
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${zoom === 'fit' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--n-100)]'}`}>
          Ajustar al ancho
        </button>
        <button onClick={() => setZoom('100')} type="button"
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${zoom === '100' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--n-100)]'}`}>
          100%
        </button>
      </div>

      <div ref={outerRef} className="flex-1 min-h-0 overflow-auto bg-[var(--n-50)]">
        <div className="w-full" style={{ height: alto || undefined }}>
          <div
            ref={innerRef}
            // Los <Link> de react-router navegarían la app admin si se clickean
            // dentro del preview — se bloquea en fase de captura (antes de que
            // el propio Link procese el click) para que sea puramente visual.
            onClickCapture={e => e.preventDefault()}
            style={{ width: ANCHO_FRAME, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

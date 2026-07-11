import { useEffect, useRef, useState } from 'react';

// Renderiza `children` a un ancho de escritorio fijo (para que las clases
// responsive `md:`/`lg:` del sitio se vean como en producción) y lo escala
// visualmente para que entre en el panel angosto del editor — el clásico
// truco de "iframe sin iframe" (evita CORS/assets duplicados: reusa los
// mismos componentes React, no una URL aparte).
const ANCHO_FRAME = 1280;

export default function ScaledPreview({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const actualizar = () => {
      const s = outer.clientWidth / ANCHO_FRAME;
      setScale(s);
      setAlto(inner.scrollHeight * s);
    };
    actualizar();

    const ro = new ResizeObserver(actualizar);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  });

  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height: alto || undefined }}>
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
  );
}

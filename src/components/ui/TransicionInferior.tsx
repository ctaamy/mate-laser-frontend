// Transición configurable entre el borde inferior de un bloque del home y
// el bloque siguiente — reemplaza el corte plano por un fundido o una forma
// (curva/diagonal/ondulada). Un solo componente compartido, usado por TODOS
// los bloques desde HomeSecciones.tsx (no por bloque individual).
//
// Cómo funciona sin conocer el color del bloque siguiente: el overlay se
// posiciona empezando exactamente en el borde inferior del bloque actual
// (top: 100%) y se extiende hacia ABAJO, pintando por encima del bloque
// siguiente. Usa solo el color propio del bloque actual — en el caso del
// degradé, va de opaco (en el borde/costura) a transparente, revelando el
// contenido real del bloque siguiente (sea cual sea su color, imagen, etc.)
// a medida que se aleja de la costura. En las formas (SVG), el relleno
// sólido con el color propio "dibuja" la curva/diagonal/onda sobre el
// bloque siguiente. En ambos casos, si cambia la paleta del tema mañana,
// la transición se recalcula sola — nunca hay un color de transición
// hardcodeado.
export type TipoTransicion = 'ninguna' | 'degradado' | 'curva' | 'diagonal' | 'ondulada';

// Bugfix: los paths originales tenían los puntos de control invertidos — el
// relleno (del borde de la curva hacia abajo, hacia el bloque siguiente)
// quedaba GRUESO en los bordes y FINO en el centro (una "sonrisa" hacia
// arriba), al revés de la "colina" que se espera de un divisor curvo/
// ondulado (grueso al centro, fino en los bordes). Los puntos de control
// de "curva" y "ondulada" están invertidos verticalmente respecto de la
// versión anterior para corregirlo.
const FORMAS: Record<Exclude<TipoTransicion, 'ninguna' | 'degradado'>, string> = {
  curva: 'M0,90 C300,0 900,0 1200,90 L1200,120 L0,120 Z',
  diagonal: 'M0,0 L1200,70 L1200,120 L0,120 Z',
  ondulada: 'M0,55 C150,5 350,90 600,55 C850,15 1050,90 1200,55 L1200,120 L0,120 Z',
};

// Bugfix: en un bloque con imagen de fondo (ej. Hero con image_position
// "background"/"bleed"), el borde inferior real son píxeles de la foto, no
// el color plano del bloque — la forma/degradé, pintada con ese color,
// quedaba como un parche desconectado en vez de una transición limpia. El
// "collar" es una franja sólida chica del color propio, superpuesta sobre
// el propio borde inferior del bloque (encima de la imagen si la hay), para
// que la forma/degradé siempre arranque desde un borde limpio y prolijo —
// sea el bloque de color plano o tenga una foto de fondo.
const COLLAR_PX = 28;

export default function TransicionInferior({ tipo, color, height = 90 }: {
  tipo?: TipoTransicion; color: string; height?: number;
}) {
  if (!tipo || tipo === 'ninguna') return null;

  // width: '100%' explícito — un <svg> sin este valor calcula su ancho
  // desde el aspect-ratio intrínseco del viewBox (10:1) en vez de estirarse
  // con left/right:0, quedando recortado a la mitad del bloque.
  const posicion: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0, width: '100%', height,
    pointerEvents: 'none',
  };
  const collarStyle: React.CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: COLLAR_PX,
    backgroundColor: color, pointerEvents: 'none',
  };

  if (tipo === 'degradado') {
    return (
      <>
        <div style={collarStyle} />
        <div style={{ ...posicion, background: `linear-gradient(to bottom, ${color}, transparent)` }} />
      </>
    );
  }

  return (
    <>
      <div style={collarStyle} />
      <svg style={posicion} viewBox="0 0 1200 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d={FORMAS[tipo] ?? FORMAS.curva} fill={color} />
      </svg>
    </>
  );
}

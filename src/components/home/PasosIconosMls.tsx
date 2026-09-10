// Íconos a medida para la variante 'minimal' de como_funciona.
//
// No son de librería a propósito: la guía de diseño (mls-frontend-design)
// marca la iconografía de stock como el primer síntoma de "parece plantilla".
// Los tres comparten la MISMA silueta de mate + bombilla dibujada a un solo
// trazo fino (lenguaje del grabado láser) — eso los ata a MLS. Lo que cambia
// por paso es la marca SOBRE el cuerpo del mate: renglones de texto grabado
// (elegí/personalizá), un tilde (aprobás), el haz del láser con su chispa
// (grabamos y enviamos).
//
// stroke="currentColor" → heredan el color del texto del bloque. viewBox
// 0 0 40 40. Trazo uniforme (un solo "instrumento").

import type { SVGProps } from 'react';

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 40 40',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// Silueta compartida (cuerpo redondo tipo calabaza + boca + bombilla en
// diagonal). Se dibuja igual en los pasos 1-2 para que el motivo sea
// reconocible; el paso 3 usa la variante "media" (solo la parte que asoma
// de la caja).
function SiluetaMate() {
  return (
    <>
      {/* cuerpo */}
      <path d="M20 13.5c6.4 0 10.5 4.4 10.5 10.4S26.4 34.5 20 34.5 9.5 29.9 9.5 23.9 13.6 13.5 20 13.5Z" />
      {/* boca del mate */}
      <path d="M14 16.2c3.2-2.1 8.8-2.1 12 0" />
      {/* bombilla */}
      <path d="M23.5 14.8 30 6.2" />
      <path d="M28.4 4.8 32 7.4" />
    </>
  );
}

// 1 · Elegí y personalizá — el mate con tres renglones de texto grabado en
//     el cuerpo (lo que efectivamente se personaliza).
export function IconoElegir(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <SiluetaMate />
      <path d="M15 23h10" />
      <path d="M15 27h8" />
      <path d="M15 31h5" />
    </svg>
  );
}

// 2 · Aprobás el diseño — el mismo mate, con un tilde de visto bueno donde
//     iría el grabado. "No se graba nada sin tu OK".
export function IconoAprobar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <SiluetaMate />
      <path d="M15 24.5l3.6 3.6 7.2-8.2" />
    </svg>
  );
}

// 3 · Lo grabamos y te llega — el mate ya grabado, dentro de la caja de
//     envío. Cierra el arco: personalizás (1) → aprobás (2) → te llega (3).
//     A este tamaño una "caja" se lee al instante; un "haz de láser" no.
export function IconoGrabar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      {/* parte del mate que asoma de la caja */}
      <path d="M12.5 23c0-6 3.4-9.8 7.5-9.8s7.5 3.8 7.5 9.8" />
      <path d="M15 15.6c2.4-1.6 6.6-1.6 9 0" />
      <path d="M22 13.6 28 6.4" />
      <path d="M26.6 5 30 7.6" />
      {/* caja de envío con solapas abiertas */}
      <path d="M8.5 22.5 5 18M31.5 22.5 35 18" opacity="0.9" />
      <path d="M9 22.5h22v10.2c0 .7-.5 1.3-1.2 1.3H10.2c-.7 0-1.2-.6-1.2-1.3Z" />
      <path d="M20 22.5v11.5" opacity="0.55" />
    </svg>
  );
}

// Por posición (pasos 1-3 de la variante minimal). Un 4º paso o más cae de
// nuevo en los íconos lucide (STAT_ICONS) desde SeccionComoFunciona.
export const PASOS_ICONOS_MLS = [IconoElegir, IconoAprobar, IconoGrabar];

// Logos de referencia de los medios de pago realmente soportados: Mercado
// Pago es el único proveedor de pago integrado (pagos.service.ts, MP
// procesa las tarjetas), Visa/Mastercard se muestran porque MP las acepta
// como tarjetas subyacentes — no hay integración directa de otras redes.
// SVG inline (no assets externos) para no depender de hotlinking ni de
// subir archivos al repo; el admin puede reemplazar cualquiera de estos
// por su propio logo subido (ver metodos_pago_logos en Footer.tsx).
import type { JSX, SVGProps } from 'react';

function MercadoPagoLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 40" {...props}>
      <rect width="120" height="40" rx="6" fill="#00B1EA" />
      <text x="60" y="26" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#ffffff">
        mercado pago
      </text>
    </svg>
  );
}

function VisaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 40" {...props}>
      <rect width="120" height="40" rx="6" fill="#ffffff" stroke="#e5e7eb" />
      <text x="60" y="27" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="800" fontStyle="italic" fill="#1A1F71">
        VISA
      </text>
    </svg>
  );
}

function MastercardLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 40" {...props}>
      <rect width="120" height="40" rx="6" fill="#ffffff" stroke="#e5e7eb" />
      <circle cx="52" cy="20" r="12" fill="#EB001B" />
      <circle cx="68" cy="20" r="12" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}

function AmexLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 40" {...props}>
      <rect width="120" height="40" rx="6" fill="#2E77BC" />
      <text x="60" y="26" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" fill="#ffffff">
        AMEX
      </text>
    </svg>
  );
}

export const PAYMENT_LOGOS: Record<string, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  mercadopago: MercadoPagoLogo,
  visa: VisaLogo,
  mastercard: MastercardLogo,
  amex: AmexLogo,
};

export const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: 'Mercado Pago', visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
};

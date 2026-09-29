import { etiquetaAdmin, etiquetaCliente } from '../../lib/estadoOrden';

// El color dice de quién es la pelota, no la etapa: gris = nadie empezó, azul = lo
// estamos trabajando nosotros, ámbar = esperando a alguien de afuera, violeta = en
// tránsito, verde = terminado, rojo = cancelado.
const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  reservado: 'bg-amber-100 text-amber-700',
  esperando_confirmacion: 'bg-amber-100 text-amber-700',
  pagado: 'bg-[#E1F5EE] text-[#0F6E56]',
  // Solo admin (columna Pedido): pagado o con seña, todavía sin empezar (ni diseño ni preparación).
  sin_empezar: 'bg-gray-100 text-gray-600',
  // Diseño: lo trabajamos nosotros (azul); esperando el OK del cliente es esperar a alguien de afuera (ámbar).
  en_diseno: 'bg-blue-100 text-blue-700',
  diseno_listo: 'bg-blue-100 text-blue-700',
  esperando_aprobacion: 'bg-amber-100 text-amber-700',
  en_preparacion: 'bg-blue-100 text-blue-700',
  listo_para_retirar: 'bg-blue-100 text-blue-700',
  listo_para_enviar: 'bg-blue-100 text-blue-700',
  enviado: 'bg-purple-100 text-purple-700',
  entregado: 'bg-[#E1F5EE] text-[#0F6E56]',
  cancelado: 'bg-red-100 text-red-600',
  rechazado: 'bg-red-100 text-red-600',
  // Exclusivos de ventas manuales (canal='admin_manual') — ver
  // OrdenesService.crearVentaManual/registrarPago.
  pendiente_pago: 'bg-gray-100 text-gray-600',
  pago_parcial: 'bg-amber-100 text-amber-700',
};

interface Props {
  estado: string;
  /** Texto para el cliente (Mi cuenta): "Diseñando tu grabado" en vez del paso interno. Por defecto, el rótulo del admin. */
  paraCliente?: boolean;
}

export default function EstadoBadge({ estado, paraCliente = false }: Props) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[estado] || 'bg-gray-100 text-gray-600'}`}>
      {paraCliente ? etiquetaCliente(estado) : etiquetaAdmin(estado)}
    </span>
  );
}

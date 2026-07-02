const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  reservado: 'bg-amber-100 text-amber-700',
  esperando_confirmacion: 'bg-amber-100 text-amber-700',
  pagado: 'bg-[#E1F5EE] text-[#0F6E56]',
  en_preparacion: 'bg-blue-100 text-blue-700',
  listo_para_retirar: 'bg-blue-100 text-blue-700',
  enviado: 'bg-purple-100 text-purple-700',
  entregado: 'bg-[#E1F5EE] text-[#0F6E56]',
  cancelado: 'bg-red-100 text-red-600',
  rechazado: 'bg-red-100 text-red-600',
};

export default function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[estado] || 'bg-gray-100 text-gray-600'}`}>
      {estado.replace(/_/g, ' ')}
    </span>
  );
}

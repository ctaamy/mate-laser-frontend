interface Props {
  /** true si la orden ya está pagada/confirmada (ver Confirmacion.tsx: orden.estado === 'pagado' || pago aprobado) */
  isAprobado: boolean;
  /** true si sigue reservada/esperando pago o confirmación de MP */
  isPendiente: boolean;
}

export default function OrdenTimeline({ isAprobado, isPendiente }: Props) {
  if (!isAprobado && !isPendiente) return null;

  const steps = [
    { label: isAprobado ? 'Pedido confirmado' : 'Pedido reservado', done: true },
    { label: isAprobado ? 'En preparación' : 'Esperando pago', active: true },
    { label: 'Enviado', done: false },
    { label: 'Entregado', done: false },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-medium mb-4">Estado del pedido</h3>
      <div className="flex flex-col gap-0">
        {steps.map((step, i, arr) => (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${step.done ? 'bg-[#1D9E75]' : step.active ? 'border-2 border-[#1D9E75] bg-[#E1F5EE]' : 'border-2 border-gray-200 bg-white'}`} />
              {i < arr.length - 1 && <div className={`w-0.5 flex-1 my-1 ${step.done ? 'bg-[#1D9E75]' : 'bg-gray-200'}`} style={{ minHeight: 16 }} />}
            </div>
            <div className="pb-3">
              <div className={`text-sm ${step.done || step.active ? 'font-medium' : 'text-gray-400'}`}>{step.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { Orden } from '../../types';

interface Props {
  orden: Orden;
}

export default function OrdenItems({ orden }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-medium mb-4">Productos</h3>
      <div className="flex flex-col gap-3">
        {orden.items_orden?.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E1F5EE] rounded-lg flex items-center justify-center text-lg flex-shrink-0">
              ☕
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{item.nombre_producto}</div>
              <div className="text-xs text-gray-400">
                {item.color && `Color: ${item.color} · `}
                {item.texto_grabado && `"${item.texto_grabado}" · `}
                x{item.cantidad}
              </div>
            </div>
            {item.subtotal != null && (
              <div className="text-sm font-medium">
                ${Number(item.subtotal).toLocaleString('es-AR')}
              </div>
            )}
          </div>
        ))}
      </div>
      {orden.subtotal != null && (
        <>
          <hr className="border-gray-100 my-4" />
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal</span>
              <span>${Number(orden.subtotal).toLocaleString('es-AR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Envío</span>
              <span>{Number(orden.costo_envio) === 0 ? 'Gratis' : `$${Number(orden.costo_envio).toLocaleString('es-AR')}`}</span>
            </div>
            <div className="flex justify-between font-medium text-base mt-1">
              <span>Total</span>
              <span className="text-[#0F6E56]">${Number(orden.total).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

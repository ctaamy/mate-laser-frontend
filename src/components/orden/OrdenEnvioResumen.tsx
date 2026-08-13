import { Truck } from 'lucide-react';
import type { Orden } from '../../types';
import ResumenDireccionEnvio from '../ui/ResumenDireccionEnvio';

interface Props {
  orden: Orden;
}

export default function OrdenEnvioResumen({ orden }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Truck size={15} className="text-[#1D9E75]" /> Envío
      </h3>
      <div className="flex flex-col gap-1 text-sm text-gray-600">
        <div>
          {orden.nombre_cliente} {orden.apellido_cliente}
          {orden.telefono_cliente && ` · ${orden.telefono_cliente}`}
        </div>
        {orden.direccion_envio?.tipo === 'retiro' ? (
          <div>Retiro en local</div>
        ) : (
          <>
            {orden.metodo_envio_nombre && <div className="text-gray-400">{orden.metodo_envio_nombre}</div>}
            {orden.direccion_envio && <ResumenDireccionEnvio direccion={orden.direccion_envio} variant="public" />}
          </>
        )}
      </div>
    </div>
  );
}

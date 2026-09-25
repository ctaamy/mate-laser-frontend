import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import api from '../../lib/api';
import ResumenDireccionEnvio from '../../components/ui/ResumenDireccionEnvio';

// Etiqueta interna imprimible para paquetes que van por BENI Express
// (proveedor 'oca') o retiro — los 2 métodos sin API de courier real
// conectada (ver EnviosService.crearEnvioParaOrden). No es una etiqueta de
// correo oficial, es un ticket para identificar el paquete físicamente.
// Vista standalone (fuera de AdminLayout, ver App.tsx) para que
// window.print() no imprima también el sidebar/nav del admin.
export default function EtiquetaOrden() {
  const { id } = useParams<{ id: string }>();

  // /completa es solo de admin y devuelve la orden entera (punto de retiro y
  // notas incluidos). GET /ordenes/:id, en cambio, devuelve la vista pública y,
  // al ser de auth opcional, con el token vencido degrada en silencio a
  // invitado sin dar 401 — la etiqueta saldría sin la dirección del retiro.
  const { data: orden, isLoading, isError } = useQuery({
    queryKey: ['orden-etiqueta', id],
    queryFn: () => api.get(`/ordenes/${id}/completa`).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Cargando...</div>;
  }

  if (isError || !orden) {
    return <div className="p-8 text-sm text-red-600">No se pudo cargar la orden.</div>;
  }

  const esRetiro = orden.metodos_envio?.proveedor === 'retiro';
  const ubicacion = orden.metodos_envio?.ubicacion as
    | { direccion?: string; localidad?: string; partido?: string; horarios?: string }
    | null
    | undefined;
  const destinatario = orden.usuarios
    ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}`
    : (orden.direccion_envio?.nombre || 'Cliente');

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="max-w-sm mx-auto">
        <button
          onClick={() => window.print()}
          className="print:hidden mb-4 mx-auto flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <Printer size={16} /> Imprimir
        </button>

        <div className="bg-white border border-gray-300 rounded-lg p-5 text-sm text-gray-900 print:border-black print:rounded-none">
          <div className="flex items-baseline justify-between border-b border-gray-300 pb-2 mb-3">
            <span className="font-semibold">Mate Laser Studio</span>
            <span className="text-xs text-gray-500 font-mono">#{orden.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
              {esRetiro ? 'Retira' : 'Destinatario'}
            </div>
            <div className="font-medium">{destinatario}</div>
            {orden.direccion_envio?.telefono && <div className="text-xs text-gray-600">{orden.direccion_envio.telefono}</div>}
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
              {esRetiro ? 'Punto de retiro' : `Envío — ${orden.metodo_envio_nombre || 'BENI Express'}`}
            </div>
            {esRetiro ? (
              <div className="text-xs text-gray-800 leading-relaxed">
                {ubicacion?.direccion && <div>{ubicacion.direccion}</div>}
                {(ubicacion?.localidad || ubicacion?.partido) && (
                  <div>{[ubicacion.localidad, ubicacion.partido].filter(Boolean).join(', ')}</div>
                )}
                {ubicacion?.horarios && <div className="text-gray-500 mt-0.5">{ubicacion.horarios}</div>}
                {!ubicacion?.direccion && <div className="text-gray-400 italic">Sin dirección cargada para este punto.</div>}
              </div>
            ) : (
              <div className="text-xs text-gray-800 leading-relaxed">
                <ResumenDireccionEnvio direccion={orden.direccion_envio} variant="admin" />
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Productos</div>
            <div className="flex flex-col gap-1">
              {(orden.items_orden ?? []).map((item: any) => (
                <div key={item.id} className="text-xs text-gray-800">
                  {item.cantidad}× {item.nombre_producto}
                  {item.color && ` (${item.color})`}
                  {item.texto_grabado && <div className="italic text-gray-600">"{item.texto_grabado}"</div>}
                </div>
              ))}
            </div>
          </div>

          {orden.notas && (
            <div className="pt-2 border-t border-gray-300">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Notas</div>
              <div className="text-xs text-gray-700">{orden.notas}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

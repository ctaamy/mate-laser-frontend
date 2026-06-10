import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const estadoColor: Record<string, string> = {
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

const estados = ['pendiente','reservado','esperando_confirmacion','pagado','en_preparacion','listo_para_retirar','enviado','entregado','cancelado'];

export default function AdminOrdenes() {
  const queryClient = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notas, setNotas] = useState('');

  const { data: ordenes } = useQuery({
    queryKey: ['admin-ordenes-lista', filtroEstado],
    queryFn: () => {
      const params = filtroEstado ? `?estado=${filtroEstado}` : '';
      return api.get(`/ordenes${params}`).then(r => r.data);
    },
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/ordenes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ordenes-lista'] });
      setOrdenSeleccionada(null);
    },
  });

  const confirmarPagoMutation = useMutation({
    mutationFn: (orden_id: string) => api.post(`/pagos/confirmar/${orden_id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ordenes-lista'] }),
  });

  const abrirDetalle = (orden: any) => {
    setOrdenSeleccionada(orden);
    setNuevoEstado(orden.estado);
    setTracking(orden.numero_seguimiento || '');
    setTrackingUrl(orden.url_seguimiento || '');
    setNotas(orden.notas || '');
  };

  const handleActualizar = () => {
    actualizarMutation.mutate({
      id: ordenSeleccionada.id,
      data: {
        estado: nuevoEstado,
        numero_seguimiento: tracking || undefined,
        url_seguimiento: trackingUrl || undefined,
        notas: notas || undefined,
      },
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium">Órdenes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{ordenes?.length || 0} órdenes</p>
        </div>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 font-medium">
              <th className="text-left px-5 py-3">Orden</th>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">Total</th>
              <th className="text-left px-5 py-3">Pago</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Fecha</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenes?.map((orden: any) => (
              <tr key={orden.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-xs text-gray-400 font-mono">#{orden.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-5 py-3 text-sm">
                  {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
                </td>
                <td className="px-5 py-3 text-sm font-medium">${Number(orden.total).toLocaleString('es-AR')}</td>
                <td className="px-5 py-3 text-xs text-gray-500 capitalize">{orden.metodo_pago || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColor[orden.estado] || 'bg-gray-100 text-gray-600'}`}>
                    {orden.estado.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {new Date(orden.creado_en).toLocaleDateString('es-AR')}
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirDetalle(orden)}
                      className="text-xs text-[#1D9E75] hover:underline"
                    >
                      Gestionar
                    </button>
                    {(orden.estado === 'reservado' || orden.estado === 'esperando_confirmacion') && (
                      <button
                        onClick={() => confirmarPagoMutation.mutate(orden.id)}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Confirmar pago
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!ordenes || ordenes.length === 0) && (
          <div className="text-center py-16 text-sm text-gray-400">No hay órdenes todavía</div>
        )}
      </div>

      {/* MODAL GESTIONAR */}
      {ordenSeleccionada && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOrdenSeleccionada(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-medium">Orden #{ordenSeleccionada.id.slice(0, 8).toUpperCase()}</h2>
              <button onClick={() => setOrdenSeleccionada(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Estado</label>
                <select
                  value={nuevoEstado}
                  onChange={e => setNuevoEstado(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1D9E75]"
                >
                  {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Número de seguimiento</label>
                <input
                  value={tracking}
                  onChange={e => setTracking(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1D9E75]"
                  placeholder="Ej: CA123456789AR"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL de seguimiento</label>
                <input
                  value={trackingUrl}
                  onChange={e => setTrackingUrl(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1D9E75]"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notas internas</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1D9E75] resize-none h-16"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setOrdenSeleccionada(null)} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={handleActualizar}
                disabled={actualizarMutation.isPending}
                className="bg-[#1D9E75] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50"
              >
                {actualizarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
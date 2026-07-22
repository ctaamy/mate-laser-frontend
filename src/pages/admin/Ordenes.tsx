import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import EstadoBadge from '../../components/ui/EstadoBadge';

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
      const params = new URLSearchParams({ limit: '100' });
      if (filtroEstado) params.set('estado', filtroEstado);
      return api.get(`/ordenes?${params}`).then(r => r.data.data);
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
    if (!confirm(`¿Confirmás el cambio de estado a "${nuevoEstado.replace(/_/g, ' ')}"? El cliente puede ver este estado desde su cuenta.`)) return;
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

  const handleConfirmarPago = (orden: any) => {
    if (!confirm(`¿Confirmás el pago de la orden #${orden.id.slice(0, 8).toUpperCase()}? Esto la marca como pagada.`)) return;
    confirmarPagoMutation.mutate(orden.id);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Órdenes</h1>
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
            <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
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
                <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                  #{orden.id.slice(0, 8).toUpperCase()}
                  {(orden.items_orden ?? []).some((i: any) => i.combo_id) && (
                    <span className="ml-1.5 text-[10px] font-sans font-medium text-[#1D9E75] bg-[#E1F5EE] px-1.5 py-0.5 rounded">Combo</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-900">
                  {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-900">${Number(orden.total).toLocaleString('es-AR')}</td>
                <td className="px-5 py-3 text-xs text-gray-500 capitalize">{orden.metodo_pago || '—'}</td>
                <td className="px-5 py-3">
                  <EstadoBadge estado={orden.estado} />
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
                        onClick={() => handleConfirmarPago(orden)}
                        disabled={confirmarPagoMutation.isPending && confirmarPagoMutation.variables === orden.id}
                        className="text-xs text-blue-500 hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        {confirmarPagoMutation.isPending && confirmarPagoMutation.variables === orden.id ? 'Confirmando...' : 'Confirmar pago'}
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
              <h2 className="text-base font-medium text-gray-900">Orden #{ordenSeleccionada.id.slice(0, 8).toUpperCase()}</h2>
              <button onClick={() => setOrdenSeleccionada(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* Productos — antes no se veía qué se compró desde acá, había
                  que ir a buscarlo por otro lado para poder operar el pedido. */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Productos</div>
                <div className="flex flex-col gap-2">
                  {(ordenSeleccionada.items_orden ?? []).map((item: any) => (
                    <div key={item.id} className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${item.combo_id ? 'bg-[#E1F5EE]/60 border border-[#5DCAA5]/40' : 'bg-gray-50'}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                          {item.nombre_producto}
                          {item.combo_id && <span className="text-[10px] font-medium text-[#1D9E75]">· combo</span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.cantidad} × ${Number(item.precio_unitario).toLocaleString('es-AR')}
                          {item.color && ` · ${item.color}`}
                        </div>
                        {item.texto_grabado && (
                          <div className="text-xs text-gray-500 italic mt-0.5">"{item.texto_grabado}"</div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 flex-shrink-0">
                        ${Number(item.subtotal).toLocaleString('es-AR')}
                      </div>
                    </div>
                  ))}
                  {(!ordenSeleccionada.items_orden || ordenSeleccionada.items_orden.length === 0) && (
                    <div className="text-xs text-gray-400">Sin ítems.</div>
                  )}
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider -mb-2 pt-2 border-t border-gray-100">Gestión</div>

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
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import EstadoBadge from '../../components/ui/EstadoBadge';
import ResumenDireccionEnvio from '../../components/ui/ResumenDireccionEnvio';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminSelect, AdminTextarea, AdminLabel } from '../../components/admin/ui/AdminInput';
import type { Orden } from '../../types';

const estados = ['pendiente','reservado','esperando_confirmacion','pagado','en_preparacion','listo_para_retirar','enviado','entregado','cancelado'];

export default function AdminOrdenes() {
  const queryClient = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notas, setNotas] = useState('');

  const { data: ordenes, isLoading, isError } = useQuery({
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

  const abrirDetalle = (orden: Orden) => {
    setOrdenSeleccionada(orden);
    setNuevoEstado(orden.estado);
    setTracking(orden.numero_seguimiento || '');
    setTrackingUrl(orden.url_seguimiento || '');
    setNotas(orden.notas || '');
  };

  const handleActualizar = () => {
    if (!ordenSeleccionada) return;
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
          <h1 className="text-xl font-medium text-[var(--ink)]">Órdenes</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{ordenes?.length || 0} órdenes</p>
        </div>
        <AdminSelect value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} fullWidth={false}>
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </AdminSelect>
      </div>

      <AdminCard padded={false}>
        <AdminTable
          columns={['Orden', 'Cliente', 'Total', 'Pago', 'Estado', 'Fecha', 'Acciones']}
          isLoading={isLoading}
          isError={isError}
          isEmpty={!ordenes || ordenes.length === 0}
          emptyMessage="No hay órdenes todavía"
        >
          {ordenes?.map((orden: any) => (
            <tr key={orden.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)] font-mono">
                #{orden.id.slice(0, 8).toUpperCase()}
                {(orden.items_orden ?? []).some((i: any) => i.combo_id) && (
                  <span className="ml-1.5 text-[10px] font-sans font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">Combo</span>
                )}
              </td>
              <td className="px-5 py-3 text-sm text-[var(--ink)]">
                {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
              </td>
              <td className="px-5 py-3 text-sm font-medium text-[var(--ink)]">${Number(orden.total).toLocaleString('es-AR')}</td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)] capitalize">{orden.metodo_pago || '—'}</td>
              <td className="px-5 py-3">
                <EstadoBadge estado={orden.estado} />
              </td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                {new Date(orden.creado_en).toLocaleDateString('es-AR')}
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  <button onClick={() => abrirDetalle(orden)} className="text-xs text-[var(--accent)] hover:underline">
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
        </AdminTable>
      </AdminCard>

      {/* MODAL GESTIONAR */}
      <AdminModal
        open={!!ordenSeleccionada}
        onClose={() => setOrdenSeleccionada(null)}
        title={ordenSeleccionada ? `Orden #${ordenSeleccionada.id.slice(0, 8).toUpperCase()}` : ''}
        footer={<>
          <AdminButton variant="secondary" onClick={() => setOrdenSeleccionada(null)}>Cancelar</AdminButton>
          <AdminButton variant="primary" disabled={actualizarMutation.isPending} onClick={handleActualizar}>
            {actualizarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </AdminButton>
        </>}
      >
        {ordenSeleccionada && (
          <div className="flex flex-col gap-4">
            {/* Productos — antes no se veía qué se compró desde acá, había
                que ir a buscarlo por otro lado para poder operar el pedido. */}
            <div>
              <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Productos</div>
              <div className="flex flex-col gap-2">
                {(ordenSeleccionada.items_orden ?? []).map((item: any) => (
                  <div key={item.id} className={`flex items-start justify-between gap-3 rounded-[var(--radius-el)] px-3 py-2 ${item.combo_id ? 'bg-[var(--accent-soft)] border border-[var(--accent)]/30' : 'bg-[var(--n-50)]'}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)] truncate flex items-center gap-1.5">
                        {item.nombre_producto}
                        {item.combo_id && <span className="text-[10px] font-medium text-[var(--accent)]">· combo</span>}
                      </div>
                      <div className="text-xs text-[var(--ink-soft)]">
                        {item.cantidad} × ${Number(item.precio_unitario).toLocaleString('es-AR')}
                        {item.color && ` · ${item.color}`}
                      </div>
                      {item.texto_grabado && (
                        <div className="text-xs text-[var(--ink-soft)] italic mt-0.5">"{item.texto_grabado}"</div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-[var(--ink)] flex-shrink-0">
                      ${Number(item.subtotal).toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
                {(!ordenSeleccionada.items_orden || ordenSeleccionada.items_orden.length === 0) && (
                  <div className="text-xs text-[var(--ink-soft)]">Sin ítems.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2 pt-2 border-t border-[var(--line)]">Envío</div>
              <div className="bg-[var(--n-50)] rounded-[var(--radius-el)] px-3 py-2.5 text-sm text-[var(--ink)] flex flex-col gap-1">
                <div>
                  <span className="text-[var(--ink-soft)]">Destinatario: </span>
                  {ordenSeleccionada.nombre_cliente} {ordenSeleccionada.apellido_cliente}
                  {ordenSeleccionada.telefono_cliente && ` · ${ordenSeleccionada.telefono_cliente}`}
                </div>
                <div>
                  <span className="text-[var(--ink-soft)]">Modalidad: </span>
                  {ordenSeleccionada.direccion_envio?.tipo === 'retiro'
                    ? 'Retiro en local'
                    : ordenSeleccionada.metodo_envio_nombre || ordenSeleccionada.metodos_envio?.nombre || 'Envío a domicilio'}
                </div>
                {ordenSeleccionada.direccion_envio && (
                  <ResumenDireccionEnvio direccion={ordenSeleccionada.direccion_envio} variant="admin" />
                )}
                {ordenSeleccionada.envios_orden?.[0] && (
                  <div className="pt-1 mt-1 border-t border-[var(--line)]">
                    <span className="text-[var(--ink-soft)]">Tracking (proveedor): </span>
                    {ordenSeleccionada.envios_orden[0].tracking_number || '—'}
                    {ordenSeleccionada.envios_orden[0].estado && ` · ${ordenSeleccionada.envios_orden[0].estado}`}
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider -mb-2 pt-2 border-t border-[var(--line)]">Gestión</div>

            <div>
              <AdminLabel>Estado</AdminLabel>
              <AdminSelect value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
              </AdminSelect>
            </div>
            <div>
              <AdminLabel>Número de seguimiento</AdminLabel>
              <AdminInput value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ej: CA123456789AR" />
            </div>
            <div>
              <AdminLabel>URL de seguimiento</AdminLabel>
              <AdminInput value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <AdminLabel>Notas internas</AdminLabel>
              <AdminTextarea value={notas} onChange={e => setNotas(e.target.value)} className="h-16" />
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

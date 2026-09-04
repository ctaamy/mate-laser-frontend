import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import EstadoBadge from '../../components/ui/EstadoBadge';
import ResumenDireccionEnvio from '../../components/ui/ResumenDireccionEnvio';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminSelect, AdminTextarea, AdminLabel } from '../../components/admin/ui/AdminInput';
import { obtenerProvincias, obtenerLocalidadesPorProvincia, type Provincia, type Localidad } from '../../lib/georef';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Orden, Producto, MetodoEnvio } from '../../types';

const estados = ['pendiente','reservado','esperando_confirmacion','pagado','en_preparacion','listo_para_retirar','enviado','entregado','cancelado','pendiente_pago','pago_parcial'];

// Métodos válidos para venta manual — debe coincidir con METODOS_VENTA_MANUAL
// del backend (mate-laser-backend/src/common/metodos-pago.ts). Excluye
// mercadopago a propósito.
const METODOS_VENTA_MANUAL = ['efectivo', 'transferencia', 'otro'];

interface ItemVentaManual {
  producto_id: string;
  variante_id?: string;
  nombre_producto: string;
  color?: string;
  precio_unitario: number;
  cantidad: number;
}

function cobradoDe(orden: Orden): number {
  return (orden.pagos ?? []).filter(p => p.estado === 'aprobado').reduce((acc, p) => acc + Number(p.monto), 0);
}

export default function AdminOrdenes() {
  const queryClient = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notas, setNotas] = useState('');

  // --- Venta manual (fuera de la web) ---
  const [modalVentaManualAbierto, setModalVentaManualAbierto] = useState(false);
  const [ventaItems, setVentaItems] = useState<ItemVentaManual[]>([]);
  const [itemProductoId, setItemProductoId] = useState('');
  const [itemVarianteId, setItemVarianteId] = useState('');
  const [itemCantidad, setItemCantidad] = useState(1);
  const [itemPrecio, setItemPrecio] = useState<number | ''>('');
  const [metodoPagoManual, setMetodoPagoManual] = useState('efectivo');
  const [montoPagado, setMontoPagado] = useState<number | ''>('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [notasManual, setNotasManual] = useState('');
  const [errorVentaManual, setErrorVentaManual] = useState('');

  // Método de envío (opcional) — mismo patrón que el checkout público:
  // Georef con fallback a texto libre si la API externa falla/tarda.
  const [metodoEnvioId, setMetodoEnvioId] = useState<number | ''>('');
  const [calleEnvio, setCalleEnvio] = useState('');
  const [pisoEnvio, setPisoEnvio] = useState('');
  const [cpEnvio, setCpEnvio] = useState('');
  const [ciudadEnvio, setCiudadEnvio] = useState('');
  const [provinciaEnvio, setProvinciaEnvio] = useState('');
  const [partidoEnvio, setPartidoEnvio] = useState<string | undefined>(undefined);
  const [especificacionesEnvio, setEspecificacionesEnvio] = useState('');
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [provinciasFallback, setProvinciasFallback] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[] | null>(null);
  const [ciudadFallback, setCiudadFallback] = useState(false);

  // Registrar pago (saldar seña pendiente)
  const [montoNuevoPago, setMontoNuevoPago] = useState<number | ''>('');
  const [metodoNuevoPago, setMetodoNuevoPago] = useState('efectivo');

  const busquedaDeb = useDebouncedValue(busqueda.trim(), 300);

  const { data: ordenes, isLoading, isError } = useQuery({
    queryKey: ['admin-ordenes-lista', filtroEstado, filtroCanal, busquedaDeb],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroCanal) params.set('canal', filtroCanal);
      if (busquedaDeb) params.set('search', busquedaDeb);
      return api.get(`/ordenes?${params}`).then(r => r.data.data);
    },
    placeholderData: (prev) => prev,
  });

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['productos-admin-todos'],
    queryFn: () => api.get('/productos/admin/todos?limit=200').then(r => r.data.data),
    enabled: modalVentaManualAbierto,
  });

  const { data: metodosEnvio } = useQuery<MetodoEnvio[]>({
    queryKey: ['envios-activos'],
    queryFn: () => api.get('/envios').then(r => r.data),
    enabled: modalVentaManualAbierto,
  });

  useEffect(() => {
    if (!modalVentaManualAbierto) return;
    obtenerProvincias().then(data => {
      if (data) setProvincias(data);
      else setProvinciasFallback(true);
    });
  }, [modalVentaManualAbierto]);

  useEffect(() => {
    if (!provinciaEnvio) { setLocalidades(null); return; }
    setCiudadFallback(false);
    obtenerLocalidadesPorProvincia(provinciaEnvio).then(data => {
      if (data) setLocalidades(data);
      else { setLocalidades(null); setCiudadFallback(true); }
    });
  }, [provinciaEnvio]);

  const handleSeleccionarCiudadEnvio = (nombreCiudad: string) => {
    setCiudadEnvio(nombreCiudad);
    const localidad = localidades?.find(l => l.nombre === nombreCiudad);
    setPartidoEnvio(localidad?.partido);
  };

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

  const crearVentaManualMutation = useMutation({
    mutationFn: (data: any) => api.post('/ordenes/venta-manual', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ordenes-lista'] });
      cerrarModalVentaManual();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      setErrorVentaManual(Array.isArray(msg) ? msg.join(' / ') : msg || 'No se pudo cargar la venta.');
    },
  });

  const registrarPagoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/ordenes/${id}/registrar-pago`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ordenes-lista'] });
      setOrdenSeleccionada(null);
      setMontoNuevoPago('');
    },
  });

  const anularVentaManualMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ordenes/${id}/anular-venta-manual`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ordenes-lista'] });
      setOrdenSeleccionada(null);
    },
  });

  const abrirDetalle = (orden: Orden) => {
    setOrdenSeleccionada(orden);
    setNuevoEstado(orden.estado);
    setTracking(orden.numero_seguimiento || '');
    setTrackingUrl(orden.url_seguimiento || '');
    setNotas(orden.notas || '');
    setMetodoNuevoPago(orden.metodo_pago || 'efectivo');
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

  const productoSeleccionado = productos?.find(p => p.id === itemProductoId);
  const varianteSeleccionada = productoSeleccionado?.variantes_producto?.find(v => v.id === itemVarianteId);

  const cerrarModalVentaManual = () => {
    setModalVentaManualAbierto(false);
    setVentaItems([]);
    setItemProductoId('');
    setItemVarianteId('');
    setItemCantidad(1);
    setItemPrecio('');
    setMetodoPagoManual('efectivo');
    setMontoPagado('');
    setNombreCliente('');
    setTelefonoCliente('');
    setNotasManual('');
    setMetodoEnvioId('');
    setCalleEnvio('');
    setPisoEnvio('');
    setCpEnvio('');
    setCiudadEnvio('');
    setProvinciaEnvio('');
    setPartidoEnvio(undefined);
    setEspecificacionesEnvio('');
    setErrorVentaManual('');
  };

  const handleSeleccionarProducto = (id: string) => {
    setItemProductoId(id);
    setItemVarianteId('');
    const producto = productos?.find(p => p.id === id);
    setItemPrecio(producto ? Number(producto.precio_base) : '');
  };

  const handleSeleccionarVariante = (id: string) => {
    setItemVarianteId(id);
    const variante = productoSeleccionado?.variantes_producto?.find(v => v.id === id);
    if (variante?.precio_override != null) setItemPrecio(Number(variante.precio_override));
  };

  const handleAgregarItem = () => {
    if (!productoSeleccionado || itemPrecio === '' || itemCantidad < 1) return;
    setVentaItems(prev => [...prev, {
      producto_id: productoSeleccionado.id,
      variante_id: itemVarianteId || undefined,
      nombre_producto: productoSeleccionado.nombre + (varianteSeleccionada?.color ? ` (${varianteSeleccionada.color})` : ''),
      color: varianteSeleccionada?.color,
      precio_unitario: Number(itemPrecio),
      cantidad: itemCantidad,
    }]);
    setItemProductoId('');
    setItemVarianteId('');
    setItemCantidad(1);
    setItemPrecio('');
  };

  const handleQuitarItem = (idx: number) => {
    setVentaItems(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotalVentaManual = ventaItems.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);

  const metodoEnvioSeleccionado = metodosEnvio?.find(m => m.id === metodoEnvioId);
  const esRetiroEnvio = metodoEnvioSeleccionado?.proveedor === 'retiro';

  // Previsualización del costo real (misma fuente que usa el checkout
  // público, POST /envios/calcular) -- el backend siempre recalcula esto
  // en el submit, así que acá es solo informativo, no editable.
  const { data: costosEnvioPreview } = useQuery({
    queryKey: ['envios-calcular-venta-manual', metodoEnvioId, partidoEnvio, cpEnvio, subtotalVentaManual],
    queryFn: () => api.post('/envios/calcular', { partido: partidoEnvio, codigo_postal: cpEnvio, subtotal: subtotalVentaManual }).then(r => r.data),
    enabled: !!metodoEnvioId && !esRetiroEnvio && subtotalVentaManual > 0,
  });
  const costoEnvioPreview = esRetiroEnvio ? 0 : (costosEnvioPreview?.find((c: any) => c.id === metodoEnvioId)?.costo ?? 0);
  const totalVentaManual = subtotalVentaManual + (metodoEnvioId ? costoEnvioPreview : 0);

  const handleCrearVentaManual = () => {
    if (ventaItems.length === 0) return;
    setErrorVentaManual('');
    crearVentaManualMutation.mutate({
      items: ventaItems,
      metodo_pago: metodoPagoManual,
      monto_pagado: montoPagado === '' ? 0 : Number(montoPagado),
      nombre_cliente: nombreCliente || undefined,
      telefono_cliente: telefonoCliente || undefined,
      notas: notasManual || undefined,
      metodo_envio_id: metodoEnvioId || undefined,
      direccion_envio: (metodoEnvioId && !esRetiroEnvio) ? {
        calle: calleEnvio,
        piso: pisoEnvio || undefined,
        cp: cpEnvio,
        ciudad: ciudadEnvio,
        provincia: provinciaEnvio,
        partido: partidoEnvio,
        especificaciones: especificacionesEnvio || undefined,
      } : undefined,
    });
  };

  const handleRegistrarPago = () => {
    if (!ordenSeleccionada || montoNuevoPago === '' || Number(montoNuevoPago) <= 0) return;
    registrarPagoMutation.mutate({
      id: ordenSeleccionada.id,
      data: { monto: Number(montoNuevoPago), metodo_pago: metodoNuevoPago },
    });
  };

  const handleAnularVentaManual = () => {
    if (!ordenSeleccionada) return;
    if (!confirm(`¿Anulás la venta #${ordenSeleccionada.id.slice(0, 8).toUpperCase()}? Se restaura el stock vendido y se cancelan los pagos cobrados. No se puede deshacer.`)) return;
    anularVentaManualMutation.mutate(ordenSeleccionada.id);
  };

  const esVentaManualPendiente = ordenSeleccionada?.canal === 'admin_manual'
    && (ordenSeleccionada.estado === 'pendiente_pago' || ordenSeleccionada.estado === 'pago_parcial');
  const esVentaManualAnulable = ordenSeleccionada?.canal === 'admin_manual' && ordenSeleccionada.estado !== 'cancelado';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Órdenes</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{ordenes?.length || 0} órdenes</p>
        </div>
        <div className="flex items-center gap-3">
          <AdminButton variant="primary" onClick={() => setModalVentaManualAbierto(true)}>
            + Cargar venta manual
          </AdminButton>
          <AdminInput
            fullWidth={false}
            className="w-60"
            placeholder="Buscar por #orden, cliente o email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <AdminSelect value={filtroCanal} onChange={e => setFiltroCanal(e.target.value)} fullWidth={false}>
            <option value="">Todos los canales</option>
            <option value="web">Web</option>
            <option value="admin_manual">Manual</option>
          </AdminSelect>
          <AdminSelect value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} fullWidth={false}>
            <option value="">Todos los estados</option>
            {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
          </AdminSelect>
        </div>
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
                <div>
                  #{orden.id.slice(0, 8).toUpperCase()}
                  {orden.canal === 'admin_manual' && (
                    <span className="ml-1.5 text-[10px] font-sans font-medium text-[var(--ink)] bg-[var(--n-100)] px-1.5 py-0.5 rounded">Manual</span>
                  )}
                  {(orden.items_orden ?? []).some((i: any) => i.combo_id) && (
                    <span className="ml-1.5 text-[10px] font-sans font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">Combo</span>
                  )}
                </div>
                {orden.cargado_por && (
                  <div className="text-[10px] font-sans normal-case text-[var(--ink-soft)] mt-0.5">
                    por {orden.cargado_por.nombre || orden.cargado_por.email}
                  </div>
                )}
              </td>
              <td className="px-5 py-3 text-sm text-[var(--ink)]">
                {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : (orden.direccion_envio?.nombre || 'Invitado')}
              </td>
              <td className="px-5 py-3 text-sm font-medium text-[var(--ink)]">
                ${Number(orden.total).toLocaleString('es-AR')}
                {(orden.estado === 'pago_parcial' || orden.estado === 'pendiente_pago') && (
                  <div className="text-[11px] font-normal text-[var(--ink-soft)]">
                    saldo ${(Number(orden.total) - cobradoDe(orden)).toLocaleString('es-AR')}
                  </div>
                )}
              </td>
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
          {esVentaManualAnulable && (
            <AdminButton
              variant="danger"
              className="mr-auto"
              disabled={anularVentaManualMutation.isPending}
              onClick={handleAnularVentaManual}
            >
              {anularVentaManualMutation.isPending ? 'Anulando...' : 'Anular venta'}
            </AdminButton>
          )}
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

            {ordenSeleccionada.canal === 'admin_manual' ? (
              <div>
                <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2 pt-2 border-t border-[var(--line)]">Venta manual</div>
                <div className="bg-[var(--n-50)] rounded-[var(--radius-el)] px-3 py-2.5 text-sm text-[var(--ink)] flex flex-col gap-1">
                  {ordenSeleccionada.direccion_envio?.nombre && (
                    <div><span className="text-[var(--ink-soft)]">Cliente: </span>{ordenSeleccionada.direccion_envio.nombre}{ordenSeleccionada.direccion_envio.telefono && ` · ${ordenSeleccionada.direccion_envio.telefono}`}</div>
                  )}
                  <div><span className="text-[var(--ink-soft)]">Cobrado: </span>${cobradoDe(ordenSeleccionada).toLocaleString('es-AR')} de ${Number(ordenSeleccionada.total).toLocaleString('es-AR')}</div>
                  {ordenSeleccionada.metodo_envio_nombre ? (
                    <>
                      <div className="pt-1 mt-1 border-t border-[var(--line)]">
                        <span className="text-[var(--ink-soft)]">Envío: </span>{ordenSeleccionada.metodo_envio_nombre}
                        {' · '}${Number(ordenSeleccionada.costo_envio).toLocaleString('es-AR')}
                      </div>
                      {ordenSeleccionada.direccion_envio?.calle && (
                        <ResumenDireccionEnvio direccion={ordenSeleccionada.direccion_envio} variant="admin" />
                      )}
                      {ordenSeleccionada.envios_orden?.[0] && (
                        <div className="pt-1 mt-1 border-t border-[var(--line)]">
                          <span className="text-[var(--ink-soft)]">Tracking (proveedor): </span>
                          {ordenSeleccionada.envios_orden[0].tracking_number || '—'}
                          {ordenSeleccionada.envios_orden[0].estado && ` · ${ordenSeleccionada.envios_orden[0].estado}`}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="pt-1 mt-1 border-t border-[var(--line)] text-[var(--ink-soft)]">Sin envío — retiro/entrega en mano.</div>
                  )}
                </div>
              </div>
            ) : (
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
            )}

            {esVentaManualPendiente && (
              <div>
                <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2 pt-2 border-t border-[var(--line)]">Registrar pago</div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <AdminLabel>Monto</AdminLabel>
                    <AdminInput
                      type="number"
                      min={0}
                      value={montoNuevoPago}
                      onChange={e => setMontoNuevoPago(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Saldo: $${(Number(ordenSeleccionada.total) - cobradoDe(ordenSeleccionada)).toLocaleString('es-AR')}`}
                    />
                  </div>
                  <div className="flex-1">
                    <AdminLabel>Medio de pago</AdminLabel>
                    <AdminSelect value={metodoNuevoPago} onChange={e => setMetodoNuevoPago(e.target.value)}>
                      {METODOS_VENTA_MANUAL.map(m => <option key={m} value={m}>{m}</option>)}
                    </AdminSelect>
                  </div>
                  <AdminButton
                    variant="primary"
                    disabled={registrarPagoMutation.isPending || montoNuevoPago === ''}
                    onClick={handleRegistrarPago}
                  >
                    {registrarPagoMutation.isPending ? 'Guardando...' : 'Registrar'}
                  </AdminButton>
                </div>
              </div>
            )}

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

      {/* MODAL CARGAR VENTA MANUAL */}
      <AdminModal
        open={modalVentaManualAbierto}
        onClose={cerrarModalVentaManual}
        title="Cargar venta manual"
        maxWidth="lg"
        footer={<>
          <AdminButton variant="secondary" onClick={cerrarModalVentaManual}>Cancelar</AdminButton>
          <AdminButton
            variant="primary"
            disabled={crearVentaManualMutation.isPending || ventaItems.length === 0}
            onClick={handleCrearVentaManual}
          >
            {crearVentaManualMutation.isPending ? 'Guardando...' : 'Cargar venta'}
          </AdminButton>
        </>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[var(--ink-soft)]">
            Para ventas realizadas fuera de la web (presencial, redes, feria). Descuenta stock al cargarla, aunque solo se haya cobrado una seña.
          </p>
          {errorVentaManual && (
            <div className="text-xs text-[var(--error)] bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-[var(--radius-el)] px-3 py-2">
              {errorVentaManual}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Productos</div>
            <div className="flex flex-col gap-2">
              {ventaItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-[var(--radius-el)] px-3 py-2 bg-[var(--n-50)]">
                  <div className="text-sm text-[var(--ink)]">
                    {item.nombre_producto} — {item.cantidad} × ${item.precio_unitario.toLocaleString('es-AR')}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--ink)]">${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</span>
                    <button onClick={() => handleQuitarItem(idx)} className="text-xs text-[var(--error)] hover:underline">Quitar</button>
                  </div>
                </div>
              ))}
              {ventaItems.length === 0 && (
                <div className="text-xs text-[var(--ink-soft)]">Todavía no agregaste productos.</div>
              )}
            </div>

            <div className="flex gap-2 items-end mt-3 flex-wrap">
              <div className="flex-1 min-w-[10rem]">
                <AdminLabel>Producto</AdminLabel>
                <AdminSelect value={itemProductoId} onChange={e => handleSeleccionarProducto(e.target.value)}>
                  <option value="">Elegir producto...</option>
                  {productos?.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.stock != null ? ` (stock: ${p.stock})` : ''}</option>)}
                </AdminSelect>
              </div>
              {!!productoSeleccionado?.variantes_producto?.length && (
                <div className="flex-1 min-w-[8rem]">
                  <AdminLabel>Variante</AdminLabel>
                  <AdminSelect value={itemVarianteId} onChange={e => handleSeleccionarVariante(e.target.value)}>
                    <option value="">Sin variante</option>
                    {productoSeleccionado.variantes_producto.map(v => (
                      <option key={v.id} value={v.id}>{v.color || v.id.slice(0, 8)} (stock: {v.stock ?? 0})</option>
                    ))}
                  </AdminSelect>
                </div>
              )}
              <div className="w-20">
                <AdminLabel>Cant.</AdminLabel>
                <AdminInput type="number" min={1} value={itemCantidad} onChange={e => setItemCantidad(Number(e.target.value) || 1)} />
              </div>
              <div className="w-28">
                <AdminLabel>Precio unit.</AdminLabel>
                <AdminInput type="number" min={0} value={itemPrecio} onChange={e => setItemPrecio(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <AdminButton variant="secondary" disabled={!productoSeleccionado || itemPrecio === ''} onClick={handleAgregarItem}>
                Agregar
              </AdminButton>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2 pt-2 border-t border-[var(--line)]">Envío (opcional)</div>
            <AdminLabel>Método de envío</AdminLabel>
            <AdminSelect value={metodoEnvioId} onChange={e => setMetodoEnvioId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Sin envío (retiro informal / entrega en mano)</option>
              {metodosEnvio?.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </AdminSelect>

            {!!metodoEnvioId && !esRetiroEnvio && (
              <div className="flex flex-col gap-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <AdminLabel>Provincia</AdminLabel>
                    {provinciasFallback || !provincias ? (
                      <AdminInput value={provinciaEnvio} onChange={e => { setProvinciaEnvio(e.target.value); setCiudadEnvio(''); setPartidoEnvio(undefined); }} placeholder="Buenos Aires" />
                    ) : (
                      <AdminSelect value={provinciaEnvio} onChange={e => { setProvinciaEnvio(e.target.value); setCiudadEnvio(''); setPartidoEnvio(undefined); }}>
                        <option value="">Seleccioná</option>
                        {provincias.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </AdminSelect>
                    )}
                  </div>
                  <div>
                    <AdminLabel>Ciudad / Localidad</AdminLabel>
                    {ciudadFallback || !provinciaEnvio || !localidades ? (
                      <AdminInput value={ciudadEnvio} onChange={e => handleSeleccionarCiudadEnvio(e.target.value)} placeholder="Buenos Aires" />
                    ) : (
                      <AdminSelect value={ciudadEnvio} onChange={e => handleSeleccionarCiudadEnvio(e.target.value)}>
                        <option value="">Seleccioná</option>
                        {localidades.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
                      </AdminSelect>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
                  <AdminInput value={calleEnvio} onChange={e => setCalleEnvio(e.target.value)} placeholder="Calle y número" />
                  <AdminInput value={pisoEnvio} onChange={e => setPisoEnvio(e.target.value)} placeholder="Piso/depto (opcional)" />
                  <AdminInput className="w-24" value={cpEnvio} onChange={e => setCpEnvio(e.target.value)} placeholder="CP" />
                </div>
                <AdminInput value={especificacionesEnvio} onChange={e => setEspecificacionesEnvio(e.target.value)} placeholder="Referencias / especificaciones (opcional)" />
                <p className="text-xs text-[var(--ink-soft)]">
                  Costo de envío estimado: <span className="font-medium text-[var(--ink)]">${costoEnvioPreview.toLocaleString('es-AR')}</span> — se recalcula al guardar.
                </p>
              </div>
            )}
          </div>

          <div className="text-right text-sm font-medium text-[var(--ink)] pt-2 border-t border-[var(--line)]">
            Total: ${totalVentaManual.toLocaleString('es-AR')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <AdminLabel>Medio de pago</AdminLabel>
              <AdminSelect value={metodoPagoManual} onChange={e => setMetodoPagoManual(e.target.value)}>
                {METODOS_VENTA_MANUAL.map(m => <option key={m} value={m}>{m}</option>)}
              </AdminSelect>
            </div>
            <div>
              <AdminLabel>Monto cobrado ahora</AdminLabel>
              <AdminInput
                type="number"
                min={0}
                value={montoPagado}
                onChange={e => setMontoPagado(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Total: $${totalVentaManual.toLocaleString('es-AR')}`}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--ink-soft)] -mt-2">
            Dejalo vacío o en $0 si todavía no cobraste nada (queda "pendiente de pago"). Si cobrás menos que el total, queda como seña ("pago parcial") y podés registrar el resto después desde "Gestionar".
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <AdminLabel>Cliente (opcional)</AdminLabel>
              <AdminInput value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <AdminLabel>Teléfono (opcional)</AdminLabel>
              <AdminInput value={telefonoCliente} onChange={e => setTelefonoCliente(e.target.value)} placeholder="Ej: 1122334455" />
            </div>
          </div>
          <div>
            <AdminLabel>Notas internas</AdminLabel>
            <AdminTextarea value={notasManual} onChange={e => setNotasManual(e.target.value)} className="h-16" placeholder="Ej: entregado en feria de Palermo" />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

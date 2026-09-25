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
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import type { Orden, Producto, MetodoEnvio } from '../../types';

const estados = ['pendiente','reservado','esperando_confirmacion','pagado','en_preparacion','listo_para_retirar','enviado','entregado','cancelado','pendiente_pago','pago_parcial'];

// Compras de prueba — espejo de esMarcablePrueba()/stockSostenido() del backend
// (mate-laser-backend/src/common/estados-orden.ts). El backend es la fuente de
// verdad (devuelve 409 si no corresponde); esto solo decide qué mostrar.
// Con el pago aprobado el stock ya salió del inventario; cancelado/rechazado no
// tienen stock que devolver; las pre-pago no se pueden marcar (pueden tener
// stock reservado y un webhook/cron las mueve en cualquier momento).
const ESTADOS_CON_STOCK = ['pagado', 'en_preparacion', 'listo_para_retirar', 'enviado', 'entregado'];
const ESTADOS_MARCABLES_PRUEBA = [...ESTADOS_CON_STOCK, 'cancelado', 'rechazado'];

// Qué hacer con una orden pre-pago para poder marcarla. OJO: cambiar el estado a
// mano a "cancelado" NO devuelve el stock reservado (PUT /ordenes/:id no lo
// toca), así que solo se aconseja donde es seguro: MP sin pagar (nunca descontó
// stock), la reserva que vence sola (el cron devuelve el stock) o "Anular venta".
function pistaOrdenNoMarcable(estado: string): string {
  if (estado === 'pendiente') {
    return 'Todavía no se pagó y no descontó stock. Cancelala cambiando su estado y después podés marcarla como de prueba.';
  }
  if (estado === 'pendiente_pago' || estado === 'pago_parcial') {
    return 'Es una venta manual sin saldar. Usá "Anular venta" (devuelve el stock) y después podés marcarla como de prueba.';
  }
  return 'Todavía no se pagó. Dejá que venza la reserva (se cancela sola y devuelve el stock) y después podés marcarla como de prueba.';
}

// Métodos válidos para venta manual — debe coincidir con METODOS_VENTA_MANUAL
// del backend (mate-laser-backend/src/common/metodos-pago.ts). Excluye
// mercadopago a propósito.
const METODOS_VENTA_MANUAL = ['efectivo', 'transferencia', 'otro'];

// Sub-canal de una venta manual — valores deben coincidir con
// CANALES_VENTA_MANUAL del backend (mismo archivo que METODOS_VENTA_MANUAL).
const CANALES_VENTA = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'feria', label: 'Feria' },
  { value: 'presencial', label: 'Presencial / local' },
  { value: 'otro', label: 'Otro' },
];

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
  const [filtroOrigenVenta, setFiltroOrigenVenta] = useState('');
  // Las compras de prueba (Tami/Facu probando el checkout) vienen ocultas: no
  // es un filtro de negocio, así que arranca apagado en cada visita.
  const [incluirPruebas, setIncluirPruebas] = useState(false);
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
  const [origenVenta, setOrigenVenta] = useState('');
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
  // Quién recibe / DNI — exigidos por el backend para logística privada
  // (proveedor 'oca', ver esLogisticaPrivada en create-orden.dto.ts) igual
  // que en el checkout público (Checkout.tsx). Antes la venta manual no los
  // pedía para el mismo courier — dato encontrado en la auditoría.
  const [recibeCompradorManual, setRecibeCompradorManual] = useState<boolean | null>(null);
  const [quienRecibeManual, setQuienRecibeManual] = useState('');
  const [dniReceptorManual, setDniReceptorManual] = useState('');
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [provinciasFallback, setProvinciasFallback] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[] | null>(null);
  const [ciudadFallback, setCiudadFallback] = useState(false);

  // Registrar pago (saldar seña pendiente)
  const [montoNuevoPago, setMontoNuevoPago] = useState<number | ''>('');
  const [metodoNuevoPago, setMetodoNuevoPago] = useState('efectivo');

  // Evita perder lo cargado si se hace click afuera del modal por error —
  // mismo patrón que Productos.tsx/PromocionesBancarias.tsx (ver useDirtyGuard).
  const { marcarSnapshot, confirmarCierre } = useDirtyGuard<Record<string, unknown>>();

  const busquedaDeb = useDebouncedValue(busqueda.trim(), 300);

  // --- Compras de prueba: marcar / desmarcar ---
  // `null` = confirmación cerrada. Es un segundo modal (no `confirm()`) porque
  // la confirmación lleva un checkbox.
  const [modoPrueba, setModoPrueba] = useState<'marcar' | 'desmarcar' | null>(null);
  const [reintegrarStock, setReintegrarStock] = useState(true);
  const [errorPrueba, setErrorPrueba] = useState('');
  // Aviso persistente sobre la tabla: al marcar, la fila desaparece de la lista
  // (las pruebas están ocultas) y sin esto parecería que se borró.
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);

  const { data: ordenes, isLoading, isError } = useQuery({
    queryKey: ['admin-ordenes-lista', filtroEstado, filtroCanal, filtroOrigenVenta, incluirPruebas, busquedaDeb],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroCanal) params.set('canal', filtroCanal);
      if (filtroOrigenVenta) params.set('origen_venta', filtroOrigenVenta);
      if (incluirPruebas) params.set('incluir_pruebas', 'true');
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
      resetYCerrarVentaManual();
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

  const pruebaMutation = useMutation({
    mutationFn: ({ id, accion, reintegrar }: { id: string; accion: 'marcar' | 'desmarcar'; reintegrar: boolean }) =>
      accion === 'marcar'
        ? api.post(`/ordenes/${id}/marcar-prueba`, { reintegrar_stock: reintegrar }).then(r => r.data)
        : api.post(`/ordenes/${id}/desmarcar-prueba`).then(r => r.data),
    onSuccess: (res, vars) => {
      // Marcar/desmarcar mueve las métricas del Dashboard, los contadores y el
      // stock: sin invalidarlos se seguiría viendo el número viejo.
      for (const key of [
        'admin-ordenes-lista', 'admin-ordenes', 'admin-ordenes-estadisticas',
        'admin-ordenes-metricas', 'admin-productos', 'productos-admin-todos',
      ]) queryClient.invalidateQueries({ queryKey: [key] });

      const numero = `#${vars.id.slice(0, 8).toUpperCase()}`;
      setAvisoPrueba(
        vars.accion === 'marcar'
          ? `Orden ${numero} marcada como prueba. Ya no cuenta en métricas.${res.stock_reintegrado ? ' Se devolvió el stock.' : ''}${res.cupon_liberado ? ' Se liberó el cupón.' : ''}`
          : `Orden ${numero} desmarcada: vuelve a contar en métricas.${res.stock_recontado ? ' Se volvió a descontar su stock.' : ''}${res.cupon_recontado ? ' Se volvió a contar su cupón.' : ''}`,
      );
      setModoPrueba(null);
      setOrdenSeleccionada(null);
    },
    // El error va DENTRO de la confirmación (no se cierra): el 409 del backend
    // explica por qué no se pudo (pendiente de pago, stock insuficiente al
    // desmarcar, la orden cambió mientras tanto).
    onError: (err: { response?: { data?: { message?: string | string[] } } }) => {
      const msg = err.response?.data?.message;
      setErrorPrueba(Array.isArray(msg) ? msg.join(' / ') : msg || 'No se pudo completar la operación. Probá de nuevo.');
    },
  });

  const abrirConfirmacionPrueba = (modo: 'marcar' | 'desmarcar') => {
    setErrorPrueba('');
    setReintegrarStock(true);
    setModoPrueba(modo);
  };

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

  // Snapshot de todo lo que se puede tipear en el modal de venta manual — lo
  // compara useDirtyGuard para saber si hay algo sin guardar al cerrar.
  const snapshotVentaManual = () => ({
    ventaItems, itemProductoId, itemVarianteId, itemCantidad, itemPrecio,
    metodoPagoManual, montoPagado, nombreCliente, telefonoCliente, origenVenta, notasManual,
    metodoEnvioId, calleEnvio, pisoEnvio, cpEnvio, ciudadEnvio, provinciaEnvio,
    especificacionesEnvio, recibeCompradorManual, quienRecibeManual, dniReceptorManual,
  });

  const abrirModalVentaManual = () => {
    marcarSnapshot(snapshotVentaManual());
    setModalVentaManualAbierto(true);
  };

  // Resetea el form y cierra sin preguntar — tras un guardado exitoso (no hay
  // nada que "descartar") y desde cerrarModalVentaManual una vez confirmado.
  const resetYCerrarVentaManual = () => {
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
    setOrigenVenta('');
    setNotasManual('');
    setMetodoEnvioId('');
    setCalleEnvio('');
    setPisoEnvio('');
    setCpEnvio('');
    setCiudadEnvio('');
    setProvinciaEnvio('');
    setPartidoEnvio(undefined);
    setEspecificacionesEnvio('');
    setRecibeCompradorManual(null);
    setQuienRecibeManual('');
    setDniReceptorManual('');
    setErrorVentaManual('');
  };

  // Backdrop-click, botón × y "Cancelar" pasan los tres por acá (ver
  // AdminModal) — si hay cambios sin guardar respecto al snapshot tomado al
  // abrir, confirma antes de descartarlos.
  const cerrarModalVentaManual = () => {
    if (!confirmarCierre(snapshotVentaManual())) return;
    resetYCerrarVentaManual();
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
  // Mismo criterio que Checkout.tsx (isPrivada): cualquier proveedor que no
  // sea retiro/correo/andreani exige saber quién recibe el paquete y su DNI.
  const esLogisticaPrivadaManual = !!metodoEnvioSeleccionado
    && !['retiro', 'andreani', 'correo'].includes(metodoEnvioSeleccionado.proveedor);

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
      origen_venta: origenVenta || undefined,
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
        ...(esLogisticaPrivadaManual && {
          recibe_comprador: recibeCompradorManual ?? undefined,
          quien_recibe: (recibeCompradorManual === true ? nombreCliente : quienRecibeManual) || undefined,
          dni_receptor: dniReceptorManual || undefined,
        }),
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

  // --- Compras de prueba ---
  const esMarcable = !!ordenSeleccionada && ESTADOS_MARCABLES_PRUEBA.includes(ordenSeleccionada.estado);
  // ¿Tiene stock descontado que se pueda devolver? (si no: checkbox oculto)
  const tieneStockSostenido = !!ordenSeleccionada
    && ESTADOS_CON_STOCK.includes(ordenSeleccionada.estado)
    && !ordenSeleccionada.stock_liberado_en;
  const pagoConMercadoPago = !!ordenSeleccionada && (
    ordenSeleccionada.metodo_pago === 'mercadopago'
    || (ordenSeleccionada.pagos ?? []).some(p => p.proveedor === 'mercadopago' && p.estado === 'aprobado')
  );
  const nombreClienteOrden = ordenSeleccionada
    ? (ordenSeleccionada.usuarios
        ? `${ordenSeleccionada.usuarios.nombre} ${ordenSeleccionada.usuarios.apellido}`
        : (ordenSeleccionada.direccion_envio?.nombre || 'Invitado'))
    : '';

  const handleConfirmarPrueba = () => {
    if (!ordenSeleccionada || !modoPrueba) return;
    pruebaMutation.mutate({
      id: ordenSeleccionada.id,
      accion: modoPrueba,
      reintegrar: reintegrarStock && tieneStockSostenido,
    });
  };

  const hayFiltros = !!(filtroEstado || filtroCanal || filtroOrigenVenta || busquedaDeb);

  return (
    <div className="p-6">
      {/* flex-wrap: a 360 px el buscador + 3 selects desbordaban el ancho. */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Órdenes</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{ordenes?.length || 0} órdenes</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AdminButton variant="primary" onClick={abrirModalVentaManual}>
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
          {filtroCanal === 'admin_manual' && (
            <AdminSelect value={filtroOrigenVenta} onChange={e => setFiltroOrigenVenta(e.target.value)} fullWidth={false}>
              <option value="">Todos los orígenes</option>
              {CANALES_VENTA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </AdminSelect>
          )}
          <AdminSelect value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} fullWidth={false}>
            <option value="">Todos los estados</option>
            {estados.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
          </AdminSelect>
        </div>
      </div>

      {/* No es un filtro de negocio: va en su propia línea (no entre los
          selects) y con área táctil de 44 px para el celular. */}
      <label className="flex items-center gap-2 min-h-[44px] w-fit text-sm text-[var(--ink)] cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 accent-[var(--accent)]"
          checked={incluirPruebas}
          onChange={e => setIncluirPruebas(e.target.checked)}
        />
        Mostrar pruebas
      </label>

      {avisoPrueba && (
        <div
          role="status"
          className="mb-3 flex items-start justify-between gap-3 rounded-[var(--radius-el)] border border-[var(--line)] border-l-4 border-l-[var(--accent)] bg-[var(--n-50)] px-3 py-2.5 text-sm text-[var(--ink)]"
        >
          <span>
            {avisoPrueba}
            {!incluirPruebas && avisoPrueba.includes('marcada como prueba') && (
              <>
                {' '}
                <button type="button" onClick={() => setIncluirPruebas(true)} className="text-[var(--accent)] hover:underline">
                  Mostrar pruebas
                </button>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setAvisoPrueba(null)}
            aria-label="Cerrar aviso"
            className="text-[var(--ink-soft)] hover:text-[var(--ink)] flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <AdminCard padded={false}>
        {/* Con 7 columnas la tabla mide ~635 px: sin esto, el contenedor flex-1 de AdminLayout
            (que no tiene min-w-0) crecía hasta ese ancho y la PÁGINA desbordaba a 360 px, con el
            header y el aviso estirados. `w-0 min-w-full` hace que este scroll no aporte ancho
            intrínseco al padre pero llene su ancho: la tabla scrollea adentro de la card. Local a
            propósito: arreglarlo en AdminLayout/AdminTable cambia las otras 6 pantallas admin. */}
        <div className="overflow-x-auto w-0 min-w-full">
        <AdminTable
          columns={['Orden', 'Cliente', 'Total', 'Pago', 'Estado', 'Fecha', 'Acciones']}
          isLoading={isLoading}
          isError={isError}
          isEmpty={!ordenes || ordenes.length === 0}
          emptyMessage={
            incluirPruebas
              ? (hayFiltros ? 'No hay órdenes que coincidan con los filtros' : 'No hay órdenes todavía')
              : (
                <>
                  No hay órdenes que coincidan. Las de prueba están ocultas.{' '}
                  <button type="button" onClick={() => setIncluirPruebas(true)} className="text-[var(--accent)] hover:underline">
                    Mostrar pruebas
                  </button>
                </>
              )
          }
        >
          {ordenes?.map((orden: any) => (
            <tr key={orden.id} className={`border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors ${orden.es_prueba ? 'opacity-70' : ''}`}>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)] font-mono">
                <div>
                  #{orden.id.slice(0, 8).toUpperCase()}
                  {orden.es_prueba && (
                    <span className="ml-1.5 text-[10px] font-sans font-medium uppercase tracking-wide text-[var(--ink-soft)] border border-dashed border-[var(--ink-soft)] px-1.5 py-0.5 rounded">
                      Prueba
                    </span>
                  )}
                  {orden.canal === 'admin_manual' && (
                    <span className="ml-1.5 text-[10px] font-sans font-medium text-[var(--ink)] bg-[var(--n-100)] px-1.5 py-0.5 rounded">
                      Manual{orden.origen_venta && ` · ${CANALES_VENTA.find(c => c.value === orden.origen_venta)?.label ?? orden.origen_venta}`}
                    </span>
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
        </div>
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
            {/* Estado arriba, acción abajo (sección "Orden de prueba"). */}
            {ordenSeleccionada.es_prueba && (
              <div
                role="note"
                className="rounded-[var(--radius-el)] border border-dashed border-[var(--ink-soft)] bg-[var(--n-50)] px-3 py-2 text-xs text-[var(--ink)]"
              >
                <strong className="font-semibold">Orden de prueba</strong> — no cuenta en métricas ni contadores.
              </div>
            )}

            {/* Productos — antes no se veía qué se compró desde acá, había
                que ir a buscarlo por otro lado para poder operar el pedido. */}
            <div>
              <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Productos</div>
              <div className="flex flex-col gap-2">
                {(ordenSeleccionada.items_orden ?? []).map((item: any) => (
                  <div key={item.id} className={`flex items-start justify-between gap-3 rounded-[var(--radius-el)] px-3 py-2 border ${item.combo_id ? 'bg-[var(--accent-soft)] border-[var(--accent)]/30' : 'bg-[var(--n-50)] border-[var(--line)]'}`}>
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
                <div className="bg-[var(--n-50)] border border-[var(--line)] rounded-[var(--radius-el)] px-3 py-2.5 text-sm text-[var(--ink)] flex flex-col gap-1">
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
                <div className="bg-[var(--n-50)] border border-[var(--line)] rounded-[var(--radius-el)] px-3 py-2.5 text-sm text-[var(--ink)] flex flex-col gap-1">
                  <div>
                    <span className="text-[var(--ink-soft)]">Destinatario: </span>
                    {ordenSeleccionada.usuarios
                      ? `${ordenSeleccionada.usuarios.nombre} ${ordenSeleccionada.usuarios.apellido}`
                      : (ordenSeleccionada.direccion_envio?.nombre || 'Invitado')}
                    {ordenSeleccionada.direccion_envio?.telefono && ` · ${ordenSeleccionada.direccion_envio.telefono}`}
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

            {/* Etiqueta interna imprimible — solo para los 2 métodos sin API
                de courier real conectada (ver EtiquetaOrden.tsx). Sirve tanto
                para ventas manuales como para pedidos web con ese método. */}
            {(ordenSeleccionada.metodos_envio?.proveedor === 'retiro' || ordenSeleccionada.metodos_envio?.proveedor === 'oca') && (
              <a
                href={`/admin/ordenes/${ordenSeleccionada.id}/etiqueta`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline -mt-2"
              >
                Imprimir etiqueta
              </a>
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

            {/* Compras de prueba. Va al final del cuerpo (no en el footer, que ya
                lleva Anular venta + Cancelar + Guardar) y en un botón secundario:
                es reversible, no es "destructivo". */}
            <div className="pt-2 border-t border-[var(--line)] flex flex-col gap-2">
              <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Orden de prueba</div>
              {ordenSeleccionada.es_prueba ? (
                <>
                  <p className="text-xs text-[var(--ink-soft)]">Se marcó como compra de prueba: no suma en ventas, ticket, ranking ni cupones.</p>
                  <AdminButton variant="secondary" className="w-fit" onClick={() => abrirConfirmacionPrueba('desmarcar')}>
                    Desmarcar como prueba
                  </AdminButton>
                </>
              ) : (
                <>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {esMarcable
                      ? 'Si es una compra de prueba, marcala para que no cuente en ventas, ticket, ranking ni cupones.'
                      : pistaOrdenNoMarcable(ordenSeleccionada.estado)}
                  </p>
                  <AdminButton variant="secondary" className="w-fit" disabled={!esMarcable} onClick={() => abrirConfirmacionPrueba('marcar')}>
                    Marcar como prueba
                  </AdminButton>
                </>
              )}
            </div>
          </div>
        )}
      </AdminModal>

      {/* CONFIRMAR MARCAR / DESMARCAR PRUEBA — segundo modal (no `confirm()`)
          porque lleva un checkbox. "Volver" y no "Cancelar", que se confundiría
          con cancelar la orden. */}
      <AdminModal
        open={modoPrueba !== null && !!ordenSeleccionada}
        onClose={() => { if (!pruebaMutation.isPending) setModoPrueba(null); }}
        title={ordenSeleccionada
          ? (modoPrueba === 'desmarcar'
              ? `¿Desmarcar #${ordenSeleccionada.id.slice(0, 8).toUpperCase()}?`
              : `¿Marcar #${ordenSeleccionada.id.slice(0, 8).toUpperCase()} como prueba?`)
          : ''}
        maxWidth="sm"
        footer={<>
          <AdminButton variant="secondary" disabled={pruebaMutation.isPending} onClick={() => setModoPrueba(null)}>
            Volver
          </AdminButton>
          <AdminButton variant="primary" disabled={pruebaMutation.isPending} onClick={handleConfirmarPrueba}>
            {pruebaMutation.isPending ? 'Guardando...' : modoPrueba === 'desmarcar' ? 'Desmarcar' : 'Marcar como prueba'}
          </AdminButton>
        </>}
      >
        {ordenSeleccionada && (
          <div className="flex flex-col gap-3 text-sm text-[var(--ink)]">
            {/* Identidad de la orden: el riesgo real es marcar una venta de verdad. */}
            <div className="rounded-[var(--radius-el)] bg-[var(--n-50)] border border-[var(--line)] px-3 py-2 text-xs">
              {nombreClienteOrden} · ${Number(ordenSeleccionada.total).toLocaleString('es-AR')} · {ordenSeleccionada.estado.replace(/_/g, ' ')}
            </div>

            {modoPrueba === 'desmarcar' ? (
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[var(--ink-soft)]">
                <li>Vuelve a contar en ventas, ticket y ranking.</li>
                {ordenSeleccionada.stock_liberado_en && ESTADOS_CON_STOCK.includes(ordenSeleccionada.estado) && (
                  <li>Se vuelve a descontar del inventario el stock que se había devuelto. Si ya no alcanza, no se puede desmarcar.</li>
                )}
                {ordenSeleccionada.cupon_id && ESTADOS_CON_STOCK.includes(ordenSeleccionada.estado) && (
                  <li>Se vuelve a contar el uso del cupón.</li>
                )}
              </ul>
            ) : (
              <>
                <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[var(--ink-soft)]">
                  <li>Deja de contar en ventas, ticket, ranking y “Pendientes de pago”.</li>
                  {ordenSeleccionada.cupon_id && <li>Libera el uso del cupón.</li>}
                  <li>Podés desmarcarla cuando quieras.</li>
                </ul>

                {tieneStockSostenido ? (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 mt-0.5 accent-[var(--accent)]"
                      checked={reintegrarStock}
                      onChange={e => setReintegrarStock(e.target.checked)}
                    />
                    <span>
                      Devolver el stock al inventario
                      <span className="block text-xs text-[var(--ink-soft)]">Destildalo solo si el producto realmente salió del taller.</span>
                    </span>
                  </label>
                ) : (
                  <p className="text-xs text-[var(--ink-soft)]">
                    {ordenSeleccionada.stock_liberado_en
                      ? 'El stock ya estaba devuelto: no se toca.'
                      : 'No se toca el stock: la orden ya está cancelada.'}
                  </p>
                )}

                {pagoConMercadoPago && (
                  <div className="rounded-[var(--radius-el)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No reembolsa el pago: hacelo desde Mercado Pago.
                  </div>
                )}
              </>
            )}

            {errorPrueba && (
              <div role="alert" className="border-l-4 border-[var(--error)] bg-[var(--error-soft)] px-3 py-2 text-xs text-[var(--error)]">
                {errorPrueba}
              </div>
            )}
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
            <div className="text-xs text-[var(--error)] bg-[var(--error-soft)] border-l-4 border-[var(--error)] rounded-[var(--radius-el)] px-3 py-2">
              {errorVentaManual}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Productos</div>
            <div className="flex flex-col gap-2">
              {ventaItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-[var(--radius-el)] px-3 py-2 bg-[var(--n-50)] border border-[var(--line)]">
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

                {/* BENI Express es courier privado (no correo formal): igual
                    que en el checkout público, hace falta saber quién retira
                    el paquete y su DNI. */}
                {esLogisticaPrivadaManual && (
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
                    <div>
                      <AdminLabel>¿Recibe el comprador?</AdminLabel>
                      <AdminSelect
                        value={recibeCompradorManual === null ? '' : String(recibeCompradorManual)}
                        onChange={e => setRecibeCompradorManual(e.target.value === '' ? null : e.target.value === 'true')}
                      >
                        <option value="">Seleccioná</option>
                        <option value="true">Sí</option>
                        <option value="false">No, un tercero</option>
                      </AdminSelect>
                    </div>
                    <div>
                      <AdminLabel>Quién recibe</AdminLabel>
                      <AdminInput
                        value={recibeCompradorManual === true ? nombreCliente : quienRecibeManual}
                        onChange={e => setQuienRecibeManual(e.target.value)}
                        disabled={recibeCompradorManual === true}
                        placeholder="Nombre de quien recibe"
                      />
                    </div>
                    <div className="w-28">
                      <AdminLabel>DNI</AdminLabel>
                      <AdminInput value={dniReceptorManual} onChange={e => setDniReceptorManual(e.target.value)} placeholder="Ej: 30123456" />
                    </div>
                  </div>
                )}

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

          <div>
            <AdminLabel>Canal de venta (opcional)</AdminLabel>
            <AdminSelect value={origenVenta} onChange={e => setOrigenVenta(e.target.value)}>
              <option value="">Sin especificar</option>
              {CANALES_VENTA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </AdminSelect>
          </div>

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
            <AdminTextarea value={notasManual} onChange={e => setNotasManual(e.target.value)} className="h-16" placeholder="Notas internas (opcional)" />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, DollarSign, Package, Clock } from 'lucide-react';
import api from '../../lib/api';

export default function AdminDashboard() {
  const { data: ordenes } = useQuery({
    queryKey: ['admin-ordenes'],
    queryFn: () => api.get('/ordenes?limit=100').then(r => r.data.data),
  });

  const { data: productos } = useQuery({
    queryKey: ['admin-productos'],
    queryFn: () => api.get('/productos/admin/todos?limit=100').then(r => r.data.data),
  });

  const totalVentas = ordenes
    ?.filter((o: any) => o.estado === 'pagado' || o.estado === 'en_preparacion' || o.estado === 'enviado' || o.estado === 'entregado')
    ?.reduce((acc: number, o: any) => acc + Number(o.total), 0) || 0;

  const ordenesPendientes = ordenes?.filter((o: any) =>
    o.estado === 'reservado' || o.estado === 'esperando_confirmacion'
  )?.length || 0;

  const stockCritico = productos?.filter((p: any) => p.stock <= p.stock_alerta)?.length || 0;

  const metrics = [
    { label: 'Ventas totales', value: `$${totalVentas.toLocaleString('es-AR')}`, icon: DollarSign, color: 'text-[#1D9E75]', bg: 'bg-[#E1F5EE]' },
    { label: 'Órdenes totales', value: ordenes?.length || 0, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Pendientes de pago', value: ordenesPendientes, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Stock crítico', value: stockCritico, icon: Package, color: 'text-red-500', bg: 'bg-red-50' },
  ];

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

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen general de la tienda</p>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">{m.label}</span>
              <div className={`w-8 h-8 ${m.bg} rounded-lg flex items-center justify-center`}>
                <m.icon size={16} className={m.color} />
              </div>
            </div>
            <div className="text-2xl font-medium">{m.value}</div>
          </div>
        ))}
      </div>

      {/* ÚLTIMAS ÓRDENES */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-medium">Últimas órdenes</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 font-medium">
              <th className="text-left px-5 py-3">Orden</th>
              <th className="text-left px-5 py-3">Cliente</th>
              <th className="text-left px-5 py-3">Total</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {ordenes?.slice(0, 8).map((orden: any) => (
              <tr key={orden.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-xs text-gray-400">#{orden.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-5 py-3 text-sm">
                  {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
                </td>
                <td className="px-5 py-3 text-sm font-medium">${Number(orden.total).toLocaleString('es-AR')}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColor[orden.estado] || 'bg-gray-100 text-gray-600'}`}>
                    {orden.estado.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {new Date(orden.creado_en).toLocaleDateString('es-AR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!ordenes || ordenes.length === 0) && (
          <div className="text-center py-10 text-sm text-gray-400">No hay órdenes todavía</div>
        )}
      </div>

      {/* STOCK CRÍTICO */}
      {stockCritico > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-medium">Stock crítico</h2>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {productos?.filter((p: any) => p.stock <= p.stock_alerta).map((p: any) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.nombre}</div>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.stock === 0 ? 'bg-red-400' : p.stock <= 3 ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, (p.stock / Math.max(p.stock_alerta * 2, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className={`text-sm font-medium ${p.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                  {p.stock} u.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
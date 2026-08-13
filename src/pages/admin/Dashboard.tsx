import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingBag, DollarSign, Package, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import EstadoBadge from '../../components/ui/EstadoBadge';
import { navGroups, type NavItem } from '../../components/layout/AdminLayout';

// El grid de módulos reutiliza la misma fuente de datos que el sidebar
// (navGroups en AdminLayout.tsx) — no hay una segunda lista de módulos
// mantenida acá. "General" queda afuera: su único ítem es esta misma
// página, no tiene sentido como tarjeta de sí misma.
const moduleGroups = navGroups.filter((g) => g.label !== 'General');

function ModuleCard({ item }: { item: NavItem }) {
  const { label, description, icon: Icon, to } = item;
  const disabled = !to;

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-gradient-to-br from-[#E1F5EE] to-[#C9EDE0] rounded-xl flex items-center justify-center shrink-0">
          <Icon size={19} className="text-[#0F6E56]" />
        </div>
        {disabled && (
          <span className="text-[10px] uppercase tracking-wide font-medium bg-gray-100 text-gray-400 px-2 py-1 rounded-full">
            Próximamente
          </span>
        )}
      </div>
      <div className="mt-3.5">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {description && (
          <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-1">{description}</p>
        )}
      </div>
      {!disabled && (
        <div className="mt-3.5 flex items-center gap-1 text-xs font-medium text-[#1D9E75] transition-transform group-hover:translate-x-0.5">
          Acceder <ArrowRight size={13} />
        </div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div
        title="Aún no disponible"
        className="bg-white border border-gray-100 rounded-2xl p-4 opacity-60 cursor-not-allowed"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#5DCAA5]/60 hover:-translate-y-0.5 transition-all duration-200"
    >
      {content}
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-16 bg-gray-100 rounded" />
        <div className="w-8 h-8 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-7 w-20 bg-gray-100 rounded" />
    </div>
  );
}

function ErrorNote({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
      <AlertCircle size={15} className="shrink-0" />
      {mensaje}
    </div>
  );
}

export default function AdminDashboard() {
  // "Últimas órdenes" solo necesita una tira reciente — el límite acá es
  // intencional (es una vista de "últimas", no un conteo).
  const { data: ordenes, isLoading: ordenesLoading, isError: ordenesError } = useQuery({
    queryKey: ['admin-ordenes'],
    queryFn: () => api.get('/ordenes?limit=100').then(r => r.data.data),
  });

  const { data: productos, isLoading: productosLoading, isError: productosError } = useQuery({
    queryKey: ['admin-productos'],
    queryFn: () => api.get('/productos/admin/todos?limit=100').then(r => r.data.data),
  });

  // Las métricas de plata/conteos vienen de un endpoint agregado aparte
  // (GET /ordenes/estadisticas) — antes se calculaban sumando a mano el
  // array de arriba, que está cortado en 100: con más de 100 órdenes
  // históricas, "Ventas totales" quedaba mal (truncado) sin ningún aviso.
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['admin-ordenes-estadisticas'],
    queryFn: () => api.get('/ordenes/estadisticas').then(r => r.data),
  });

  const productosCriticos = productos?.filter((p: any) => p.stock <= p.stock_alerta) ?? [];
  const stockCritico = productosCriticos.length;

  const metrics = stats ? [
    { label: 'Ventas hoy', value: `$${(stats.ventas_hoy ?? 0).toLocaleString('es-AR')}`, icon: DollarSign, color: 'text-[#1D9E75]', bg: 'bg-[#E1F5EE]' },
    { label: 'Ventas históricas', value: `$${(stats.ventas_totales ?? 0).toLocaleString('es-AR')}`, icon: DollarSign, color: 'text-[#1D9E75]', bg: 'bg-[#E1F5EE]' },
    { label: 'Órdenes totales', value: stats.ordenes_totales ?? 0, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Pendientes de pago', value: stats.ordenes_pendientes ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Stock crítico', value: stockCritico, icon: Package, color: 'text-red-500', bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="p-6 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Accesos rápidos y resumen general de la tienda</p>
      </div>

      {/* MÓDULOS — primero, sin scroll */}
      <div className="flex flex-col gap-6">
        {moduleGroups.map((group) => (
          <div key={group.label}>
            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {group.items.map((item) => (
                <ModuleCard key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* RESUMEN — debajo del grid de módulos */}
      <div>
        <h2 className="text-sm font-medium text-gray-900">Resumen</h2>
        <p className="text-xs text-gray-400 mt-0.5">Métricas del día y últimas órdenes</p>
      </div>

      {/* MÉTRICAS */}
      {statsError ? (
        <ErrorNote mensaje="No se pudieron cargar las métricas. Probá recargar la página." />
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {statsLoading || !stats
            ? Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
            : metrics.map((m) => (
                <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">{m.label}</span>
                    <div className={`w-8 h-8 ${m.bg} rounded-lg flex items-center justify-center`}>
                      <m.icon size={16} className={m.color} />
                    </div>
                  </div>
                  <div className="text-2xl font-medium text-gray-900">{m.value}</div>
                </div>
              ))}
        </div>
      )}

      {/* ÚLTIMAS ÓRDENES */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-900">Últimas órdenes</h2>
        </div>

        {ordenesError ? (
          <div className="p-5">
            <ErrorNote mensaje="No se pudieron cargar las órdenes. Probá recargar la página." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
                <th className="text-left px-5 py-3">Orden</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Estado</th>
                <th className="text-left px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ordenesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-50 animate-pulse">
                    <td className="px-5 py-3"><div className="h-3 w-14 bg-gray-100 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-28 bg-gray-100 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-16 bg-gray-100 rounded" /></td>
                    <td className="px-5 py-3"><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-16 bg-gray-100 rounded" /></td>
                  </tr>
                ))
              ) : (
                ordenes?.slice(0, 8).map((orden: any) => (
                  <tr key={orden.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-400">#{orden.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-3 text-sm text-gray-900">
                      {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">${Number(orden.total).toLocaleString('es-AR')}</td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={orden.estado} />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(orden.creado_en).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Solo es un empty state real cuando la query terminó y vino
            vacía de verdad — antes esto también disparaba durante la
            carga (ordenes undefined), mostrando "vacío" antes de tiempo. */}
        {!ordenesLoading && !ordenesError && (!ordenes || ordenes.length === 0) && (
          <div className="text-center py-10 text-sm text-gray-400">No hay órdenes todavía</div>
        )}
      </div>

      {/* STOCK CRÍTICO */}
      {productosError ? (
        <ErrorNote mensaje="No se pudo cargar el stock. Probá recargar la página." />
      ) : productosLoading ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Stock crítico</h2>
          </div>
          <div className="p-5 flex flex-col gap-3 animate-pulse">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                  <div className="h-1.5 bg-gray-100 rounded-full" />
                </div>
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : stockCritico > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Stock crítico</h2>
          </div>
          <div className="p-5 flex flex-col gap-3">
            {productosCriticos.map((p: any) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{p.nombre}</div>
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

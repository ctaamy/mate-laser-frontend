import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { DollarSign, Package, Clock, ArrowRight, AlertCircle, LayoutGrid, TrendingUp } from 'lucide-react';
import api from '../../lib/api';
import EstadoBadge from '../../components/ui/EstadoBadge';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import { navGroups, type NavItem } from '../../components/layout/AdminLayout';

// El grid de módulos reutiliza la misma fuente de datos que el sidebar
// (navGroups en AdminLayout.tsx) — no hay una segunda lista de módulos
// mantenida acá. "General" queda afuera: su único ítem es esta misma
// página, no tiene sentido como tarjeta de sí misma.
const moduleGroups = navGroups.filter((g) => g.label !== 'General');

// Valores deben coincidir con CANALES_VENTA_MANUAL del backend
// (mate-laser-backend/src/common/metodos-pago.ts).
const ORIGEN_VENTA_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  feria: 'Feria',
  presencial: 'Presencial',
  otro: 'Otro',
};

const CANAL_LABELS: Record<string, string> = { web: 'Web', admin_manual: 'Manual' };

const RANGOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'todo', label: 'Todo' },
] as const;

type Rango = (typeof RANGOS)[number]['value'];

function ModuleCard({ item }: { item: NavItem }) {
  const { label, description, icon: Icon, to } = item;
  const disabled = !to;

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-[var(--accent-soft)] rounded-xl flex items-center justify-center shrink-0">
          <Icon size={19} className="text-[var(--accent)]" />
        </div>
        {disabled && (
          <span className="text-[10px] uppercase tracking-wide font-medium bg-[var(--n-100)] text-[var(--ink-soft)] px-2 py-1 rounded-full">
            Próximamente
          </span>
        )}
      </div>
      <div className="mt-3.5">
        <div className="text-sm font-semibold text-[var(--ink)]">{label}</div>
        {description && (
          <p className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed line-clamp-1">{description}</p>
        )}
      </div>
      {!disabled && (
        <div className="mt-3.5 flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
          Acceder <ArrowRight size={13} />
        </div>
      )}
    </>
  );

  if (disabled) {
    return (
      <div title="Aún no disponible" className="opacity-60 cursor-not-allowed">
        <AdminCard>{content}</AdminCard>
      </div>
    );
  }

  return (
    <Link to={to} className="group block">
      <AdminCard hover>{content}</AdminCard>
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <AdminCard className="animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-16 bg-[var(--n-100)] rounded" />
        <div className="w-8 h-8 bg-[var(--n-100)] rounded-lg" />
      </div>
      <div className="h-7 w-20 bg-[var(--n-100)] rounded" />
    </AdminCard>
  );
}

function ErrorNote({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-soft)] border border-[var(--error)]/20 rounded-xl px-4 py-3">
      <AlertCircle size={15} className="shrink-0" />
      {mensaje}
    </div>
  );
}

// Fila de lista con barra proporcional — mismo patrón visual que ya usaba
// "Stock crítico" (ancho de la barra relativo a un máximo del propio
// conjunto), reusado acá para ranking de productos y desgloses por canal
// en vez de meter un tipo de gráfico nuevo para algo que ya tenía patrón.
function FilaConBarra({ etiqueta, valor, valorLabel, maxValor }: {
  etiqueta: string; valor: number; valorLabel: string; maxValor: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--ink)] truncate">{etiqueta}</div>
        <div className="h-1.5 bg-[var(--n-100)] rounded-full mt-1.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${maxValor > 0 ? Math.min(100, (valor / maxValor) * 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="text-sm font-medium text-[var(--ink)] shrink-0">{valorLabel}</div>
    </div>
  );
}

// Texto chico con el delta vs. el período anterior equivalente — a
// propósito NO es un sparkline: es una sola persona, en sesiones
// esporádicas y deliberadas, no un dashboard que se mira todo el día.
// Sin período anterior (rango "todo") o con base 0, no se muestra nada
// en vez de un "+Infinity%" sin sentido.
function Delta({ actual, anterior }: { actual: number; anterior: number | null | undefined }) {
  if (anterior === null || anterior === undefined || anterior === 0) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  const positivo = pct >= 0;
  return (
    <span className={`text-xs font-medium ${positivo ? 'text-emerald-600' : 'text-[var(--error)]'}`}>
      {positivo ? '+' : ''}{pct.toFixed(0)}% vs. período anterior
    </span>
  );
}

// Gráfico de tendencia de ventas — SVG a mano, sin librería (ver decisión
// con arquitecto: sin code-splitting hoy, cualquier librería para esto le
// pegaría al bundle de la tienda pública, no solo al admin). Polilínea
// recta (no curva suavizada, que "inventaría" tendencia entre puntos que
// no existe), tooltip por posición del mouse (no hit-testing sobre la
// línea), ticks de fecha fijos. Un solo punto (rango "hoy") no alcanza
// para trazar una línea — el caller decide qué mostrar en ese caso.
function GraficoTendencia({ serie }: { serie: Array<{ fecha: string; ventas: number }> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const ANCHO = 600;
  const ALTO = 180;
  const PAD_X = 8;
  const PAD_Y = 24;

  const maxVentas = Math.max(1, ...serie.map(p => p.ventas));
  const x = (i: number) => serie.length > 1 ? PAD_X + (i / (serie.length - 1)) * (ANCHO - PAD_X * 2) : ANCHO / 2;
  const y = (v: number) => ALTO - PAD_Y - (v / maxVentas) * (ALTO - PAD_Y * 2);
  const puntos = serie.map((p, i) => `${x(i)},${y(p.ventas)}`).join(' ');

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

  // Hasta 6 ticks fijos (primero, último, equiespaciados entre medio) — con
  // pocos puntos no hace falta un algoritmo de "nice ticks".
  const cantTicks = Math.min(6, serie.length);
  const indicesTicks = Array.from(
    new Set(Array.from({ length: cantTicks }, (_, i) => Math.round((i / (cantTicks - 1 || 1)) * (serie.length - 1)))),
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (serie.length - 1));
    setHoverIdx(Math.max(0, Math.min(serie.length - 1, idx)));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        height={ALTO}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="overflow-visible"
      >
        <line x1={PAD_X} y1={ALTO - PAD_Y} x2={ANCHO - PAD_X} y2={ALTO - PAD_Y} stroke="var(--line)" strokeWidth={1} />

        <motion.polyline
          points={puntos}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {hoverIdx !== null && (
          <>
            <line x1={x(hoverIdx)} y1={PAD_Y} x2={x(hoverIdx)} y2={ALTO - PAD_Y} stroke="var(--line)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={x(hoverIdx)} cy={y(serie[hoverIdx].ventas)} r={4} fill="var(--accent)" />
          </>
        )}

        {indicesTicks.map(i => (
          <text key={i} x={x(i)} y={ALTO - 6} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
            {formatFecha(serie[i].fecha)}
          </text>
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="absolute top-0 bg-[var(--ink)] text-white text-xs rounded-lg px-2 py-1.5 pointer-events-none -translate-x-1/2 -translate-y-full whitespace-nowrap"
          style={{ left: `${(x(hoverIdx) / ANCHO) * 100}%` }}
        >
          <div className="font-medium">${serie[hoverIdx].ventas.toLocaleString('es-AR')}</div>
          <div className="text-[10px] opacity-70">{formatFecha(serie[hoverIdx].fecha)}</div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'operativo' | 'metricas'>('operativo');
  const [rango, setRango] = useState<Rango>('30d');

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

  // Números operativos de "ahora" — a diferencia de /ordenes/metricas
  // (tab Métricas), esto no se filtra por rango: son cosas que piden
  // atención hoy, no un análisis histórico.
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['admin-ordenes-estadisticas'],
    queryFn: () => api.get('/ordenes/estadisticas').then(r => r.data),
  });

  const { data: metricas, isLoading: metricasLoading, isError: metricasError } = useQuery({
    queryKey: ['admin-ordenes-metricas', rango],
    queryFn: () => api.get(`/ordenes/metricas?rango=${rango}`).then(r => r.data),
    enabled: tab === 'metricas',
  });

  const productosCriticos = productos?.filter((p: any) => p.stock <= p.stock_alerta) ?? [];
  const stockCritico = productosCriticos.length;

  const metricsOperativo = stats ? [
    { label: 'Ventas hoy', value: `$${(stats.ventas_hoy ?? 0).toLocaleString('es-AR')}`, icon: DollarSign, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent-soft)]' },
    { label: 'Pendientes de pago', value: stats.ordenes_pendientes ?? 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Stock crítico', value: stockCritico, icon: Package, color: 'text-[var(--error)]', bg: 'bg-[var(--error-soft)]' },
  ] : [];

  const rankingProductos = metricas?.ranking_productos ?? [];
  const ticketPorCanal = metricas?.ticket_promedio_por_canal ?? [];
  const ventasPorOrigen = (metricas?.ventas_por_origen ?? []).filter((o: any) => o.origen_venta);
  const maxRanking = Math.max(1, ...rankingProductos.map((r: any) => r.ventas));
  const maxTicketCanal = Math.max(1, ...ticketPorCanal.map((c: any) => c.ticket_promedio));
  const maxOrigen = Math.max(1, ...ventasPorOrigen.map((o: any) => o.ventas));

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-[var(--ink)]">Dashboard</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-0.5">Accesos rápidos y resumen general de la tienda</p>
      </div>

      {/* Tabs de página: Operativo / Métricas */}
      <div className="flex gap-1 border border-[var(--line)] rounded-xl p-1 bg-[var(--panel)] w-fit">
        <button onClick={() => setTab('operativo')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'operativo' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
          <LayoutGrid size={14} /> Operativo
        </button>
        <button onClick={() => setTab('metricas')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'metricas' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
          <TrendingUp size={14} /> Métricas
        </button>
      </div>

      {tab === 'operativo' ? (
        <div className="flex flex-col gap-8">
          {/* MÓDULOS — primero, sin scroll */}
          <div className="flex flex-col gap-6">
            {moduleGroups.map((group) => (
              <div key={group.label}>
                <h2 className="text-xs uppercase tracking-wider text-[var(--ink-soft)] font-medium mb-3">
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

          <div>
            <h2 className="text-sm font-medium text-[var(--ink)]">Resumen</h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">Lo que necesita atención ahora</p>
          </div>

          {statsError ? (
            <ErrorNote mensaje="No se pudieron cargar las métricas. Probá recargar la página." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {statsLoading || !stats
                ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
                : metricsOperativo.map((m) => (
                    <AdminCard key={m.label}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-[var(--ink-soft)]">{m.label}</span>
                        <div className={`w-8 h-8 ${m.bg} rounded-lg flex items-center justify-center`}>
                          <m.icon size={16} className={m.color} />
                        </div>
                      </div>
                      <div className="text-2xl font-medium text-[var(--ink)]">{m.value}</div>
                    </AdminCard>
                  ))}
            </div>
          )}

          {/* ÚLTIMAS ÓRDENES */}
          <AdminCard padded={false}>
            <div className="px-5 py-4 border-b border-[var(--line)] flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--ink)]">Últimas órdenes</h2>
              <Link to="/admin/ordenes" className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1">
                Ver todas <ArrowRight size={12} />
              </Link>
            </div>

            {ordenesError ? (
              <div className="p-5">
                <ErrorNote mensaje="No se pudieron cargar las órdenes. Probá recargar la página." />
              </div>
            ) : (
              <AdminTable
                columns={['Orden', 'Cliente', 'Total', 'Estado', 'Fecha']}
                isLoading={ordenesLoading}
                isEmpty={!ordenes || ordenes.length === 0}
                emptyMessage="No hay órdenes todavía"
              >
                {ordenes?.slice(0, 8).map((orden: any) => (
                  <tr key={orden.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
                    <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">#{orden.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-3 text-sm text-[var(--ink)]">
                      {orden.usuarios ? `${orden.usuarios.nombre} ${orden.usuarios.apellido}` : 'Invitado'}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-[var(--ink)]">${Number(orden.total).toLocaleString('es-AR')}</td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={orden.estado} />
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                      {new Date(orden.creado_en).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>

          {/* STOCK CRÍTICO */}
          {productosError ? (
            <ErrorNote mensaje="No se pudo cargar el stock. Probá recargar la página." />
          ) : productosLoading ? (
            <AdminCard padded={false}>
              <div className="px-5 py-4 border-b border-[var(--line)]">
                <h2 className="text-sm font-medium text-[var(--ink)]">Stock crítico</h2>
              </div>
              <div className="p-5 flex flex-col gap-3 animate-pulse">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 w-32 bg-[var(--n-100)] rounded mb-2" />
                      <div className="h-1.5 bg-[var(--n-100)] rounded-full" />
                    </div>
                    <div className="h-3 w-8 bg-[var(--n-100)] rounded" />
                  </div>
                ))}
              </div>
            </AdminCard>
          ) : stockCritico > 0 && (
            <AdminCard padded={false}>
              <div className="px-5 py-4 border-b border-[var(--line)]">
                <h2 className="text-sm font-medium text-[var(--ink)]">Stock crítico</h2>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {productosCriticos.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--ink)]">{p.nombre}</div>
                      <div className="h-1.5 bg-[var(--n-100)] rounded-full mt-1.5 overflow-hidden">
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
            </AdminCard>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Selector de rango — un solo control global, no uno por bloque
              (repetirlo 6 veces suma carga cognitiva y riesgo de mirar dos
              bloques con rangos distintos sin darse cuenta). */}
          <div className="flex gap-1.5">
            {RANGOS.map(r => (
              <button
                key={r.value}
                onClick={() => setRango(r.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${rango === r.value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--n-100)] text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Las compras de prueba (las que se marcan desde Órdenes → Gestionar)
              nunca entran en estas cifras: sin esta línea, un total más bajo
              que "todo lo que se compró" parece un bug. */}
          <p className="text-xs text-[var(--ink-soft)] -mt-3">No incluye órdenes de prueba.</p>

          {metricasError ? (
            <ErrorNote mensaje="No se pudieron cargar las métricas. Probá recargar la página." />
          ) : metricasLoading || !metricas ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiSkeleton /><KpiSkeleton />
            </div>
          ) : (
            <>
              {/* Resumen del período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AdminCard>
                  <div className="text-xs text-[var(--ink-soft)] mb-2">Ventas del período</div>
                  <div className="text-2xl font-medium text-[var(--ink)]">${metricas.periodo_actual.ventas.toLocaleString('es-AR')}</div>
                  <div className="mt-1 h-4"><Delta actual={metricas.periodo_actual.ventas} anterior={metricas.periodo_anterior?.ventas} /></div>
                </AdminCard>
                <AdminCard>
                  <div className="text-xs text-[var(--ink-soft)] mb-2">Ticket promedio</div>
                  <div className="text-2xl font-medium text-[var(--ink)]">${Math.round(metricas.periodo_actual.ticket_promedio).toLocaleString('es-AR')}</div>
                  <div className="mt-1 h-4"><Delta actual={metricas.periodo_actual.ticket_promedio} anterior={metricas.periodo_anterior?.ticket_promedio} /></div>
                </AdminCard>
              </div>

              {/* Tendencia de ventas — no se traza con un solo punto (rango
                  "hoy": no hay granularidad más fina que el día). */}
              {metricas.serie_temporal.length >= 2 ? (
                <AdminCard>
                  <div className="text-sm font-medium text-[var(--ink)] mb-3">Tendencia de ventas</div>
                  <GraficoTendencia serie={metricas.serie_temporal} />
                </AdminCard>
              ) : rango === 'hoy' && (
                <p className="text-xs text-[var(--ink-soft)] -mt-2">
                  La tendencia necesita más de un día — elegí 7D, 30D o Todo para verla.
                </p>
              )}

              {/* Ranking de productos */}
              <AdminCard padded={false}>
                <div className="px-5 py-4 border-b border-[var(--line)]">
                  <h2 className="text-sm font-medium text-[var(--ink)]">Productos más vendidos</h2>
                  <p className="text-xs text-[var(--ink-soft)] mt-0.5">Por facturación, en el período elegido</p>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {rankingProductos.length === 0 ? (
                    <p className="text-xs text-[var(--ink-soft)]">Sin ventas en este período.</p>
                  ) : rankingProductos.map((r: any) => (
                    <FilaConBarra
                      key={r.producto_id ?? r.nombre}
                      etiqueta={r.nombre}
                      valor={r.ventas}
                      maxValor={maxRanking}
                      valorLabel={`$${r.ventas.toLocaleString('es-AR')} · ${r.unidades} u.`}
                    />
                  ))}
                </div>
              </AdminCard>

              {/* Ticket promedio por canal + desglose de venta manual por
                  canal, lado a lado — son dos lecturas distintas (AOV vs.
                  volumen) que conviene ver juntas. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AdminCard padded={false}>
                  <div className="px-5 py-4 border-b border-[var(--line)]">
                    <h2 className="text-sm font-medium text-[var(--ink)]">Ticket promedio por canal</h2>
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {ticketPorCanal.length === 0 ? (
                      <p className="text-xs text-[var(--ink-soft)]">Sin ventas en este período.</p>
                    ) : ticketPorCanal.map((c: any) => (
                      <FilaConBarra
                        key={c.canal}
                        etiqueta={CANAL_LABELS[c.canal] ?? c.canal}
                        valor={c.ticket_promedio}
                        maxValor={maxTicketCanal}
                        valorLabel={`$${Math.round(c.ticket_promedio).toLocaleString('es-AR')} (${c.ordenes})`}
                      />
                    ))}
                  </div>
                </AdminCard>

                <AdminCard padded={false}>
                  <div className="px-5 py-4 border-b border-[var(--line)]">
                    <h2 className="text-sm font-medium text-[var(--ink)]">Ventas manuales por canal</h2>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">Instagram, feria, etc.</p>
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {ventasPorOrigen.length === 0 ? (
                      <p className="text-xs text-[var(--ink-soft)]">Sin ventas manuales con canal informado en este período.</p>
                    ) : ventasPorOrigen.map((o: any) => (
                      <FilaConBarra
                        key={o.origen_venta}
                        etiqueta={ORIGEN_VENTA_LABELS[o.origen_venta] ?? o.origen_venta}
                        valor={o.ventas}
                        maxValor={maxOrigen}
                        valorLabel={`$${o.ventas.toLocaleString('es-AR')} (${o.ordenes})`}
                      />
                    ))}
                  </div>
                </AdminCard>
              </div>

              {/* Personalización + cupones */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <AdminCard>
                  <div className="text-xs text-[var(--ink-soft)] mb-2">Con grabado personalizado</div>
                  <div className="text-2xl font-medium text-[var(--ink)]">{metricas.personalizacion.pct_con_grabado.toFixed(0)}%</div>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">
                    de {metricas.personalizacion.lineas_totales} {metricas.personalizacion.lineas_totales === 1 ? 'línea vendida' : 'líneas vendidas'}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div className="text-xs text-[var(--ink-soft)] mb-2">Con bombilla agregada</div>
                  <div className="text-2xl font-medium text-[var(--ink)]">{metricas.personalizacion.pct_con_bombilla.toFixed(0)}%</div>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">
                    de {metricas.personalizacion.lineas_totales} {metricas.personalizacion.lineas_totales === 1 ? 'línea vendida' : 'líneas vendidas'}
                  </div>
                </AdminCard>
                <AdminCard>
                  <div className="text-xs text-[var(--ink-soft)] mb-2">Órdenes con cupón</div>
                  <div className="text-2xl font-medium text-[var(--ink)]">
                    {metricas.cupones.ordenes_totales > 0 ? Math.round((metricas.cupones.ordenes_con_cupon / metricas.cupones.ordenes_totales) * 100) : 0}%
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">${metricas.cupones.descuento_total.toLocaleString('es-AR')} en descuentos</div>
                </AdminCard>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

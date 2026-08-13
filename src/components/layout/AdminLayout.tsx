import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Package, ShoppingBag, Tag, Truck, Settings, LogOut,
  ExternalLink, Layers, Wand2, CreditCard, Users, DollarSign, PackageSearch,
  ShieldCheck, FileText, History, Menu, X, PanelLeft, PanelLeftClose, Boxes,
} from 'lucide-react';

const SIDEBAR_STORAGE_KEY = 'admin-sidebar-expanded';
// Delay antes de abrir el panel flotante de una sección al pasar el mouse
// por su ícono en el rail colapsado — sin esto, cualquier recorrido del
// mouse de paso (ej. yendo hacia el toggle de arriba) dispara paneles que
// nadie pidió ver.
const PANEL_OPEN_DELAY = 150;
// Margen para que el mouse pueda viajar del ícono al panel (que está a la
// derecha, separado por unos px) sin que se cierre en el camino.
const PANEL_CLOSE_DELAY = 200;

// Exportados: son la fuente única de módulos del admin — el sidebar (acá
// abajo) y el grid de módulos del Dashboard (Dashboard.tsx) leen de la
// misma lista, así una sección/ruta nueva no se agrega en dos lugares.
export type NavItem = {
  label: string;
  icon: any;
  to?: string;
  end?: boolean;
  disabled?: boolean;
  // Solo la usa el grid de tarjetas del Dashboard — el sidebar la ignora.
  description?: string;
};

export type NavGroup = {
  label: string;
  icon: any; // ícono representativo de la sección, usado en el rail colapsado (nivel 1)
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: 'General',
    icon: LayoutDashboard,
    items: [
      { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Catálogo',
    icon: Boxes,
    items: [
      { to: '/admin/productos', label: 'Productos y variantes', icon: Package, description: 'Catálogo, precios, stock y variantes de cada producto.' },
      { to: '/admin/configuracion?tab=inicio', label: 'Page builder', icon: Layers, description: 'Editá las secciones del home de la tienda.' },
      { to: '/admin/configurador-v2', label: 'Diseñá tu mate', icon: Wand2, description: 'Configurador multi-step de personalización.' },
    ],
  },
  {
    label: 'Ventas y pagos',
    icon: ShoppingBag,
    items: [
      { to: '/admin/ordenes', label: 'Órdenes', icon: ShoppingBag, description: 'Seguimiento y gestión de pedidos.' },
      { to: '/admin/promociones-bancarias', label: 'Promociones bancarias', icon: CreditCard, description: 'Cuotas y descuentos por medio de pago.' },
      { to: '/admin/cupones', label: 'Cupones', icon: Tag, description: 'Códigos de descuento activos.' },
      { label: 'Pagos y transacciones', icon: DollarSign, disabled: true, description: 'Estado de pagos de Mercado Pago y webhooks.' },
    ],
  },
  {
    label: 'Envíos',
    icon: Truck,
    items: [
      { to: '/admin/envios', label: 'Zonas y tarifas', icon: Truck, description: 'Costos y cobertura de envío.' },
      { label: 'Logística privada', icon: PackageSearch, disabled: true, description: 'Gestión de envíos con transporte propio.' },
    ],
  },
  {
    label: 'Clientes',
    icon: Users,
    items: [
      { to: '/admin/usuarios?rol=cliente', label: 'Cuentas de compradores', icon: Users, description: 'Listado y gestión de clientes registrados.' },
    ],
  },
  {
    label: 'Sistema y legales',
    icon: ShieldCheck,
    items: [
      { to: '/admin/usuarios?rol=admin', label: 'Usuarios admin', icon: ShieldCheck, description: 'Cuentas con acceso al panel.' },
      { to: '/admin/configuracion?tab=tienda', label: 'Configuración del sitio', icon: Settings, description: 'Datos generales y medios de pago.' },
      { to: '/admin/configuracion?tab=paginas', label: 'Legales', icon: FileText, description: 'Términos, privacidad, FAQ y devoluciones.' },
      { label: 'Auditoría', icon: History, disabled: true, description: 'Historial de cambios y accesos.' },
    ],
  },
];

// Primera visita: no hay nada en localStorage todavía (nadie tocó el
// toggle). El default explícito es colapsado (rail de íconos) — no dejarlo
// librado a lo que devuelva JSON.parse(null) o un `??` mal puesto.
function getInitialExpanded(): boolean {
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored === null) return false;
  return stored === 'true';
}

// ¿La ruta actual (pathname + querystring) coincide con este ítem? Varios
// ítems comparten pathname y se distinguen solo por query (usuarios?rol=,
// configuracion?tab=), así que cuando el ítem define un query hay que
// exigir que matchee exacto — si no, dos ítems de secciones distintas
// (Clientes vs. Sistema y legales, por ejemplo) quedarían "activos" juntos.
function itemMatchesLocation(item: NavItem, pathname: string, search: string): boolean {
  if (!item.to) return false;
  const [itemPathname, itemQuery] = item.to.split('?');
  if (itemQuery) return pathname === itemPathname && search === `?${itemQuery}`;
  return pathname === itemPathname;
}

function groupIsActive(group: NavGroup, pathname: string, search: string): boolean {
  return group.items.some((item) => itemMatchesLocation(item, pathname, search));
}

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [expanded, setExpanded] = useState<boolean>(getInitialExpanded);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
  }, [expanded]);

  // Limpieza de timers pendientes si el componente se desmonta con el mouse
  // todavía sobre el rail (evita setState en un componente ya desmontado).
  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleOpenPanel = (label: string) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setHoveredGroup(label), PANEL_OPEN_DELAY);
  };
  const scheduleClosePanel = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoveredGroup(null), PANEL_CLOSE_DELAY);
  };
  const cancelClosePanel = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const closePanelNow = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setHoveredGroup(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobile = () => setMobileOpen(false);

  // Fila de ítem "con label" — usada en el nav expandido, el drawer mobile
  // y dentro de los paneles flotantes del rail colapsado (nivel 2). Ya no
  // tiene variante sin label: eso ahora lo resuelve el rail de secciones.
  const renderItem = (item: NavItem, onNavigate?: () => void) => {
    const { label, icon: Icon, to, end, disabled } = item;

    if (disabled || !to) {
      return (
        <div
          key={label}
          title="Aún no disponible"
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#4E8A76] opacity-60 cursor-not-allowed"
        >
          <Icon size={17} className="shrink-0" />
          <span className="flex items-center gap-2">
            {label}
            <span className="text-[10px] uppercase tracking-wide bg-[#0F6E56] text-[#9FE1CB] px-1.5 py-0.5 rounded">
              Próximamente
            </span>
          </span>
        </div>
      );
    }

    return (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-3 ${
            isActive
              ? 'bg-[#0F6E56] text-[#E1F5EE] font-medium border-[#5DCAA5]'
              : 'text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] border-transparent'
          }`
        }
      >
        <Icon size={17} className="shrink-0" />
        {label}
      </NavLink>
    );
  };

  // Nav "plano" con labels — expandido y drawer mobile, sin cambios de
  // comportamiento respecto de antes.
  const renderExpandedNav = (onNavigate?: () => void) => (
    <nav className="flex-1 py-4 overflow-y-auto">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-1">
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#4E8A76] font-medium">
            {group.label}
          </div>
          {group.items.map((item) => renderItem(item, onNavigate))}
        </div>
      ))}
    </nav>
  );

  // Rail colapsado de 2 niveles: nivel 1 es un ícono por SECCIÓN (no por
  // módulo); al hacer hover se abre un panel flotante con los módulos de
  // esa sección (nivel 2), con el mismo trato visual que el nav expandido.
  // BUG encontrado (reportado por Tami, reproducido con logs de consola):
  // el panel flotante (position absolute, left-full) se renderizaba en el
  // DOM con el contenido y estilos correctos, pero quedaba invisible.
  // Causa: `overflow-y-auto` en este <nav> hace que el browser compute
  // también `overflow-x: auto` (si fijás un eje no-visible, el otro deja
  // de ser 'visible' y pasa a 'auto' — comportamiento estándar de CSS, no
  // un bug del browser), y eso clipea cualquier hijo que se extienda a la
  // derecha del rail de 64px, como el panel. Con 6 ítems de sección el
  // scroll nunca hace falta acá (a diferencia del nav expandido, que sí
  // lo mantiene), así que se saca el overflow entero en vez de tapar el
  // síntoma con overflow-x-visible solo.
  const renderCollapsedRail = () => (
    <nav className="flex-1 py-4 overflow-visible">
      {navGroups.map((group) => {
        const SectionIcon = group.icon;
        const active = groupIsActive(group, location.pathname, location.search);
        const isOpen = hoveredGroup === group.label;
        return (
          <div
            key={group.label}
            className="relative mx-2 my-1"
            onMouseEnter={() => scheduleOpenPanel(group.label)}
            onMouseLeave={scheduleClosePanel}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              title={group.label}
              className={`w-full flex items-center justify-center py-3 rounded-xl transition-colors ${
                active
                  ? 'bg-[#0F6E56] text-[#E1F5EE]'
                  : 'text-[#9FE1CB] hover:bg-[#0F6E56]/60 hover:text-[#E1F5EE]'
              }`}
            >
              <SectionIcon size={22} />
            </button>

            {isOpen && (
              <div
                className="absolute left-full top-0 ml-2 w-56 bg-[#085041] rounded-xl shadow-xl py-2 z-50"
                onMouseEnter={cancelClosePanel}
                onMouseLeave={scheduleClosePanel}
              >
                <div className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-wider text-[#4E8A76] font-medium">
                  {group.label}
                </div>
                {group.items.map((item) => renderItem(item, closePanelNow))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Topbar mobile */}
      <div className="md:hidden flex items-center justify-between bg-[#085041] px-4 py-3 sticky top-0 z-40">
        <span className="text-[#E1F5EE] font-medium text-sm">
          mate<span className="text-[#5DCAA5]">laser</span> admin
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[#E1F5EE] p-1"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </div>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside
          className={`hidden md:flex flex-col fixed left-0 h-full bg-[#085041] transition-all duration-200 ${
            expanded ? 'w-56' : 'w-16'
          }`}
          style={{ top: 0 }}
        >
          <div className="flex items-center justify-between p-4 border-b border-[#0F6E56]">
            {expanded && (
              <span className="text-[#E1F5EE] font-medium text-sm truncate">
                mate<span className="text-[#5DCAA5]">laser</span> admin
              </span>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[#9FE1CB] hover:text-[#E1F5EE] p-1 shrink-0"
              aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
              title={expanded ? 'Colapsar menú' : 'Expandir menú'}
            >
              {expanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
          </div>

          {expanded ? renderExpandedNav() : renderCollapsedRail()}

          <div className="border-t border-[#0F6E56] py-3">
            <button
              onClick={() => navigate('/')}
              title="Ver tienda"
              className="group relative flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
            >
              <ExternalLink size={17} className="shrink-0" />
              {expanded && 'Ver tienda'}
              {!expanded && (
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#0F6E56] px-2 py-1 text-xs text-[#E1F5EE] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                  Ver tienda
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Salir"
              className="group relative flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
            >
              <LogOut size={17} className="shrink-0" />
              {expanded && 'Salir'}
              {!expanded && (
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#0F6E56] px-2 py-1 text-xs text-[#E1F5EE] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                  Salir
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <aside className="relative w-64 max-w-[80vw] h-full bg-[#085041] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-[#0F6E56]">
                <span className="text-[#E1F5EE] font-medium text-sm">
                  mate<span className="text-[#5DCAA5]">laser</span> admin
                </span>
                <button
                  onClick={closeMobile}
                  className="text-[#9FE1CB] hover:text-[#E1F5EE] p-1"
                  aria-label="Cerrar menú"
                >
                  <X size={20} />
                </button>
              </div>

              {renderExpandedNav(closeMobile)}

              <div className="border-t border-[#0F6E56] py-3">
                <button
                  onClick={() => { navigate('/'); closeMobile(); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
                >
                  <ExternalLink size={17} /> Ver tienda
                </button>
                <button
                  onClick={() => { handleLogout(); closeMobile(); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
                >
                  <LogOut size={17} /> Salir
                </button>
              </div>
            </aside>
          </div>
        )}

        <div className={`flex-1 bg-gray-50 min-h-screen transition-all duration-200 ${expanded ? 'md:ml-56' : 'md:ml-16'}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

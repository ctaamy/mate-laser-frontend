import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Package, ShoppingBag, Tag, Truck, Settings, LogOut,
  ExternalLink, Layers, Wand2, CreditCard, Users, DollarSign, PackageSearch,
  ShieldCheck, FileText, History, Menu, X, PanelLeft, PanelLeftClose, Boxes,
  ChevronDown,
} from 'lucide-react';
import logoBlanco from '../../assets/mls-logo-blanco.png';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
    setUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  const handleVerTienda = () => {
    setUserMenuOpen(false);
    navigate('/');
  };

  const closeMobile = () => setMobileOpen(false);

  // Fila de ítem "con label" — usada en el nav expandido, el drawer mobile
  // y dentro de los paneles flotantes del rail colapsado (nivel 2). Ya no
  // tiene variante sin label: eso ahora lo resuelve el rail de secciones.
  //
  // BUG encontrado (Fase 5e, Paso 0): el label + el badge "Próximamente" no
  // tenían wrap ni truncate — con labels largos ("Pagos y transacciones")
  // la fila era más ancha que los 224px de contenido del sidebar expandido,
  // y como el <nav> solo fijaba overflow-y-auto, el browser computaba
  // overflow-x:auto también (mismo mecanismo de CSS ya documentado abajo
  // para el rail colapsado), lo que convertía ese desborde en un scrollbar
  // horizontal real — y el texto "Próximamente" se veía cortado. Fix acá:
  // el label trunca con ellipsis (min-w-0 + truncate) y el badge nunca se
  // achica (shrink-0) — la fila no puede desbordar el ancho del sidebar.
  const renderItem = (item: NavItem, onNavigate?: () => void) => {
    const { label, icon: Icon, to, end, disabled } = item;

    if (disabled || !to) {
      return (
        <div
          key={label}
          title="Aún no disponible"
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--n-400)] opacity-60 cursor-not-allowed min-w-0"
        >
          <Icon size={17} className="shrink-0" />
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <span className="truncate">{label}</span>
            <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide bg-[var(--n-700)] text-[var(--n-300)] px-1.5 py-0.5 rounded">
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
          `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-3 min-w-0 ${
            isActive
              ? 'bg-[var(--accent)] text-white font-medium border-[var(--accent)]'
              : 'text-[var(--n-300)] hover:bg-[var(--n-800)] hover:text-[var(--n-50)] border-transparent'
          }`
        }
      >
        <Icon size={17} className="shrink-0" />
        <span className="truncate">{label}</span>
      </NavLink>
    );
  };

  // Nav "plano" con labels — expandido y drawer mobile, sin cambios de
  // comportamiento respecto de antes. overflow-x-hidden explícito (en vez
  // de depender del acople implícito overflow-y-auto → overflow-x:auto):
  // ahora que las filas nunca desbordan el ancho (ver renderItem), esto es
  // cinturón y tirantes, no la causa raíz del fix.
  const renderExpandedNav = (onNavigate?: () => void) => (
    <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-1">
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--n-400)] font-medium">
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
  // overflow-visible (no overflow-y-auto): con 6 ítems de sección el scroll
  // nunca hace falta acá, y fijar cualquier eje de overflow no-visible
  // clipearía el panel flotante que se extiende a la derecha del rail de
  // 64px (mismo mecanismo de CSS que el bug del Paso 0, documentado ahí).
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
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--n-300)] hover:bg-[var(--n-800)] hover:text-[var(--n-50)]'
              }`}
            >
              <SectionIcon size={22} />
            </button>

            {isOpen && (
              <div
                className="absolute left-full top-0 ml-2 w-56 bg-[var(--n-900)] border border-[var(--n-700)] rounded-xl shadow-xl py-2 z-50"
                onMouseEnter={cancelClosePanel}
                onMouseLeave={scheduleClosePanel}
              >
                <div className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-wider text-[var(--n-400)] font-medium">
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

  // Trigger del menú de usuario (reemplaza el footer fijo "Ver tienda" /
  // "Salir" de abajo — patrón tipo Notion/Linear: el logo/nombre de arriba
  // ES el trigger del dropdown). Libera todo el alto del sidebar para el
  // nav, que ya no compite por espacio con un footer fijo.
  const renderUserMenu = () => (
    <>
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
      )}
      <div
        className={`absolute z-50 bg-[var(--n-900)] border border-[var(--n-700)] rounded-xl shadow-xl py-1.5 ${
          expanded ? 'left-4 right-4 top-full mt-1.5' : 'left-full top-0 ml-2 w-40'
        }`}
      >
        <button
          onClick={handleVerTienda}
          className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--n-300)] hover:bg-[var(--n-800)] hover:text-[var(--n-50)] w-full transition-colors"
        >
          <ExternalLink size={15} className="shrink-0" /> Ver tienda
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--n-300)] hover:bg-[var(--n-800)] hover:text-[var(--n-50)] w-full transition-colors"
        >
          <LogOut size={15} className="shrink-0" /> Salir
        </button>
      </div>
    </>
  );

  return (
    // "tema-admin": activa los tokens de diseño de Fase 5a (index.css).
    <div className="tema-admin flex min-h-screen flex-col">
      {/* Topbar mobile */}
      <div className="md:hidden flex items-center justify-between bg-[var(--n-900)] px-4 py-3 sticky top-0 z-40">
        <span className="flex items-center gap-2 text-[var(--n-50)] font-medium text-sm">
          <img src={logoBlanco} alt="Mate Laser Studio" className="h-7 w-7 object-contain shrink-0" />
          mate<span className="text-[var(--accent)]">laser</span> admin
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[var(--n-50)] p-1"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </div>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside
          className={`hidden md:flex flex-col fixed left-0 h-full bg-[var(--n-900)] transition-all duration-200 ${
            expanded ? 'w-56' : 'w-16'
          }`}
          style={{ top: 0 }}
        >
          <div
            className={`relative flex items-center border-b border-[var(--n-700)] ${
              expanded ? 'justify-between p-4' : 'flex-col gap-2 py-4'
            }`}
          >
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              className={`flex items-center min-w-0 rounded-lg hover:bg-[var(--n-800)] transition-colors ${
                expanded ? 'flex-1 gap-2 px-1.5 py-1 -ml-1.5' : 'p-1'
              }`}
            >
              <img
                src={logoBlanco}
                alt="Mate Laser Studio"
                className={`object-contain shrink-0 ${expanded ? 'h-8' : 'h-7'}`}
              />
              {expanded && (
                <>
                  <span className="text-[var(--n-50)] font-medium text-sm truncate flex-1 text-left">
                    mate<span className="text-[var(--accent)]">laser</span> admin
                  </span>
                  <ChevronDown size={14} className={`text-[var(--n-400)] shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[var(--n-300)] hover:text-[var(--n-50)] p-1 shrink-0"
              aria-label={expanded ? 'Colapsar menú' : 'Expandir menú'}
              title={expanded ? 'Colapsar menú' : 'Expandir menú'}
            >
              {expanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>

            {userMenuOpen && renderUserMenu()}
          </div>

          {expanded ? renderExpandedNav() : renderCollapsedRail()}
        </aside>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <aside className="relative w-64 max-w-[80vw] h-full bg-[var(--n-900)] flex flex-col">
              <div className="relative flex items-center justify-between p-4 border-b border-[var(--n-700)]">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  className="flex items-center gap-2 min-w-0 flex-1 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-[var(--n-800)] transition-colors"
                >
                  <img src={logoBlanco} alt="Mate Laser Studio" className="h-7 w-7 object-contain shrink-0" />
                  <span className="text-[var(--n-50)] font-medium text-sm truncate flex-1 text-left">
                    mate<span className="text-[var(--accent)]">laser</span> admin
                  </span>
                  <ChevronDown size={14} className={`text-[var(--n-400)] shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={closeMobile}
                  className="text-[var(--n-300)] hover:text-[var(--n-50)] p-1 shrink-0"
                  aria-label="Cerrar menú"
                >
                  <X size={20} />
                </button>

                {userMenuOpen && renderUserMenu()}
              </div>

              {renderExpandedNav(closeMobile)}
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

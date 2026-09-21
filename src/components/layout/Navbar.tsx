import { useState, useEffect, useRef, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, X, Menu, ArrowRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuthStore } from '../../store/auth.store';
import { useCarritoStore } from '../../store/carrito.store';
import { useConfiguracion } from '../../hooks/useConfiguracion';
import { useHomepageSecciones } from '../../hooks/useHomepageSecciones';
import { useTemaGlobalData, cargarGoogleFont } from '../../hooks/useThemeGlobal';
import BuscadorConSugerencias from '../ui/BuscadorConSugerencias';
import { useCategoriasArbol } from '../../hooks/useCategoriasArbol';
import { track, trackEnlaceCatalogo } from '../../lib/analytics';
import MenuMobileLinks from './MenuMobileLinks';
import MegaMenuCategorias from './MegaMenuCategorias';
import SubmenuCategoria from './SubmenuCategoria';
import type { NodoCategoria } from '../../lib/categoriasArbol';

// Resuelve un valor booleano priorizando el bloque navbar (Fase 1) sobre
// las claves legacy sueltas de /configuracion (Fase 0 y anteriores).
function boolFrom(seccionVal: any, legacyVal: any, def = true): boolean {
  if (seccionVal !== undefined) return !!seccionVal;
  if (legacyVal !== undefined) return legacyVal !== 'false';
  return def;
}

interface NavLink { label: string; href: string }

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Productos', href: '/productos' },
  { label: 'Diseños', href: '/productos?categoria_id=20' },
  { label: 'Taller', href: '/nosotros' },
];

// ── Ícono de acción con animación ─────────────────────────────────────────────
function IconBtn({ onClick, active, children, badge, navColor, navBg, ariaLabel }: {
  onClick?: () => void; active?: boolean; children: React.ReactNode;
  badge?: number; navColor: string; navBg: string; ariaLabel?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative w-10 h-10 flex items-center justify-center rounded-xl overflow-hidden"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      style={{ color: active ? navBg : navColor }}
    >
      {/* Fondo animado al hacer hover */}
      <motion.span
        className="absolute inset-0 rounded-xl"
        style={{ backgroundColor: navColor }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: active ? 1 : 0.08 }}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.18 }}
      />
      <span className="relative z-10">{children}</span>

      {/* Badge */}
      <AnimatePresence>
        {badge != null && badge > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute top-0.5 right-0.5 text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none z-20"
            style={{ backgroundColor: navColor, color: navBg }}>
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function Navbar() {
  const { isAuthenticated, usuario, logout } = useAuthStore();
  const cantidadItems = useCarritoStore(s => s.items.reduce((acc, i) => acc + i.cantidad, 0));
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Desplegables de categorías del navbar (desktop, solo menú Tradicional): a
  // lo sumo uno abierto, identificado por el href de su link. "/productos" abre
  // el panel ancho con todas las categorías; un link a /productos?categoria_id=N
  // de una raíz con subcategorías (ej. "Diseños") abre un desplegable compacto.
  const [submenu, setSubmenu] = useState<string | null>(null);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const punteroTactil = useRef(false);
  // Cómo se abrió el desplegable (para la métrica nav_desplegable_abre).
  const viaSubmenu = useRef<'mouse' | 'toque' | 'teclado' | 'click'>('mouse');

  const { data: config } = useConfiguracion();
  const { data: secciones } = useHomepageSecciones();
  const tema = useTemaGlobalData();
  const { raices } = useCategoriasArbol({ ocultarVacias: true });

  // El navbar es un bloque más (tipo 'navbar') dentro de homepage_sections,
  // igual que el resto de las secciones. Mientras conviva con instalaciones
  // que aún no lo migraron, cae a las claves sueltas legacy (navbar_* en
  // /configuracion) y, si tampoco existen, al tema global.
  const navbarSec = secciones?.find(s => s.tipo === 'navbar');
  const navDatos: Record<string, any> = navbarSec?.datos ?? {};

  const nombreTienda: string = config?.nombre_tienda || 'matelaser studio';
  // Los links viven en datos.links del bloque navbar (editables con
  // agregar/quitar/reordenar); mientras conviva con instalaciones que aún no
  // migraron, cae a la clave suelta legacy nav_links.
  const navLinks: NavLink[] = (() => {
    if (Array.isArray(navDatos.links)) return navDatos.links;
    const raw = config?.nav_links;
    if (!raw) return DEFAULT_LINKS;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return DEFAULT_LINKS; }
  })();
  // Tipo de menú (Fase 3): 'tradicional' muestra los links inline en
  // desktop/tablet; 'hamburguesa' los agrupa en el mismo menú desplegable
  // que mobile. En mobile SIEMPRE es hamburguesa sin importar esta opción
  // (patrón estándar de ecommerce — evita que muchos links rompan el layout).
  const tipoMenu: 'tradicional' | 'hamburguesa' = navDatos.tipo_menu === 'hamburguesa' ? 'hamburguesa' : 'tradicional';
  // Posición del ícono hamburguesa (Fase 4): aplica siempre en mobile y
  // también en desktop/tablet si tipoMenu es 'hamburguesa'. El menú
  // desplegable se alinea al mismo lado que el ícono — es lo que el usuario
  // espera (el menú "sale" del botón que tocó).
  const menuPosicion: 'izquierda' | 'derecha' = navDatos.menu_posicion === 'izquierda' ? 'izquierda' : 'derecha';
  // Toggle del admin (default activo): el link a /productos despliega las categorías.
  const menuCategorias: boolean = navDatos.menu_categorias !== false && tipoMenu === 'tradicional' && raices.length > 0;

  const navBg: string = navDatos.bg_color || config?.navbar_bg_color || tema.bg_color;
  const navColor: string = navDatos.texto_color || config?.navbar_texto_color || tema.texto_color;
  const navFontFamily: string | undefined = navDatos.font_family || tema.font_family || undefined;
  const navBorder: string = navDatos.border_color || config?.navbar_border_color || '#f3f4f6';
  const logoUrl: string = navDatos.logo_url || config?.navbar_logo_url || '';
  const logoAlto: number = parseInt(navDatos.logo_alto ?? config?.navbar_logo_alto ?? '32') || 32;
  // Alto de la barra en sm+: se adapta al logo configurado (con aire
  // arriba/abajo) en vez de quedar fijo en 64px — así un logo grande no se
  // recorta ni desborda. Nunca baja de 64px (el mínimo de siempre, con solo
  // texto). En mobile la barra queda SIEMPRE en 64px (h-16): el <img> del
  // logo está capado a max-h-10 (40px) en pantallas chicas, y 40 + 24 = 64,
  // así que crecer más sería solo espacio muerto. Se expone como var CSS
  // --nav-h para que la barra (sm:h-[var(--nav-h)]) y el offset del menú
  // desplegable mobile (sm:top-[var(--nav-h)]) compartan el mismo valor sin
  // desalinearse si la barra crece.
  const navAltura: number = Math.max(64, logoUrl ? logoAlto + 24 : 64);
  const mostrarBuscar: boolean = boolFrom(navDatos.mostrar_buscar, config?.navbar_mostrar_buscar);
  const mostrarUsuario: boolean = boolFrom(navDatos.mostrar_usuario, config?.navbar_mostrar_usuario);
  const mostrarCarrito: boolean = boolFrom(navDatos.mostrar_carrito, config?.navbar_mostrar_carrito);
  // Modo del buscador en desktop/tablet (Fase 2 — antes era fijo "siempre
  // visible" sin forma de volver atrás): 'siempre_visible' es la píldora
  // expandida por defecto; 'icono' devuelve el comportamiento previo
  // (ícono que abre un panel desplegable), igual que en mobile siempre.
  const buscadorModo: 'siempre_visible' | 'icono' = navDatos.buscador_modo === 'icono' ? 'icono' : 'siempre_visible';
  // Colores del buscador: 'fijo' es la píldora blanca (no depende del tema,
  // se lee igual sobre cualquier navbar); 'heredar' usa los mismos colores
  // configurados para el navbar (bg_color/texto_color/border_color).
  const buscadorColores: 'fijo' | 'heredar' = navDatos.buscador_colores === 'heredar' ? 'heredar' : 'fijo';
  const searchBg = buscadorColores === 'heredar' ? `${navColor}0d` : '#ffffff';
  const searchTextColor = buscadorColores === 'heredar' ? navColor : '#111827';
  const searchIconColor = buscadorColores === 'heredar' ? `${navColor}80` : '#6b7280';
  const searchBorder = buscadorColores === 'heredar' ? navBorder : 'transparent';

  useEffect(() => {
    if (navFontFamily) cargarGoogleFont(navFontFamily);
  }, [navFontFamily]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Depende también de `search`: las categorías navegan a /productos?categoria_id=N,
  // así que estando ya en /productos cambia solo el query y el menú quedaba abierto.
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setUserOpen(false); clearTimeout(megaTimer.current); setSubmenu(null); }, [location.pathname, location.search]);

  // Hover con intención: abre a los 120ms y cierra a los 200ms, así cruzar
  // en diagonal hacia el panel no lo cierra, ni un roce accidental lo abre.
  const programarSubmenu = (key: string | null, ms: number) => {
    clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => { if (key) viaSubmenu.current = 'mouse'; setSubmenu(key); }, ms);
  };
  useEffect(() => () => clearTimeout(megaTimer.current), []);

  // Métrica: cada vez que un desplegable pasa a abierto (no al cerrar ni al cambiar de página).
  useEffect(() => {
    if (!submenu) return;
    track('nav_desplegable_abre', { menu: navLinks.find((l) => l.href === submenu)?.label ?? submenu, via: viaSubmenu.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submenu]);

  const porKey = (attr: 'submenuTrigger' | 'submenuPanel', key: string | null) =>
    [...document.querySelectorAll<HTMLElement>(`[data-submenu-${attr === 'submenuTrigger' ? 'trigger' : 'panel'}]`)]
      .find((el) => el.dataset[attr] === key);

  // Abierto: Esc lo cierra (devolviendo el foco al disparador) y un toque/click
  // afuera también.
  useEffect(() => {
    if (!submenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSubmenu(null); porKey('submenuTrigger', submenu)?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-mega]')) setSubmenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [submenu]);

  // Abre el panel y manda el foco al primer link (teclado / lector de pantalla).
  const abrirSubmenuConTeclado = (key: string) => {
    clearTimeout(megaTimer.current);
    viaSubmenu.current = 'teclado';
    setSubmenu(key);
    setTimeout(() => porKey('submenuPanel', key)?.querySelector<HTMLElement>('a')?.focus(), 30);
  };

  // Link del navbar → raíz con subcategorías visibles (null si no aplica).
  const raizDeLink = (href: string): NodoCategoria | null => {
    const [ruta, query = ''] = href.split('?');
    if (ruta !== '/productos') return null;
    const id = Number(new URLSearchParams(query).get('categoria_id'));
    return raices.find((r) => r.id === id && r.hijas.length > 0) ?? null;
  };

  // Menú abierto: Esc lo cierra y el scroll del fondo queda trabado (el panel
  // tiene su propio scroll interno; sin esto la página se mueve por detrás).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuOpen]);

  // Cierra el dropdown del usuario al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    if (userOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userOpen]);

  const handleLogout = () => { logout(); navigate('/'); };

  const buscarLibre = (q: string) => {
    if (q.trim()) navigate(`/productos?q=${encodeURIComponent(q.trim())}`);
    setSearchOpen(false);
    setSearchQ('');
  };

  const partes = nombreTienda.match(/^(\S+)(.*)$/) ?? [nombreTienda, nombreTienda, ''];
  const palabraClave = partes[1];
  const resto = partes[2];

  // Hamburguesa — siempre visible en mobile; en desktop/tablet solo si el
  // admin eligió el tipo de menú Hamburguesa. Se ubica junto al logo (a la
  // izquierda) o entre las acciones (a la derecha) según menuPosicion.
  const botonHamburguesa = (
    <motion.button
      onClick={() => setMenuOpen(s => !s)}
      aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
      aria-expanded={menuOpen}
      className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}`}
      style={{ color: navColor }}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait">
        {menuOpen
          ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={18} /></motion.span>
          : <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu size={18} /></motion.span>
        }
      </AnimatePresence>
    </motion.button>
  );

  return (
    <>
      <motion.nav
        className="sticky top-0 z-50"
        animate={{
          backdropFilter: scrolled ? 'blur(12px)' : 'blur(0px)',
          boxShadow: scrolled ? '0 1px 24px rgba(0,0,0,0.07)' : '0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.3 }}
        style={{
          backgroundColor: scrolled ? `${navBg}e8` : navBg,
          borderBottom: `1px solid ${scrolled ? 'transparent' : navBorder}`,
          color: navColor,
          fontFamily: navFontFamily,
        }}
      >
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-6 h-16 sm:h-[var(--nav-h)]"
          style={{ '--nav-h': `${navAltura}px` } as React.CSSProperties}
        >

          {/* Logo — agrupado con la hamburguesa cuando su posición es
              "izquierda", para que no se desancle del borde izquierdo. */}
          <div className="flex items-center gap-3">
          {menuPosicion === 'izquierda' && botonHamburguesa}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2.5 group">
            {/* Nombre de la tienda: va primero (invertido respecto del logo)
                y más grande, para que la marca se lea de un vistazo. El alto
                del bloque no cambia — sigue determinado por navAltura/logoAlto,
                el texto solo crece dentro del mismo alto (leading-none + items-center). */}
            {/* Con logo propio subido, en mobile se muestra SOLO el logo — el
                nombre + el logo juntos no entran a 375px y el texto terminaba
                metiéndose abajo de los íconos de acción. En sm+ se ven los dos. */}
            <motion.div className={`items-center gap-1.5 notranslate ${logoUrl ? 'hidden sm:flex' : 'flex'}`} translate="no" whileHover={{ x: 2 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <span className="text-xl sm:text-2xl tracking-tight font-bold leading-none" style={{ color: navColor }}>
                {palabraClave}
              </span>
              {resto && (
                <span className="text-xl sm:text-2xl tracking-tight font-light leading-none" style={{ color: navColor, opacity: 0.45 }}>
                  {resto}
                </span>
              )}
              {/* Punto decorativo — solo cuando no hay logo propio, para no
                  competir visualmente con una imagen de marca real. */}
              {!logoUrl && (
                <motion.span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: navColor, opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>
            {logoUrl && (
              // Cap responsive: en mobile nunca supera 40px aunque el admin
              // configure un logo grande para desktop — evita que la barra
              // se vuelva gigante en pantallas chicas. En sm+ usa el alto
              // configurado tal cual.
              <motion.img
                src={logoUrl} alt={nombreTienda}
                style={{ height: logoAlto }}
                className="object-contain w-auto max-h-10 sm:max-h-none flex-shrink-0"
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              />
            )}
          </Link>
          </div>

          {/* Links — desktop con pill hover (solo en modo Tradicional; en
              Hamburguesa se agrupan en el mismo menú desplegable que mobile) */}
          {tipoMenu === 'tradicional' && (
          <div className="hidden md:flex items-center gap-1 self-stretch" onMouseLeave={() => setHoveredLink(null)}>
            {navLinks.map(link => {
              const active = location.pathname === link.href ||
                (link.href !== '/' && location.pathname + location.search === link.href);
              const isHovered = hoveredLink === link.href;

              const esMega = menuCategorias && link.href === '/productos';
              const raizSub = menuCategorias && !esMega ? raizDeLink(link.href) : null;
              const tieneSub = esMega || !!raizSub;
              const abierto = submenu === link.href;
              const enlace = (
                <Link
                  to={link.href}
                  onClick={(e) => {
                    if (tieneSub) {
                      // Touch/lápiz: el primer toque despliega, el segundo navega
                      // (el "ver todo" está adentro del panel). Ese primer toque no
                      // navega, así que tampoco cuenta como click en la categoría.
                      if (punteroTactil.current && !abierto) {
                        e.preventDefault(); clearTimeout(megaTimer.current); viaSubmenu.current = 'toque'; setSubmenu(link.href);
                        return;
                      }
                      clearTimeout(megaTimer.current); setSubmenu(null);
                    }
                    trackEnlaceCatalogo('navbar_link', link.href, raices);
                  }}
                  className="relative px-5 py-2.5 text-base rounded-xl select-none"
                  style={{
                    color: active ? navColor : isHovered ? navColor : `${navColor}80`,
                    fontWeight: active ? 700 : isHovered ? 600 : 500,
                    transition: 'color 0.15s, font-weight 0.15s',
                  }}
                  onMouseEnter={() => setHoveredLink(link.href)}
                >
                  {/* Fondo de hover — bien visible para que quede claro dónde
                      está el mouse (antes era casi imperceptible: 0.06 de opacidad) */}
                  {isHovered && !active && (
                    <motion.span
                      layoutId="hover-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ backgroundColor: navColor, opacity: 0.14 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.14 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    />
                  )}
                  {/* Estado activo: fondo sólido + underline, para distinguirlo
                      claramente del simple hover */}
                  {active && (
                    <motion.span
                      layoutId="active-bg"
                      className="absolute inset-0 rounded-xl"
                      style={{ backgroundColor: navColor, opacity: 0.1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {active && (
                    <motion.span
                      layoutId="active-underline"
                      className="absolute bottom-1.5 left-5 right-5 h-[3px] rounded-full"
                      style={{ backgroundColor: navColor }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
              if (!tieneSub) return <Fragment key={link.href}>{enlace}</Fragment>;
              const panelId = esMega ? 'mega-categorias' : `submenu-categoria-${raizSub!.id}`;
              return (
                <div
                  key={link.href}
                  data-mega
                  className="relative flex items-center self-stretch"
                  onPointerDown={(e) => { punteroTactil.current = e.pointerType !== 'mouse'; }}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') programarSubmenu(link.href, 120); }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') programarSubmenu(null, 200); }}
                  onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); abrirSubmenuConTeclado(link.href); } }}
                >
                  {enlace}
                  <button
                    data-submenu-trigger={link.href}
                    type="button"
                    aria-label={esMega ? 'Ver categorías' : `Ver subcategorías de ${link.label}`}
                    aria-expanded={abierto}
                    aria-controls={panelId}
                    onClick={(e) => { if (abierto) { clearTimeout(megaTimer.current); setSubmenu(null); } else if (e.detail === 0) abrirSubmenuConTeclado(link.href); else { clearTimeout(megaTimer.current); viaSubmenu.current = punteroTactil.current ? 'toque' : 'click'; setSubmenu(link.href); } }}
                    className="-ml-3 mr-1 flex h-9 w-7 items-center justify-center rounded-lg"
                    style={{ color: navColor, opacity: 0.6 }}
                  >
                    <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Desplegable compacto de una categoría raíz: dentro del wrapper (que
                      ocupa todo el alto de la barra), pegado a su base. El ancho lo
                      maneja el panel de "Productos", que vive aparte en el <nav>. */}
                  <AnimatePresence>
                    {raizSub && abierto && (
                      <motion.div
                        id={panelId}
                        data-submenu-panel={link.href}
                        initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                        className="absolute left-0 top-full z-40 min-w-56 rounded-b-xl border border-t-0 shadow-xl"
                        style={{ backgroundColor: navBg, borderColor: navBorder, color: navColor }}
                      >
                        <SubmenuCategoria raiz={raizSub} navBorder={navBorder} onNavigate={() => { clearTimeout(megaTimer.current); setSubmenu(null); }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-0.5 sm:gap-3">
            {mostrarBuscar && (
              <>
                {/* Desktop/tablet, modo "siempre visible" (default): buscador
                    fijo en el lugar del ícono, expandido. Colores según
                    buscadorColores — 'fijo' es una píldora blanca que no
                    depende del tema; 'heredar' usa los colores del navbar. */}
                {buscadorModo === 'siempre_visible' && (
                  <BuscadorConSugerencias
                    value={searchQ}
                    onChange={setSearchQ}
                    onSubmitLibre={buscarLibre}
                    onNavegar={() => setSearchQ('')}
                    placeholder="Buscar"
                    className="hidden md:block"
                    inputClassName="w-64 lg:w-80 text-[15px] rounded-full pl-9 pr-4 py-3 outline-none shadow-sm"
                    inputStyle={{ backgroundColor: searchBg, color: searchTextColor, border: `1px solid ${searchBorder}` }}
                    iconColor={searchIconColor}
                  />
                )}

                {/* Mobile siempre, y también desktop/tablet si el modo elegido
                    es "icono" (vuelve al comportamiento previo: ícono que abre
                    un panel desplegable debajo de la barra). */}
                <div className={buscadorModo === 'icono' ? '' : 'md:hidden'}>
                  <IconBtn
                    onClick={() => setSearchOpen(s => !s)}
                    active={searchOpen}
                    navColor={navColor}
                    navBg={navBg}
                  >
                    {searchOpen ? <X size={16} /> : <Search size={16} />}
                  </IconBtn>
                </div>
              </>
            )}

            {mostrarUsuario && (
              isAuthenticated ? (
                <div ref={userRef} className="relative">
                  <IconBtn
                    onClick={() => setUserOpen(s => !s)}
                    active={userOpen}
                    navColor={navColor}
                    navBg={navBg}
                    ariaLabel="Cuenta"
                  >
                    <User size={16} />
                  </IconBtn>

                  <AnimatePresence>
                    {userOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 w-48 z-50 overflow-hidden"
                      >
                        <div className="px-4 py-2 border-b border-gray-50 mb-1">
                          <p className="text-[11px] text-gray-400 font-medium">Hola,</p>
                          <p className="text-sm font-semibold text-gray-900 truncate">{usuario?.nombre}</p>
                        </div>
                        <Link to="/mi-cuenta"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors group">
                          Mi cuenta
                          <ArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </Link>
                        {usuario?.rol === 'admin' && (
                          <Link to="/admin"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors group">
                            Panel admin
                            <ArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </Link>
                        )}
                        <button onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                          Cerrar sesión
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/login">
                  <IconBtn navColor={navColor} navBg={navBg}>
                    <User size={16} />
                  </IconBtn>
                </Link>
              )
            )}

            {mostrarCarrito && (
              <Link to="/carrito">
                <IconBtn badge={cantidadItems} navColor={navColor} navBg={navBg}>
                  <ShoppingCart size={16} />
                </IconBtn>
              </Link>
            )}

            {menuPosicion === 'derecha' && botonHamburguesa}
          </div>
        </div>

        {/* Desplegable de categorías (desktop). Es un <div> dentro de este <nav>,
            no un <nav> nuevo: los tests y el panel mobile usan `nav` como selector. */}
        <AnimatePresence>
          {menuCategorias && submenu === '/productos' && (
            <motion.div
              id="mega-categorias"
              data-mega
              data-submenu-panel="/productos"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              className="absolute left-0 right-0 top-full z-40 hidden md:block border-t shadow-xl"
              style={{ backgroundColor: navBg, borderColor: navBorder, color: navColor }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') clearTimeout(megaTimer.current); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') programarSubmenu(null, 200); }}
            >
              <MegaMenuCategorias raices={raices} navBorder={navBorder} onNavigate={() => { clearTimeout(megaTimer.current); setSubmenu(null); }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra de búsqueda expandible */}
        <AnimatePresence>
          {searchOpen && mostrarBuscar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={`overflow-hidden ${buscadorModo === 'icono' ? '' : 'md:hidden'}`}
              style={{ borderTop: `1px solid ${navBorder}` }}
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-start gap-3">
                <BuscadorConSugerencias
                  value={searchQ}
                  onChange={setSearchQ}
                  onSubmitLibre={buscarLibre}
                  onNavegar={() => { setSearchQ(''); setSearchOpen(false); }}
                  autoFocus
                  placeholder="¿Qué estás buscando?"
                  className="flex-1"
                  inputClassName="w-full text-sm outline-none bg-transparent pl-8 pr-2 py-1"
                  inputStyle={{ color: navColor }}
                  iconColor={`${navColor}66`}
                  dropdown="inline"
                />
                <button type="button" onClick={() => setSearchOpen(false)}
                  style={{ color: navColor, opacity: 0.35 }}
                  className="hover:opacity-70 transition-opacity flex-shrink-0 mt-1.5">
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Menú desplegable — siempre disponible en mobile; en desktop/tablet
          solo se monta si el tipo de menú es Hamburguesa (ver tipoMenu).
          Dropdown angosto anclado al mismo lado del ícono (menuPosicion) —
          no es un overlay completo ni un drawer lateral: no cubre el resto
          de la pantalla, por eso el "overlay" de click-afuera es invisible
          (solo cierra el menú, no oscurece nada). */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Capa invisible para cerrar al clickear afuera */}
            <motion.div
              className={`fixed inset-x-0 bottom-0 z-30 top-16 sm:top-[var(--nav-h)] ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}`}
              style={{ '--nav-h': `${navAltura}px` } as React.CSSProperties}
              onClick={() => setMenuOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={`fixed z-40 shadow-2xl rounded-b-2xl border w-72 max-w-[calc(100vw-1.5rem)] top-16 sm:top-[var(--nav-h)] max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-var(--nav-h))] overflow-y-auto overscroll-contain
                ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}
                ${menuPosicion === 'izquierda' ? 'left-3' : 'right-3'}`}
              style={{ '--nav-h': `${navAltura}px`, backgroundColor: navBg, borderColor: navBorder, fontFamily: navFontFamily } as React.CSSProperties}
            >
              {/* Cualquier link del panel cierra el menú, incluso si la URL
                  no cambia (misma categoría): el efecto sobre location solo
                  cubre las navegaciones que sí la cambian. */}
              <nav className="px-4 py-3 flex flex-col gap-1"
                onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}>
                <MenuMobileLinks
                  navLinks={navLinks}
                  raices={raices}
                  navColor={navColor}
                  pathname={location.pathname}
                  search={location.search}
                />
              </nav>

              {/* Acciones rápidas mobile */}
              {mostrarUsuario && (
                isAuthenticated ? (
                  <div className="px-4 pb-4">
                    <Link to="/mi-cuenta"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors"
                      style={{ backgroundColor: navColor, color: navBg }}>
                      <User size={15} /> Mi cuenta
                    </Link>
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <Link to="/login"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors"
                      style={{ backgroundColor: navColor, color: navBg }}>
                      <User size={15} /> Iniciar sesión
                    </Link>
                  </div>
                )
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

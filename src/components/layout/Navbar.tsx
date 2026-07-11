import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, X, Menu, ArrowRight, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { useCarritoStore } from '../../store/carrito.store';
import { useConfiguracion } from '../../hooks/useConfiguracion';
import { useHomepageSecciones } from '../../hooks/useHomepageSecciones';
import { useTemaGlobalData, cargarGoogleFont } from '../../hooks/useThemeGlobal';
import api from '../../lib/api';
import type { Categoria } from '../../types';

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
  { label: 'Personalizado', href: '/productos?personalizado=true' },
  { label: 'Nosotros', href: '/#nosotros' },
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
      className="relative w-9 h-9 flex items-center justify-center rounded-xl overflow-hidden"
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

  const { data: config } = useConfiguracion();
  const { data: secciones } = useHomepageSecciones();
  const tema = useTemaGlobalData();
  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  });
  const raices = categorias?.filter(c => !c.padre_id) ?? [];

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

  const navBg: string = navDatos.bg_color || config?.navbar_bg_color || tema.bg_color;
  const navColor: string = navDatos.texto_color || config?.navbar_texto_color || tema.texto_color;
  const navFontFamily: string | undefined = navDatos.font_family || tema.font_family || undefined;
  const navBorder: string = navDatos.border_color || config?.navbar_border_color || '#f3f4f6';
  const logoUrl: string = navDatos.logo_url || config?.navbar_logo_url || '';
  const logoAlto: number = parseInt(navDatos.logo_alto ?? config?.navbar_logo_alto ?? '32') || 32;
  const mostrarBuscar: boolean = boolFrom(navDatos.mostrar_buscar, config?.navbar_mostrar_buscar);
  const mostrarUsuario: boolean = boolFrom(navDatos.mostrar_usuario, config?.navbar_mostrar_usuario);
  const mostrarCarrito: boolean = boolFrom(navDatos.mostrar_carrito, config?.navbar_mostrar_carrito);

  useEffect(() => {
    if (navFontFamily) cargarGoogleFont(navFontFamily);
  }, [navFontFamily]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); setUserOpen(false); }, [location.pathname]);

  // Cierra el dropdown del usuario al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    if (userOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userOpen]);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQ.trim()) {
      navigate(`/productos?q=${encodeURIComponent(searchQ.trim())}`);
      setSearchOpen(false);
      setSearchQ('');
    }
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
      className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}`}
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
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Logo — agrupado con la hamburguesa cuando su posición es
              "izquierda", para que no se desancle del borde izquierdo. */}
          <div className="flex items-center gap-3">
          {menuPosicion === 'izquierda' && botonHamburguesa}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
            {logoUrl
              ? <motion.img
                  src={logoUrl} alt={nombreTienda}
                  style={{ height: logoAlto }}
                  className="object-contain"
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                />
              : <motion.div className="flex items-center gap-1.5" whileHover={{ x: 2 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                  <span className="text-[17px] tracking-tight font-semibold leading-none" style={{ color: navColor }}>
                    {palabraClave}
                  </span>
                  {resto && (
                    <span className="text-[17px] tracking-tight font-light leading-none" style={{ color: navColor, opacity: 0.45 }}>
                      {resto}
                    </span>
                  )}
                  {/* Punto decorativo */}
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: navColor, opacity: 0.3 }}
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
            }
          </Link>
          </div>

          {/* Links — desktop con pill hover (solo en modo Tradicional; en
              Hamburguesa se agrupan en el mismo menú desplegable que mobile) */}
          {tipoMenu === 'tradicional' && (
          <div className="hidden md:flex items-center gap-0.5" onMouseLeave={() => setHoveredLink(null)}>
            {navLinks.map(link => {
              const active = location.pathname === link.href ||
                (link.href !== '/' && location.pathname + location.search === link.href);
              const isHovered = hoveredLink === link.href;

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className="relative px-4 py-2 text-sm rounded-xl select-none"
                  style={{
                    color: active ? navColor : isHovered ? navColor : `${navColor}70`,
                    fontWeight: active ? 600 : 400,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={() => setHoveredLink(link.href)}
                >
                  {/* Pill de hover */}
                  {isHovered && !active && (
                    <motion.span
                      layoutId="hover-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ backgroundColor: navColor, opacity: 0.06 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.06 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    />
                  )}
                  {/* Indicador activo (underline animado) */}
                  {active && (
                    <motion.span
                      layoutId="active-underline"
                      className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full"
                      style={{ backgroundColor: navColor }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-0.5">
            {mostrarBuscar && (
              <IconBtn
                onClick={() => setSearchOpen(s => !s)}
                active={searchOpen}
                navColor={navColor}
                navBg={navBg}
              >
                {searchOpen ? <X size={16} /> : <Search size={16} />}
              </IconBtn>
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

        {/* Barra de búsqueda expandible */}
        <AnimatePresence>
          {searchOpen && mostrarBuscar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
              style={{ borderTop: `1px solid ${navBorder}` }}
            >
              <form onSubmit={handleSearch} className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
                <Search size={14} style={{ color: navColor, opacity: 0.4 }} className="flex-shrink-0" />
                <input
                  autoFocus
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="¿Qué estás buscando?"
                  className="flex-1 text-sm outline-none bg-transparent"
                  style={{ color: navColor }}
                />
                {searchQ && (
                  <motion.button
                    type="submit"
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: navColor, color: navBg }}
                  >
                    Buscar
                  </motion.button>
                )}
                <button type="button" onClick={() => setSearchOpen(false)}
                  style={{ color: navColor, opacity: 0.35 }}
                  className="hover:opacity-70 transition-opacity">
                  <X size={15} />
                </button>
              </form>
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
              className={`fixed inset-0 top-16 z-30 ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}`}
              onClick={() => setMenuOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className={`fixed top-16 z-40 shadow-2xl rounded-b-2xl border w-72 max-w-[calc(100vw-1.5rem)]
                ${tipoMenu === 'tradicional' ? 'md:hidden' : ''}
                ${menuPosicion === 'izquierda' ? 'left-3' : 'right-3'}`}
              style={{ backgroundColor: navBg, borderColor: navBorder, fontFamily: navFontFamily }}
            >
              <nav className="px-4 py-3 flex flex-col gap-1">
                {navLinks.map((link, i) => {
                  const active = location.pathname === link.href;
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <Link
                        to={link.href}
                        className="flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors"
                        style={{
                          color: navColor,
                          backgroundColor: active ? `${navColor}0d` : 'transparent',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {link.label}
                        {active && <motion.span layoutId="mobile-dot" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: navColor }} />}
                      </Link>
                    </motion.div>
                  );
                })}

                {raices.length > 0 && (
                  <>
                    <div className="my-1 mx-4 h-px" style={{ backgroundColor: `${navColor}15` }} />
                    {raices.map((cat, i) => {
                      const hijos = categorias?.filter(c => c.padre_id === cat.id) ?? [];
                      return (
                        <motion.div
                          key={cat.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (navLinks.length + i) * 0.05, duration: 0.2 }}
                        >
                          <Link
                            to={`/productos?categoria_id=${cat.id}`}
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors"
                            style={{ color: navColor, opacity: 0.8 }}
                          >
                            {cat.nombre}
                            {hijos.length > 0 && (
                              <ChevronRight size={13} style={{ opacity: 0.35 }} />
                            )}
                          </Link>
                          {hijos.map(hijo => (
                            <Link
                              key={hijo.id}
                              to={`/productos?categoria_id=${hijo.id}`}
                              className="flex items-center px-4 py-2 rounded-xl text-sm transition-colors"
                              style={{ color: navColor, opacity: 0.45, paddingLeft: '2rem' }}
                            >
                              {hijo.nombre}
                            </Link>
                          ))}
                        </motion.div>
                      );
                    })}
                  </>
                )}
              </nav>

              {/* Acciones rápidas mobile */}
              {!isAuthenticated && mostrarUsuario && (
                <div className="px-4 pb-4">
                  <Link to="/login"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ backgroundColor: navColor, color: navBg }}>
                    <User size={15} /> Iniciar sesión
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

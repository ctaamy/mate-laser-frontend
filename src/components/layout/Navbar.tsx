import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, X, Menu, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { useCarritoStore } from '../../store/carrito.store';
import api from '../../lib/api';

interface NavLink { label: string; href: string }

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Productos', href: '/productos' },
  { label: 'Personalizado', href: '/productos?personalizado=true' },
  { label: 'Nosotros', href: '/#nosotros' },
];

// ── Ícono de acción con animación ─────────────────────────────────────────────
function IconBtn({ onClick, active, children, badge, navColor, navBg }: {
  onClick?: () => void; active?: boolean; children: React.ReactNode;
  badge?: number; navColor: string; navBg: string;
}) {
  return (
    <motion.button
      onClick={onClick}
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
  const cantidadItems = useCarritoStore(s => s.cantidadItems);
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const nombreTienda: string = config?.nombre_tienda || 'matelaser studio';
  const navLinks: NavLink[] = (() => {
    const raw = config?.nav_links;
    if (!raw) return DEFAULT_LINKS;
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return DEFAULT_LINKS; }
  })();

  const navBg: string = config?.navbar_bg_color || '#ffffff';
  const navColor: string = config?.navbar_texto_color || '#111111';
  const navBorder: string = config?.navbar_border_color || '#f3f4f6';
  const logoUrl: string = config?.navbar_logo_url || '';
  const logoAlto: number = parseInt(config?.navbar_logo_alto || '32') || 32;
  const mostrarBuscar: boolean = (config?.navbar_mostrar_buscar ?? 'true') !== 'false';
  const mostrarUsuario: boolean = (config?.navbar_mostrar_usuario ?? 'true') !== 'false';
  const mostrarCarrito: boolean = (config?.navbar_mostrar_carrito ?? 'true') !== 'false';

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
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
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

          {/* Links — desktop con pill hover */}
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
                <IconBtn badge={cantidadItems()} navColor={navColor} navBg={navBg}>
                  <ShoppingCart size={16} />
                </IconBtn>
              </Link>
            )}

            {/* Hamburguesa — mobile */}
            <motion.button
              onClick={() => setMenuOpen(s => !s)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl"
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

      {/* Menú mobile */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 z-30 bg-black/20 md:hidden"
              onClick={() => setMenuOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-x-0 top-16 z-40 md:hidden shadow-2xl"
              style={{ backgroundColor: navBg, borderBottom: `1px solid ${navBorder}` }}
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

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation, useNavigationType } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { useCarritoStore } from './store/carrito.store';
import { useToastStore } from './store/toast.store';
import { useThemeGlobal } from './hooks/useThemeGlobal';
import api from './lib/api';

// Layout
import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';

// Páginas públicas
import Home from './pages/Home';
import Productos from './pages/Productos';
import ProductoDetalle from './pages/ProductoDetalle';
import Carrito from './pages/Carrito';
import Checkout from './pages/Checkout';
import Pago from './pages/Pago';
import Confirmacion from './pages/Confirmacion';
import Login from './pages/Login';
import Register from './pages/Register';
import OlvidePassword from './pages/OlvidePassword';
import ResetearPassword from './pages/ResetearPassword';
import VerificarEmail from './pages/VerificarEmail';
import ConfirmarNewsletter from './pages/ConfirmarNewsletter';
import BajaNewsletter from './pages/BajaNewsletter';
import GoogleCallback from './pages/auth/GoogleCallback';
import DisenaTuMateV2 from './pages/DisenaTuMateV2';
import PaginaEstatica from './pages/PaginaEstatica';
import MiCuenta from './pages/MiCuenta';

// Páginas admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminProductos from './pages/admin/Productos';
import AdminOrdenes from './pages/admin/Ordenes';
import AdminCupones from './pages/admin/Cupones';
import AdminEnvios from './pages/admin/Envios';
import AdminConfiguracion from './pages/admin/Configuracion';
import AdminConfiguradorV2 from './pages/admin/ConfiguradorV2';
import AdminPromocionesBancarias from './pages/admin/PromocionesBancarias';
import AdminUsuarios from './pages/admin/Usuarios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Guard para rutas protegidas
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

// Guard para rutas de admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, usuario } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (usuario?.rol !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

// Aplica el tema global (colores/tipografía por defecto) como CSS variables.
function ThemeGlobalMount() {
  useThemeGlobal();
  return null;
}

// React Router no resetea el scroll al navegar (SPA). Sin esto, al entrar a
// una categoría desde el Home el scroll quedaba donde estaba — y si la
// categoría tenía pocos productos, la página nueva es más corta que ese
// offset y el navegador lo clampeaba al fondo: "entrás y arrancás en el final".
// Solo reseteamos en PUSH/REPLACE (navegación nueva); en POP (atrás/adelante)
// dejamos que el navegador restaure la posición previa.
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
}

// Captura ?cupon=CODIGO de cualquier URL (link del mail de bienvenida, campaña,
// etc.), lo deja como "cupón pendiente" en el carrito y limpia el query param
// para no re-dispararlo ni dejarlo pegado en la URL. Un toast confirma que se
// guardó — antes, si el carrito estaba vacío, no había ningún feedback visible
// (el banner "tenés un cupón listo" vive dentro del resumen del carrito).
function CuponWatcher() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setCuponPendiente = useCarritoStore((s) => s.setCuponPendiente);
  const mostrarToast = useToastStore((s) => s.agregar);

  useEffect(() => {
    const codigo = searchParams.get('cupon');
    if (!codigo) return;
    const normalizado = codigo.trim().toUpperCase();
    setCuponPendiente(codigo);
    if (normalizado) mostrarToast(`Cupón ${normalizado} guardado — se aplica en el carrito`);
    searchParams.delete('cupon');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, setCuponPendiente, mostrarToast]);

  return null;
}

// Refresca el perfil del usuario logueado una vez al arrancar la app. El store
// persiste (auth-storage-v2) lo que devolvió el último login, así que campos
// agregados después (email_verificado) o cambios hechos en otra pestaña/sesión
// no se verían sin esto. Silencioso: si falla, el interceptor de axios ya
// maneja el 401.
function PerfilSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const actualizarUsuario = useAuthStore((s) => s.actualizarUsuario);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get('/usuarios/perfil')
      .then((r) => {
        // Guarda: solo mergeamos si la respuesta es un usuario de verdad
        // (evita corromper el store si el endpoint devuelve algo raro).
        if (r.data && typeof r.data === 'object' && r.data.id) {
          actualizarUsuario(r.data);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, actualizarUsuario]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeGlobalMount />
      <BrowserRouter>
        <ScrollToTop />
        <CuponWatcher />
        <PerfilSync />
        <Routes>
          {/* Rutas públicas con layout de tienda */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="productos" element={<Productos />} />
            <Route path="productos/:slug" element={<ProductoDetalle />} />
            <Route path="carrito" element={<Carrito />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="olvide-password" element={<OlvidePassword />} />
            <Route path="resetear-password" element={<ResetearPassword />} />
            <Route path="verificar-email" element={<VerificarEmail />} />
            <Route path="confirmar-newsletter" element={<ConfirmarNewsletter />} />
            <Route path="baja-newsletter" element={<BajaNewsletter />} />
            <Route path="auth/google/callback" element={<GoogleCallback />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pago/:id" element={<Pago />} />
            <Route path="confirmacion/:id" element={<Confirmacion />} />
            <Route path="disena-tu-mate-v2" element={<DisenaTuMateV2 />} />
            <Route path="mi-cuenta" element={<PrivateRoute><MiCuenta /></PrivateRoute>} />
            <Route path="mi-cuenta/pedidos/:id" element={<PrivateRoute><MiCuenta /></PrivateRoute>} />
            <Route path="terminos" element={<PaginaEstatica claveBase="pagina_terminos" tituloDefault="Términos y condiciones" />} />
            <Route path="privacidad" element={<PaginaEstatica claveBase="pagina_privacidad" tituloDefault="Política de privacidad" />} />
            <Route path="faq" element={<PaginaEstatica claveBase="pagina_faq" tituloDefault="Preguntas frecuentes" />} />
            <Route path="envios-y-devoluciones" element={<PaginaEstatica claveBase="pagina_envios" tituloDefault="Envíos y devoluciones" />} />
          </Route>

          {/* Rutas de admin */}
          <Route path="/admin" element={
            <AdminRoute><AdminLayout /></AdminRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="productos" element={<AdminProductos />} />
            <Route path="ordenes" element={<AdminOrdenes />} />
            <Route path="cupones" element={<AdminCupones />} />
            <Route path="envios" element={<AdminEnvios />} />
            <Route path="configuracion" element={<AdminConfiguracion />} />
            {/* Categorías dejó de ser ruta de primer nivel — ahora vive como
                tab dentro de /admin/productos (ver CategoriasPanel). */}
            <Route path="categorias" element={<Navigate to="/admin/productos" replace />} />
            <Route path="configurador-v2" element={<AdminConfiguradorV2 />} />
            <Route path="promociones-bancarias" element={<AdminPromocionesBancarias />} />
            <Route path="usuarios" element={<AdminUsuarios />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

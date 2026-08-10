import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { useThemeGlobal } from './hooks/useThemeGlobal';

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
import GoogleCallback from './pages/auth/GoogleCallback';
import DisenaTuMateV2 from './pages/DisenaTuMateV2';
import PaginaEstatica from './pages/PaginaEstatica';

// Páginas admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminProductos from './pages/admin/Productos';
import AdminOrdenes from './pages/admin/Ordenes';
import AdminCupones from './pages/admin/Cupones';
import AdminEnvios from './pages/admin/Envios';
import AdminConfiguracion from './pages/admin/Configuracion';
import AdminCategorias from './pages/admin/Categorias';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeGlobalMount />
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas con layout de tienda */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="productos" element={<Productos />} />
            <Route path="productos/:slug" element={<ProductoDetalle />} />
            <Route path="carrito" element={<Carrito />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="auth/google/callback" element={<GoogleCallback />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pago/:id" element={<Pago />} />
            <Route path="confirmacion/:id" element={<Confirmacion />} />
            <Route path="disena-tu-mate-v2" element={<DisenaTuMateV2 />} />
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
            <Route path="categorias" element={<AdminCategorias />} />
            <Route path="configurador-v2" element={<AdminConfiguradorV2 />} />
            <Route path="promociones-bancarias" element={<AdminPromocionesBancarias />} />
            <Route path="usuarios" element={<AdminUsuarios />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

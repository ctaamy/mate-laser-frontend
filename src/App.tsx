import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';

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

// Páginas admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminProductos from './pages/admin/Productos';
import AdminOrdenes from './pages/admin/Ordenes';
import AdminCupones from './pages/admin/Cupones';
import AdminEnvios from './pages/admin/Envios';
import AdminConfiguracion from './pages/admin/Configuracion';
import AdminCategorias from './pages/admin/Categorias';

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route path="checkout" element={<Checkout />} />
            <Route path="pago/:id" element={<Pago />} />
            <Route path="confirmacion/:id" element={<Confirmacion />} />
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
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

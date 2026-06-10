import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useCarritoStore } from '../../store/carrito.store';

export default function Navbar() {
  const { isAuthenticated, usuario, logout } = useAuthStore();
  const cantidadItems = useCarritoStore((s) => s.cantidadItems);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="text-[17px] font-medium text-gray-900">
        mate<span className="text-[#0F6E56]">laser</span> studio
      </Link>

      <div className="flex items-center gap-5 text-sm text-gray-500">
        <Link to="/productos" className="hover:text-gray-900 transition-colors">Productos</Link>
        <Link to="/productos?personalizado=true" className="hover:text-gray-900 transition-colors">Personalizado</Link>
        <Link to="/#nosotros" className="hover:text-gray-900 transition-colors">Nosotros</Link>
      </div>

      <div className="flex items-center gap-3">
        <button className="text-gray-500 hover:text-gray-900">
          <Search size={18} />
        </button>

        {isAuthenticated ? (
          <div className="relative group">
            <button className="text-gray-500 hover:text-gray-900">
              <User size={18} />
            </button>
            <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-lg shadow-lg py-1 w-40 hidden group-hover:block">
              <span className="block px-3 py-1.5 text-xs text-gray-400">{usuario?.nombre}</span>
              {usuario?.rol === 'admin' && (
                <Link to="/admin" className="block px-3 py-1.5 text-sm hover:bg-gray-50">Panel admin</Link>
              )}
              <button onClick={handleLogout} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <Link to="/login" className="text-gray-500 hover:text-gray-900">
            <User size={18} />
          </Link>
        )}

        <Link to="/carrito" className="relative text-gray-500 hover:text-gray-900">
          <ShoppingCart size={18} />
          {cantidadItems() > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#1D9E75] text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-medium">
              {cantidadItems()}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
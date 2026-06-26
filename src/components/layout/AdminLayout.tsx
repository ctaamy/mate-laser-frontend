import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Package, ShoppingBag, Tag,
  Truck, Settings, LogOut, ExternalLink, Layers
} from 'lucide-react';

export default function AdminLayout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/productos', label: 'Productos', icon: Package },
    { to: '/admin/categorias', label: 'Categorías', icon: Layers },
    { to: '/admin/ordenes', label: 'Órdenes', icon: ShoppingBag },
    { to: '/admin/cupones', label: 'Cupones', icon: Tag },
    { to: '/admin/envios', label: 'Envíos', icon: Truck },
    { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-[#085041] flex flex-col fixed top-0 left-0 h-full">
        <div className="p-5 border-b border-[#0F6E56]">
          <span className="text-[#E1F5EE] font-medium text-sm">
            mate<span className="text-[#5DCAA5]">laser</span> admin
          </span>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-3 ${
                  isActive
                    ? 'bg-[#0F6E56] text-[#E1F5EE] font-medium border-[#5DCAA5]'
                    : 'text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] border-transparent'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#0F6E56] py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
          >
            <ExternalLink size={17} /> Ver tienda
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#9FE1CB] hover:bg-[#0F6E56] hover:text-[#E1F5EE] w-full"
          >
            <LogOut size={17} /> Salir
          </button>
        </div>
      </aside>
      <div className="ml-56 flex-1 bg-gray-50 min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
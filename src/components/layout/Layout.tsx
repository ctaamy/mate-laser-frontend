import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import ToastCarrito from '../ui/ToastCarrito';
import { useOrganizacionSeo } from '../../hooks/useOrganizacionSeo';
import { precargarSiguientes } from '../../lib/cargaDeRutas';
import LimiteDeRuta from './LimiteDeRuta';

export default function Layout() {
  useOrganizacionSeo();
  // Trae en un momento ocioso el chunk de la pantalla a la que es probable ir después.
  const { pathname } = useLocation();
  useEffect(() => precargarSiguientes(pathname), [pathname]);
  return (
    <div className="tema-publico min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <LimiteDeRuta>
          <Outlet />
        </LimiteDeRuta>
      </main>
      <Footer />
      <WhatsAppButton />
      <ToastCarrito />
    </div>
  );
}
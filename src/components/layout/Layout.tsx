import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import ToastCarrito from '../ui/ToastCarrito';

export default function Layout() {
  return (
    <div className="tema-publico min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <ToastCarrito />
    </div>
  );
}
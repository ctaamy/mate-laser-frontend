import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white/40 py-10 px-6 mt-auto border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="text-white font-bold tracking-tight mb-1">
            mate<span className="font-light">laser</span> studio
          </div>
          <p className="text-white/30 text-[11px] uppercase tracking-[0.14em]">Grabado láser personalizado · Todo Argentina</p>
        </div>
        <div className="flex gap-6 text-xs">
          <Link to="/productos" className="hover:text-white transition-colors">Productos</Link>
          <Link to="/#como-funciona" className="hover:text-white transition-colors">Cómo funciona</Link>
          <Link to="/#contacto" className="hover:text-white transition-colors">Contacto</Link>
        </div>
        <div className="flex gap-4 items-center text-xs">
          <a href="https://instagram.com/matelaserstudio" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            @matelaserstudio
          </a>
          <span className="text-white/20">© 2025 Mate Laser Studio</span>
        </div>
      </div>
    </footer>
  );
}

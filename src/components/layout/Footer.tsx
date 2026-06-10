import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#085041] text-[#9FE1CB] py-8 px-6 mt-auto">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <div className="text-[#E1F5EE] font-medium mb-1">matelaser studio</div>
          <p className="text-[#5DCAA5] text-xs">Grabado láser personalizado · Todo Argentina</p>
        </div>
        <div className="flex gap-4 text-xs">
          <Link to="/productos" className="hover:text-[#E1F5EE] transition-colors">Productos</Link>
          <Link to="/#como-funciona" className="hover:text-[#E1F5EE] transition-colors">Cómo funciona</Link>
          <Link to="/#contacto" className="hover:text-[#E1F5EE] transition-colors">Contacto</Link>
        </div>
        <div className="flex gap-3 items-center">
          <a href="https://instagram.com/matelaserstudio" target="_blank" rel="noreferrer" className="hover:text-[#E1F5EE] text-xs">
            @matelaserstudio
          </a>
          <span className="text-xs text-[#5DCAA5]">© 2025 Mate Laser Studio</span>
        </div>
      </div>
    </footer>
  );
}
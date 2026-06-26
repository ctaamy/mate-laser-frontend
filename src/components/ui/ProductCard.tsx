import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import type { Producto } from '../../types/index';

interface ProductCardProps {
  producto: Producto;
  onAgregar: (producto: Producto) => void;
  index?: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 } as const,
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } as const,
};

export default function ProductCard({ producto, onAgregar, index = 0 }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const img1 = producto.imagenes_producto?.[0];
  const img2 = producto.imagenes_producto?.[1];
  const tieneDescuento = !!producto.precio_tachado && Number(producto.precio_tachado) > Number(producto.precio_base);
  const descuentoPct = tieneDescuento
    ? Math.round((1 - Number(producto.precio_base) / Number(producto.precio_tachado!)) * 100)
    : 0;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.07 }}
      className="group flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Bloque imagen — ratio 3:4 portrait */}
      <Link to={`/productos/${producto.slug}`} className="block relative overflow-hidden bg-gray-50" style={{ aspectRatio: '3/4' }}>

        {/* Imagen principal */}
        {img1 ? (
          <motion.img
            src={img1.url}
            alt={img1.alt_texto || producto.nombre}
            className="absolute inset-0 w-full h-full object-cover"
            animate={{ scale: hovered ? 1.04 : 1, opacity: hovered && img2 ? 0 : 1 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-6xl text-gray-200">☕</div>
        )}

        {/* Segunda imagen — crossfade al hover */}
        {img2 && (
          <AnimatePresence>
            {hovered && (
              <motion.img
                key="img2"
                src={img2.url}
                alt={img2.alt_texto || producto.nombre}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: 1.03 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          {tieneDescuento && (
            <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-sm">
              -{descuentoPct}%
            </span>
          )}
          {producto.apto_grabado && (
            <span className="text-[10px] font-semibold bg-white/90 text-gray-700 px-2 py-0.5 rounded-sm border border-gray-100">
              ⚡ Grabado
            </span>
          )}
        </div>

        {/* Botón agregar — aparece al hover desde abajo */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-10"
          initial={{ y: '100%' }}
          animate={{ y: hovered ? '0%' : '100%' }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
        >
          <button
            onClick={e => { e.preventDefault(); onAgregar(producto); }}
            className="w-full py-3 bg-black text-white text-xs font-semibold tracking-widest uppercase hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart size={12} /> Agregar al carrito
          </button>
        </motion.div>
      </Link>

      {/* Info debajo de la imagen */}
      <div className="pt-3 pb-1">
        <Link to={`/productos/${producto.slug}`}>
          <p className="text-sm font-medium text-gray-900 leading-tight hover:text-gray-500 transition-colors line-clamp-2">
            {producto.nombre}
          </p>
        </Link>
        {producto.material && (
          <p className="text-xs text-gray-400 mt-0.5">{producto.material}</p>
        )}
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-sm font-semibold text-gray-900">
            ${Number(producto.precio_base).toLocaleString('es-AR')}
          </span>
          {tieneDescuento && (
            <span className="text-xs text-gray-400 line-through">
              ${Number(producto.precio_tachado).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

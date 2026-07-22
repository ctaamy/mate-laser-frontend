import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import type { Producto } from '../../types/index';
import { ImagenConOverlay, LinkAcentoConSubrayado } from './CardOverlay';
import BadgeAptoGrabado from './BadgeAptoGrabado';

interface ProductCardProps {
  producto: Producto;
  onAgregar: (producto: Producto) => void;
  index?: number;
  // variant="overlay" — mismo lenguaje visual que categorias_grid (texto
  // superpuesto sobre la imagen con degradé, zoom leve al hover, acento en
  // el CTA). Solo la usa productos_destacados vía ProductGrid; sin esta
  // prop (el catálogo público) el render es exactamente el de siempre.
  variant?: 'catalogo' | 'overlay';
  accentColor?: string;
  tituloFontSize?: string;
  linkFontSize?: string;
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 } as const,
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } } as const,
};

export default function ProductCard({ producto, onAgregar, index = 0, variant = 'catalogo', accentColor, tituloFontSize, linkFontSize }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const img1 = producto.imagenes_producto?.[0];
  const img2 = producto.imagenes_producto?.[1];
  const tieneDescuento = !!producto.precio_tachado && Number(producto.precio_tachado) > Number(producto.precio_base);
  const descuentoPct = tieneDescuento
    ? Math.round((1 - Number(producto.precio_base) / Number(producto.precio_tachado!)) * 100)
    : 0;
  const esOverlay = variant === 'overlay';

  const badges = (
    <div className="absolute top-0 left-0 flex flex-col gap-0 z-10">
      {producto.apto_grabado && <BadgeAptoGrabado />}
      {tieneDescuento && (
        <span className="text-[10px] font-bold bg-white text-black px-2.5 py-1 border-l-2 border-black">
          -{descuentoPct}%
        </span>
      )}
    </div>
  );

  if (esOverlay) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: index * 0.07 }}
        className="group flex flex-col"
      >
        <Link to={`/productos/${producto.slug}`} className="relative block w-full overflow-hidden rounded-xl" style={{ aspectRatio: '3/4' }}>
          {img1 ? (
            <ImagenConOverlay src={img1.url} alt={img1.alt_texto || producto.nombre} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/[0.04] text-5xl">☕</div>
          )}

          {badges}

          {/* Overlay de texto — nombre + precio + CTA, superpuestos abajo (mismo patrón que categorias_grid) */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="font-semibold text-[#FAF7F3] mb-0.5 leading-tight line-clamp-2" style={{ fontSize: tituloFontSize }}>
              {producto.nombre}
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-semibold text-[#FAF7F3]" style={{ fontSize: linkFontSize }}>
                ${Number(producto.precio_base).toLocaleString('es-AR')}
              </span>
              {tieneDescuento && (
                <span className="text-[11px] text-[#FAF7F3]/60 line-through">
                  ${Number(producto.precio_tachado).toLocaleString('es-AR')}
                </span>
              )}
            </div>
            <LinkAcentoConSubrayado color={accentColor || '#1D9E75'} fontSize={linkFontSize}>
              Ver producto <ArrowRight size={10} />
            </LinkAcentoConSubrayado>
          </div>
        </Link>
      </motion.div>
    );
  }

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

        {badges}

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

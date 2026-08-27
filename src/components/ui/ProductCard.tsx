import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import type { Producto } from '../../types/index';
import { ImagenConOverlay, LinkAcentoConSubrayado } from './CardOverlay';
import BadgeAptoGrabado from './BadgeAptoGrabado';
import CuotasBanner from './CuotasBanner';

interface ProductCardProps {
  producto: Producto;
  onAgregar: (producto: Producto) => void;
  index?: number;
  // variant="overlay" — mismo lenguaje visual que categorias_grid (texto
  // superpuesto sobre la imagen con degradé, zoom leve al hover, acento en
  // el CTA). variant="grid" — estructura tipo catálogo (imagen arriba,
  // texto debajo) pero compacta y con el badge de descuento arriba a la
  // derecha, para el layout "cuadrícula" de productos_destacados (siempre
  // 2 columnas, sin scroll). Ambas las usa productos_destacados vía
  // ProductGrid, elegida por el campo datos.layout del bloque; sin esta
  // prop (el catálogo público) el render es exactamente el de siempre.
  variant?: 'catalogo' | 'overlay' | 'grid';
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
  const esGrid = variant === 'grid';

  const badges = (
    <div className="absolute top-0 left-0 flex flex-col gap-0 z-10">
      {producto.apto_grabado && <BadgeAptoGrabado compact={esOverlay} />}
      {tieneDescuento && (
        <span className={`font-bold bg-white text-black border-l-2 border-black ${esOverlay ? 'text-[8px] px-1.5 py-1' : 'text-[10px] px-2.5 py-1'}`}>
          -{descuentoPct}%
        </span>
      )}
    </div>
  );

  if (esGrid) {
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
        {/* Estructura tomada de la referencia: imagen arriba con badge de
            descuento en la esquina superior derecha, título y precio debajo
            de la imagen (no superpuestos) — sin estrellas, sin CTA de texto
            (la card entera ya linkea al producto). */}
        <Link to={`/productos/${producto.slug}`} className="block relative overflow-hidden bg-gray-50 rounded-xl" style={{ aspectRatio: '4/5' }}>
          {img1 ? (
            <motion.img
              src={img1.url}
              alt={img1.alt_texto || producto.nombre}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
              animate={{ scale: hovered ? 1.04 : 1 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-gray-200">☕</div>
          )}

          {producto.apto_grabado && (
            <BadgeAptoGrabado compact className="absolute top-2 left-2 z-10" />
          )}
          {tieneDescuento && (
            <span className="absolute top-2 right-2 z-10 text-[10px] font-bold bg-black text-white px-2 py-1 rounded">
              {descuentoPct}% OFF
            </span>
          )}
        </Link>

        <div className="pt-2.5 pb-1">
          <Link to={`/productos/${producto.slug}`}>
            <p className="font-medium text-gray-900 leading-snug hover:text-gray-500 transition-colors line-clamp-2" style={{ fontSize: tituloFontSize }}>
              {producto.nombre}
            </p>
          </Link>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-semibold text-gray-900" style={{ fontSize: linkFontSize }}>
              ${Number(producto.precio_base).toLocaleString('es-AR')}
            </span>
            {tieneDescuento && (
              <span className="text-xs text-gray-400 line-through">
                ${Number(producto.precio_tachado).toLocaleString('es-AR')}
              </span>
            )}
          </div>
          <div className="mt-0.5"><CuotasBanner productoId={producto.id} /></div>
        </div>
      </motion.div>
    );
  }

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
            // Gradiente reforzado respecto al default de ImagenConOverlay
            // (from-black/75 via-black/10): esta card no tiene CTA con color
            // de acento debajo para "anclar" el contraste, así que título y
            // precio en blanco fijo dependen 100% del degradé para leerse
            // sobre imágenes de producto claras.
            <ImagenConOverlay src={img1.url} alt={img1.alt_texto || producto.nombre} gradiente="from-black/85 via-black/25 to-transparent" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/[0.04] text-5xl">☕</div>
          )}

          {badges}

          {/* Overlay de texto — nombre + precio + CTA, superpuestos abajo (mismo patrón que categorias_grid) */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="font-semibold text-[#FAF7F3] mb-0.5 leading-tight line-clamp-2" style={{ fontSize: tituloFontSize }}>
              {producto.nombre}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-[#FAF7F3]" style={{ fontSize: linkFontSize }}>
                ${Number(producto.precio_base).toLocaleString('es-AR')}
              </span>
              {tieneDescuento && (
                <span className="text-[11px] text-[#FAF7F3]/60 line-through">
                  ${Number(producto.precio_tachado).toLocaleString('es-AR')}
                </span>
              )}
            </div>
            <div className="mb-1"><CuotasBanner productoId={producto.id} /></div>
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
            loading="lazy"
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
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: 1.03 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>
        )}

        {/* Badges — chicos y suaves, para no competir con la foto */}
        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
          {producto.apto_grabado && <BadgeAptoGrabado compact className="rounded-[3px] opacity-90 shadow-sm" />}
          {tieneDescuento && (
            <span className="rounded-[3px] bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold text-white">
              -{descuentoPct}%
            </span>
          )}
        </div>

        {/* Botón agregar — reveal al hover sobre la imagen (desktop). En
            touch no hay hover: la card entera linkea al producto. */}
        <div className="absolute bottom-0 left-0 right-0 z-10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
          <button
            onClick={e => { e.preventDefault(); onAgregar(producto); }}
            className="w-full py-3 bg-black text-white text-xs font-semibold tracking-widest uppercase hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart size={12} /> Agregar al carrito
          </button>
        </div>
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
        <div className="mt-0.5"><CuotasBanner productoId={producto.id} /></div>
      </div>
    </motion.div>
  );
}

import { motion } from 'motion/react';
import ProductCard from './ProductCard';
import { CuotasBannerBatchProvider } from './CuotasBanner';
import type { Producto } from '../../types/index';

interface ProductGridProps {
  productos: Producto[];
  onAgregar: (producto: Producto) => void;
  cols?: 2 | 3 | 4;
  // variant="overlay" — mismo lenguaje visual que categorias_grid (texto
  // superpuesto sobre la imagen con degradé, acento en el CTA). Solo lo usa
  // productos_destacados; el catálogo público (Productos.tsx) no pasa estas
  // props y sigue viendo el layout de siempre (texto debajo de la imagen).
  variant?: 'catalogo' | 'overlay' | 'grid';
  accentColor?: string;
  tituloFontSize?: string;
  linkFontSize?: string;
  // scroll=true — carrusel horizontal con scroll-snap en mobile (mismo
  // patrón que categorias_grid/galeria_combos en HomeSecciones.tsx): cada
  // card al 72% del contenedor, se asoma la siguiente. Desde sm vuelve al
  // grid normal. Solo lo usa productos_destacados cuando datos.layout es
  // "carrusel"; default false no cambia el catálogo público ni el layout
  // "grid" de productos_destacados.
  scroll?: boolean;
  // Override de las clases de columnas para el layout grid (no-scroll).
  // El catálogo público lo usa para arrancar en 1 columna en teléfonos
  // (imagen grande, más protagonismo) sin cambiar el default de
  // productos_destacados en el home.
  colClassName?: string;
  // Sangrado del carrusel en modo scroll (mobile). Default asume un
  // contenedor con `px-8` (home). La tira de recomendados de la PDP vive en
  // un contenedor con `px-4`, así que pasa `-mx-4 px-4 sm:mx-0 sm:px-0` para
  // que el "peek" de la card siguiente no quede cortado contra el borde.
  bleedClassName?: string;
  // Si viene y scroll=true, el contenedor del carrusel se marca como landmark
  // navegable por teclado (role="region" + aria-label + tabindex). Solo lo
  // usa la tira de recomendados; el resto no pasa nada y no cambia.
  regionLabel?: string;
}

// El contenedor orquesta la cascada: staggerChildren hace que cada hijo
// espere `staggerChildren` segundos antes de empezar su propia animación.
const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07, // cada card aparece 70ms después de la anterior
      delayChildren: 0.1,    // pequeño delay inicial antes de la primera card
    },
  },
};

// Mobile-first: 2 columnas siempre hasta md, después el valor elegido — mismo
// criterio que COL_CLASS en HomeSecciones.tsx (categorias_grid/galeria_combos).
const colClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
};

// Solo el md: de cada nivel — para componer con el contenedor scroll (que ya
// trae su propio "sm:grid-cols-2" fijo para tablet/desktop).
const mdColClass: Record<number, string> = {
  2: '',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export default function ProductGrid({ productos, onAgregar, cols = 3, variant, accentColor, tituloFontSize, linkFontSize, scroll = false, colClassName, bleedClassName = '-mx-8 px-8 sm:mx-0 sm:px-0', regionLabel }: ProductGridProps) {
  const containerClass = scroll
    ? `flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory ${bleedClassName} sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none sm:gap-x-4 sm:gap-y-8 ${mdColClass[cols] ?? 'md:grid-cols-3'}`
    : `grid ${colClassName ?? colClass[cols] ?? 'grid-cols-2 md:grid-cols-3'} gap-x-4 gap-y-8`;
  const regionProps =
    scroll && regionLabel ? { role: 'region' as const, 'aria-label': regionLabel, tabIndex: 0 } : {};

  return (
    // Batch de promociones bancarias para toda la grilla en una sola
    // request (evita 1 GET por card) — cada <CuotasBanner> adentro lee de
    // este contexto en vez de hacer su propio fetch individual.
    <CuotasBannerBatchProvider productoIds={productos.map(p => p.id)}>
    {/* variants="gridVariants" propaga el estado (hidden/visible) a los hijos
        que también tengan variants — así el stagger funciona automáticamente. */}
    <motion.div
      variants={gridVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={containerClass}
      {...regionProps}
    >
      {productos.map((producto, i) => {
        // ProductCard ya tiene sus propias variants (hidden/visible), por
        // eso hereda el timing del padre sin necesidad de pasarle index.
        const card = (
          <ProductCard
            producto={producto}
            onAgregar={onAgregar}
            index={i}
            variant={variant}
            accentColor={accentColor}
            tituloFontSize={tituloFontSize}
            linkFontSize={linkFontSize}
          />
        );
        // Sin scroll (grid normal): ProductCard directo como item del grid,
        // igual que antes. Con scroll: envuelto para controlar el ancho de
        // cada card dentro del flex (72% mobile, auto desde sm).
        return scroll ? (
          <div key={producto.id} className="w-[72%] flex-shrink-0 snap-start sm:w-auto sm:flex-shrink sm:snap-none">
            {card}
          </div>
        ) : (
          <ProductCard
            key={producto.id}
            producto={producto}
            onAgregar={onAgregar}
            index={i}
            variant={variant}
            accentColor={accentColor}
            tituloFontSize={tituloFontSize}
            linkFontSize={linkFontSize}
          />
        );
      })}
    </motion.div>
    </CuotasBannerBatchProvider>
  );
}

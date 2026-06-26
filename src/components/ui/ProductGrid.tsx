import { motion } from 'motion/react';
import ProductCard from './ProductCard';
import type { Producto } from '../../types/index';

interface ProductGridProps {
  productos: Producto[];
  onAgregar: (producto: Producto) => void;
  cols?: 2 | 3 | 4;
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

const colClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export default function ProductGrid({ productos, onAgregar, cols = 3 }: ProductGridProps) {
  return (
    // variants="gridVariants" propaga el estado (hidden/visible) a los hijos
    // que también tengan variants — así el stagger funciona automáticamente.
    <motion.div
      variants={gridVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={`grid ${colClass[cols] ?? 'grid-cols-3'} gap-x-4 gap-y-8`}
    >
      {productos.map((producto, i) => (
        // ProductCard ya tiene sus propias variants (hidden/visible),
        // por eso hereda el timing del padre sin necesidad de pasarle index.
        <ProductCard
          key={producto.id}
          producto={producto}
          onAgregar={onAgregar}
          index={i}
        />
      ))}
    </motion.div>
  );
}

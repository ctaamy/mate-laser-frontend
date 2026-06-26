import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

interface AnimatedHeroProps {
  titulo?: string;
  subtitulo?: string;
  btnTexto?: string;
  btnLink?: string;
  imagenUrl?: string;
  bgColor?: string;
  textColor?: string;
}

// Variantes para el contenedor de texto: orquesta la entrada en cascada
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

// Cada línea de texto entra desde abajo con fade
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] }, // ease personalizado tipo "spring suave"
  },
};

// La imagen entra desde la derecha
const imageVariants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut', delay: 0.3 },
  },
};

export default function AnimatedHero({
  titulo = 'Mates con grabado láser',
  subtitulo = 'Personalizá el tuyo con tu nombre, logo o diseño favorito.',
  btnTexto = 'Ver productos',
  btnLink = '/productos',
  imagenUrl,
  bgColor = '#E1F5EE',
  textColor = '#111111',
}: AnimatedHeroProps) {
  return (
    <section
      className="w-full min-h-[420px] flex items-center px-6 py-16"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center gap-10">

        {/* Texto animado en cascada */}
        <motion.div
          className="flex-1 flex flex-col gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold leading-tight"
          >
            {titulo}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-base md:text-lg opacity-75 max-w-md"
          >
            {subtitulo}
          </motion.p>

          <motion.div variants={itemVariants}>
            <Link
              to={btnLink}
              className="inline-block bg-[#1D9E75] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#0F6E56] transition-colors"
            >
              {btnTexto}
            </Link>
          </motion.div>
        </motion.div>

        {/* Imagen con entrada desde la derecha */}
        {imagenUrl && (
          <motion.div
            className="flex-1 flex justify-center"
            variants={imageVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.img
              src={imagenUrl}
              alt={titulo}
              className="max-h-72 object-contain rounded-2xl"
              // Leve flotado continuo usando keyframes
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}

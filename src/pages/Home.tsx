import { motion } from 'motion/react';
import { useTemaGlobalData } from '../hooks/useThemeGlobal';
import { useHomepageSecciones } from '../hooks/useHomepageSecciones';
import { HomeSecciones } from '../components/home/HomeSecciones';

export default function Home() {
  const { data: secciones, isLoading } = useHomepageSecciones();
  const tema = useTemaGlobalData();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        className="w-6 h-6 border border-black border-t-transparent rounded-full"
      />
    </div>
  );

  // El navbar vive en el mismo array de secciones (comparte infraestructura
  // de bloques), pero se renderiza fijo desde Layout/Navbar.tsx, no acá.
  const activas = (secciones ?? []).filter(s => s.activo && s.tipo !== 'navbar');
  return <HomeSecciones secciones={activas} tema={tema} />;
}

import { motion } from 'motion/react';
import { useTemaGlobalData } from '../hooks/useThemeGlobal';
import { useHomepageSecciones } from '../hooks/useHomepageSecciones';
import { HomeSecciones } from '../components/home/HomeSecciones';
import { usePageMeta } from '../hooks/usePageMeta';
import { metaHome } from '../lib/seo';

// Constante de módulo: el meta de la home no depende de datos.
const META_HOME = metaHome();

export default function Home() {
  const { data: secciones, isLoading } = useHomepageSecciones();
  const tema = useTemaGlobalData();
  usePageMeta(META_HOME);

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

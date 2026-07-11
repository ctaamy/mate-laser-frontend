import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import api from '../lib/api';
import { useTemaGlobalData } from '../hooks/useThemeGlobal';
import { HomeSecciones, type Seccion } from '../components/home/HomeSecciones';

export default function Home() {
  const { data: secciones, isLoading } = useQuery<Seccion[]>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/configuracion/homepage').then(r => r.data),
  });
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

// Íconos disponibles para el bloque stats_barra — lista curada de
// lucide-react (ya es la librería de íconos de todo el proyecto, nada
// nuevo que instalar) en vez de dejar subir imágenes sueltas: más liviano
// y consistente visualmente con el resto del sitio/admin.
// Se guarda el NOMBRE del ícono (string) en datos.stats[i].icono — este
// mapa resuelve el nombre al componente real, tanto en el admin (picker)
// como en el render público (HomeSecciones.tsx).
import {
  Truck, Package, Send, Clock, Timer, Zap, BadgeCheck, ShieldCheck, CheckCircle2,
  MapPin, Store, PackageCheck, Star, Gift, Sparkles, Heart, ThumbsUp, CreditCard,
  Percent, Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const STAT_ICONS: Record<string, LucideIcon> = {
  Truck, Package, Send, Clock, Timer, Zap, BadgeCheck, ShieldCheck, CheckCircle2,
  MapPin, Store, PackageCheck, Star, Gift, Sparkles, Heart, ThumbsUp, CreditCard,
  Percent, Award,
};

export const STAT_ICON_NAMES = Object.keys(STAT_ICONS);

// Íconos por defecto para las 4 estadísticas históricas — coinciden con el
// fallback de contenido (datos.stats en HomeSecciones.tsx / TIPO_DEFAULTS
// en Configuracion.tsx), en el mismo orden.
export const STAT_ICON_FALLBACK = ['Truck', 'Clock', 'BadgeCheck', 'MapPin'];

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
  Percent, Award, Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Compartido entre stats_barra y como_funciona (ambos "cards con ícono" del
// mismo lenguaje visual) — un solo lugar para la lista curada de íconos.
export const STAT_ICONS: Record<string, LucideIcon> = {
  Truck, Package, Send, Clock, Timer, Zap, BadgeCheck, ShieldCheck, CheckCircle2,
  MapPin, Store, PackageCheck, Star, Gift, Sparkles, Heart, ThumbsUp, CreditCard,
  Percent, Award, Palette,
};

export const STAT_ICON_NAMES = Object.keys(STAT_ICONS);

// Íconos por defecto para las 4 estadísticas históricas — coinciden con el
// fallback de contenido (datos.stats en HomeSecciones.tsx / TIPO_DEFAULTS
// en Configuracion.tsx), en el mismo orden.
export const STAT_ICON_FALLBACK = ['Truck', 'Clock', 'BadgeCheck', 'MapPin'];

// Íconos por defecto para los 4 pasos históricos de "¿Cómo funciona?"
// (Elegís el diseño / Aprobás el arte / Grabamos tu pieza / Lo recibís en
// casa) — reemplazan los emojis que antes se guardaban pero nunca se
// renderizaban.
export const PASO_ICON_FALLBACK = ['Palette', 'CheckCircle2', 'Zap', 'Package'];

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const GOOGLE_FONTS = ['Poppins', 'Montserrat', 'Lato', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Nunito'];

export function cargarGoogleFont(fontFamily: string) {
  const nombre = fontFamily.split(',')[0].trim();
  if (!GOOGLE_FONTS.includes(nombre)) return;
  const id = `gfont-${nombre.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${nombre.replace(/\s/g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export interface TemaGlobal {
  bg_color: string;
  texto_color: string;
  texto_secundario_color: string;
  font_family: string;
  accent_color: string;
}

// accent_color por defecto: el único accent de marca que existe hoy en el
// código (botones/links del panel admin) — no hay ningún naranja hardcodeado
// en ningún lado, así que este verde es la base real, no una invención.
// texto_secundario_color por defecto: texto_color con opacidad simulada en
// gris medio, para que un bloque que lo herede sin haberlo configurado nunca
// tenga menos contraste que el mínimo razonable.
const TEMA_DEFAULT: TemaGlobal = {
  bg_color: '#ffffff',
  texto_color: '#111111',
  texto_secundario_color: '#6b7280',
  font_family: '',
  accent_color: '#1D9E75',
};

// Resuelve los valores efectivos del tema global (con sus defaults), para
// que los bloques (incluido el navbar) puedan usarlos como fallback cuando
// no tienen su propio override de bg_color/texto_color/font_family/accent_color.
export function useTemaGlobalData(estado: 'publicado' | 'borrador' = 'publicado'): TemaGlobal {
  const url = estado === 'borrador' ? '/configuracion/borrador' : '/configuracion';
  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion', estado],
    queryFn: () => api.get(url).then(r => r.data),
  });

  return {
    bg_color: config?.tema_bg_color || TEMA_DEFAULT.bg_color,
    texto_color: config?.tema_texto_color || TEMA_DEFAULT.texto_color,
    texto_secundario_color: config?.tema_texto_secundario_color || TEMA_DEFAULT.texto_secundario_color,
    font_family: config?.tema_font_family || TEMA_DEFAULT.font_family,
    accent_color: config?.tema_accent_color || TEMA_DEFAULT.accent_color,
  };
}

// Aplica el tema global (color de fondo, color de letra, tipografía, accent)
// como CSS variables en :root. Cada bloque sigue pudiendo overridear estos
// valores con su propio bg_color/texto_color/font_family/accent_color — ver
// useTemaGlobalData, usado por los bloques para resolver ese fallback.
export function useThemeGlobal() {
  const tema = useTemaGlobalData();

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--color-bg', tema.bg_color);
    root.setProperty('--color-texto', tema.texto_color);
    root.setProperty('--color-texto-secundario', tema.texto_secundario_color);
    root.setProperty('--font-family-base', tema.font_family || 'inherit');
    root.setProperty('--color-accent', tema.accent_color);
    if (tema.font_family) cargarGoogleFont(tema.font_family);
  }, [tema.bg_color, tema.texto_color, tema.texto_secundario_color, tema.font_family, tema.accent_color]);
}

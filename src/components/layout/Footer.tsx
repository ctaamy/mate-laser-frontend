import { Link } from 'react-router-dom';
import { useHomepageSecciones } from '../../hooks/useHomepageSecciones';
import { useTemaGlobalData } from '../../hooks/useThemeGlobal';

// El footer es una sección más (tipo 'footer') dentro de homepage_sections,
// igual que el navbar — comparte la misma infraestructura de bloques
// (herencia del tema, "Aplicar"/"Aplicar a todo", borrador/publicación).
// A diferencia del navbar, no tenía ninguna clave suelta legacy (estaba
// 100% hardcodeado acá), así que si todavía no existe la sección (sitio
// recién migrado, antes del primer guardado del admin) se usan estos
// mismos valores como fallback — para que no cambie nada visualmente.
const FOOTER_BG_DEFAULT = '#0a0a0a';
const FOOTER_TC_DEFAULT = '#ffffff';
const FOOTER_TAGLINE_DEFAULT = 'Grabado láser personalizado · Todo Argentina';
const FOOTER_COPYRIGHT_DEFAULT = '© 2025 Mate Laser Studio';
const FOOTER_LINKS_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: 'Contacto', href: '/#contacto' },
];
const FOOTER_REDES_DEFAULT = [
  { label: '@matelaserstudio', href: 'https://instagram.com/matelaserstudio' },
];

export default function Footer() {
  const { data: secciones } = useHomepageSecciones();
  const tema = useTemaGlobalData();

  const footerSec = secciones?.find(s => s.tipo === 'footer');
  const datos: Record<string, any> = footerSec?.datos ?? {};

  // Mientras no exista la sección todavía (pre-migración), no hereda del
  // tema — usa el look de siempre (fondo oscuro). Una vez que la sección
  // existe, un bg_color/texto_color vacío sí hereda del tema global, igual
  // que cualquier otro bloque.
  const bg: string = datos.bg_color || (footerSec ? tema.bg_color : FOOTER_BG_DEFAULT);
  const tc: string = datos.texto_color || (footerSec ? tema.texto_color : FOOTER_TC_DEFAULT);
  const fontFamily: string | undefined = datos.font_family || tema.font_family || undefined;

  const tagline: string = datos.tagline ?? FOOTER_TAGLINE_DEFAULT;
  const copyright: string = datos.copyright ?? FOOTER_COPYRIGHT_DEFAULT;
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : FOOTER_LINKS_DEFAULT;
  const redes: { label: string; href: string }[] = Array.isArray(datos.redes) ? datos.redes : FOOTER_REDES_DEFAULT;

  return (
    <footer className="py-10 px-6 mt-auto border-t border-white/[0.06]" style={{ backgroundColor: bg, color: `${tc}66`, fontFamily }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="font-bold tracking-tight mb-1" style={{ color: tc }}>
            mate<span className="font-light">laser</span> studio
          </div>
          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: `${tc}4d` }}>{tagline}</p>
        </div>
        <div className="flex gap-6 text-xs">
          {links.map((link, i) => (
            <Link key={i} to={link.href} className="transition-colors" style={{ color: `${tc}66` }}
              onMouseEnter={e => (e.currentTarget.style.color = tc)}
              onMouseLeave={e => (e.currentTarget.style.color = `${tc}66`)}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-4 items-center text-xs">
          {redes.map((red, i) => (
            <a key={i} href={red.href} target="_blank" rel="noreferrer"
              className="transition-colors" style={{ color: `${tc}66` }}
              onMouseEnter={e => (e.currentTarget.style.color = tc)}
              onMouseLeave={e => (e.currentTarget.style.color = `${tc}66`)}>
              {red.label}
            </a>
          ))}
          <span style={{ color: `${tc}33` }}>{copyright}</span>
        </div>
      </div>
    </footer>
  );
}

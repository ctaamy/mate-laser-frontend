import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useHomepageSecciones } from '../../hooks/useHomepageSecciones';
import { useTemaGlobalData } from '../../hooks/useThemeGlobal';
import { PAYMENT_LOGOS, PAYMENT_LABELS } from '../ui/PaymentLogos';

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
const FOOTER_REDES_DEFAULT = [
  { label: '@matelaserstudio', href: 'https://instagram.com/matelaserstudio' },
];
// Grupos de links del footer (reemplaza el antiguo "links" plano + separado
// "links_legales"): Tienda / Ayuda / Legal, cada uno con su propio
// EnlacesEditor en el admin. "Seguimiento de pedido" queda fuera de Tienda
// por ahora — el dato de tracking todavía no es consultable end-to-end (ver
// auditoría de envíos), se agrega cuando esa página exista.
const FOOTER_GRUPO_TIENDA_DEFAULT = [
  { label: 'Productos', href: '/productos' },
  { label: 'Cómo funciona', href: '/#como-funciona' },
];
const FOOTER_GRUPO_AYUDA_DEFAULT = [
  { label: 'Preguntas frecuentes', href: '/faq' },
  { label: 'Envíos y devoluciones', href: '/envios-y-devoluciones' },
  { label: 'Contacto', href: '/#contacto' },
];
const FOOTER_GRUPO_LEGAL_DEFAULT = [
  { label: 'Términos y condiciones', href: '/terminos' },
  { label: 'Política de privacidad', href: '/privacidad' },
];
// Mercado Pago es el único proveedor de pago realmente integrado
// (pagos.service.ts); Visa/Mastercard se muestran porque MP las procesa
// como tarjetas subyacentes — no hay integración de ningún otro medio.
const FOOTER_METODOS_PAGO_DEFAULT = ['mercadopago', 'visa', 'mastercard'];

type EnlaceFooter = { label: string; href: string };

function esInstagram(href: string) {
  return /instagram\.com/i.test(href);
}

// lucide-react (v1.17 en este proyecto) no incluye un ícono de Instagram —
// SVG inline propio, mismo criterio que PaymentLogos.tsx.
function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
  const redes: EnlaceFooter[] = Array.isArray(datos.redes) ? datos.redes : FOOTER_REDES_DEFAULT;
  const grupoTienda: EnlaceFooter[] = Array.isArray(datos.grupo_tienda) ? datos.grupo_tienda : FOOTER_GRUPO_TIENDA_DEFAULT;
  const grupoAyuda: EnlaceFooter[] = Array.isArray(datos.grupo_ayuda) ? datos.grupo_ayuda : FOOTER_GRUPO_AYUDA_DEFAULT;
  const grupoLegal: EnlaceFooter[] = Array.isArray(datos.grupo_legal) ? datos.grupo_legal : FOOTER_GRUPO_LEGAL_DEFAULT;
  const metodosPago: string[] = Array.isArray(datos.metodos_pago) ? datos.metodos_pago : FOOTER_METODOS_PAGO_DEFAULT;
  const metodosPagoLogos: Record<string, string> = datos.metodos_pago_logos ?? {};
  const contacto: { email?: string; telefono?: string; direccion?: string } = datos.contacto ?? {};

  const linkCls = 'transition-colors';
  const linkStyle = { color: `${tc}66` };
  const onHoverIn = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = tc);
  const onHoverOut = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = `${tc}66`);

  const grupos: { titulo: string; links: EnlaceFooter[] }[] = [
    { titulo: 'Tienda', links: grupoTienda },
    { titulo: 'Ayuda', links: grupoAyuda },
    { titulo: 'Legal', links: grupoLegal },
  ].filter(g => g.links.length > 0);

  return (
    <footer className="pt-12 pb-8 px-6 mt-auto border-t border-white/[0.06]" style={{ backgroundColor: bg, color: `${tc}66`, fontFamily }}>
      <div className="max-w-6xl mx-auto flex flex-col gap-10">
        <div className="grid grid-cols-2 gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="col-span-2" style={{ gridColumn: 'span 2 / span 2' }}>
            <div className="font-bold tracking-tight mb-1" style={{ color: tc }}>
              mate<span className="font-light">laser</span> studio
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: `${tc}4d` }}>{tagline}</p>
          </div>

          {grupos.map(grupo => (
            <div key={grupo.titulo} className="flex flex-col gap-2 text-xs">
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: `${tc}40` }}>{grupo.titulo}</span>
              {grupo.links.map((link, i) => (
                <Link key={i} to={link.href} className={linkCls} style={linkStyle}
                  onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          {(contacto.email || contacto.telefono || contacto.direccion) && (
            <div className="flex flex-col gap-2 text-xs">
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: `${tc}40` }}>Contacto</span>
              {contacto.email && (
                <a href={`mailto:${contacto.email}`} className={`${linkCls} flex items-center gap-2`} style={linkStyle}
                  onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
                  <Mail size={13} /> {contacto.email}
                </a>
              )}
              {contacto.telefono && (
                <a href={`tel:${contacto.telefono}`} className={`${linkCls} flex items-center gap-2`} style={linkStyle}
                  onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}>
                  <Phone size={13} /> {contacto.telefono}
                </a>
              )}
              {contacto.direccion && (
                <span className="flex items-center gap-2" style={linkStyle}>
                  <MapPin size={13} /> {contacto.direccion}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6 border-t" style={{ borderColor: `${tc}12` }}>
          <div className="flex gap-4 items-center text-xs">
            {redes.map((red, i) => (
              <a key={i} href={red.href} target="_blank" rel="noreferrer"
                className={`${linkCls} flex items-center gap-1.5`} style={linkStyle}
                onMouseEnter={onHoverIn} onMouseLeave={onHoverOut}
                aria-label={esInstagram(red.href) ? 'Instagram' : red.label}>
                {esInstagram(red.href) && <InstagramIcon />}
                {red.label}
              </a>
            ))}
            <span style={{ color: `${tc}33` }}>{copyright}</span>
          </div>

          {metodosPago.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: `${tc}40` }}>Medios de pago</span>
              <div className="flex gap-3 items-center">
                {metodosPago.map(m => {
                  const Logo = PAYMENT_LOGOS[m];
                  const overrideUrl = metodosPagoLogos[m];
                  return (
                    <span key={m} title={PAYMENT_LABELS[m] ?? m} className="h-8 w-auto">
                      {overrideUrl ? (
                        <img src={overrideUrl} alt={PAYMENT_LABELS[m] ?? m} className="h-8 w-auto object-contain" />
                      ) : Logo ? (
                        <Logo className="h-8 w-auto" />
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Layout } from 'lucide-react';
import SeccionImageUploader from '../../ui/SeccionImageUploader';
import { PAYMENT_LOGOS, PAYMENT_LABELS } from '../../ui/PaymentLogos';
import type { TemaGlobal } from '../../../hooks/useThemeGlobal';
import { labelCls, inputCls, selectCls, FUENTES } from './constantes';
import { ColorField, cargarGoogleFont } from './campos-comunes';
import {
  FOOTER_REDES_DEFAULT, FOOTER_GRUPO_TIENDA_DEFAULT, FOOTER_GRUPO_AYUDA_DEFAULT, FOOTER_GRUPO_LEGAL_DEFAULT,
  FOOTER_METODOS_PAGO_DEFAULT, FOOTER_TAGLINE_DEFAULT, FOOTER_COPYRIGHT_DEFAULT, METODOS_PAGO_DISPONIBLES,
} from './defaults';
import { EnlacesEditor } from './EnlacesEditor';

// ── Editor de footer ──────────────────────────────────────────────────────────
function FooterEditor({ datos, set, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; tema: TemaGlobal;
}) {
  const bg = datos.bg_color || tema.bg_color;
  const texto = datos.texto_color || tema.texto_color;
  const fontFamily = datos.font_family || tema.font_family || undefined;
  const redes: { label: string; href: string }[] = Array.isArray(datos.redes) ? datos.redes : FOOTER_REDES_DEFAULT;
  const grupoTienda: { label: string; href: string }[] = Array.isArray(datos.grupo_tienda) ? datos.grupo_tienda : FOOTER_GRUPO_TIENDA_DEFAULT;
  const grupoAyuda: { label: string; href: string }[] = Array.isArray(datos.grupo_ayuda) ? datos.grupo_ayuda : FOOTER_GRUPO_AYUDA_DEFAULT;
  const grupoLegal: { label: string; href: string }[] = Array.isArray(datos.grupo_legal) ? datos.grupo_legal : FOOTER_GRUPO_LEGAL_DEFAULT;
  const metodosPago: string[] = Array.isArray(datos.metodos_pago) ? datos.metodos_pago : FOOTER_METODOS_PAGO_DEFAULT;
  const metodosPagoLogos: Record<string, string> = datos.metodos_pago_logos ?? {};
  const setMetodoPagoLogo = (value: string, url: string) => set('metodos_pago_logos', { ...metodosPagoLogos, [value]: url });
  const contacto: Record<string, any> = datos.contacto ?? {};
  const setContacto = (k: string, v: string) => set('contacto', { ...contacto, [k]: v });
  const toggleMetodoPago = (value: string) => {
    set('metodos_pago', metodosPago.includes(value) ? metodosPago.filter(m => m !== value) : [...metodosPago, value]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Colores */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Colores</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">Vacío = hereda el color del tema global.</p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          <ColorField label="Color del texto" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
        </div>
      </div>

      {/* Tipografía */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Tipografía</div>
        <div>
          <label className={labelCls}>Fuente de letra</label>
          <select className={selectCls}
            value={datos.font_family || ''}
            onChange={e => { set('font_family', e.target.value); cargarGoogleFont(e.target.value); }}
            style={{ fontFamily: datos.font_family || undefined }}>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[var(--ink-soft)] mt-1">Predeterminada = hereda la tipografía del tema global.</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Contenido</div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input className={inputCls} value={datos.tagline ?? FOOTER_TAGLINE_DEFAULT}
            onChange={e => set('tagline', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Copyright</label>
          <input className={inputCls} value={datos.copyright ?? FOOTER_COPYRIGHT_DEFAULT}
            onChange={e => set('copyright', e.target.value)} />
        </div>
      </div>

      <EnlacesEditor titulo="Grupo: Tienda" enlaces={grupoTienda} onChange={v => set('grupo_tienda', v)}
        placeholderLabel="Nuevo link" placeholderHref="/" />

      <EnlacesEditor titulo="Grupo: Ayuda" enlaces={grupoAyuda} onChange={v => set('grupo_ayuda', v)}
        placeholderLabel="Nuevo link" placeholderHref="/" />

      <EnlacesEditor titulo="Grupo: Legal" enlaces={grupoLegal} onChange={v => set('grupo_legal', v)}
        placeholderLabel="Términos y condiciones" placeholderHref="/terminos" />

      <EnlacesEditor titulo="Redes sociales" enlaces={redes} onChange={v => set('redes', v)}
        placeholderLabel="@usuario" placeholderHref="https://instagram.com/usuario" />
      <p className="text-[10px] text-[var(--ink-soft)] -mt-3">
        Un link a instagram.com muestra automáticamente el ícono de Instagram al lado del texto.
      </p>

      {/* Contacto directo */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Contacto directo</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">Distinto del botón flotante de WhatsApp — opcional, vacío no se muestra.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={contacto.email || ''} onChange={e => setContacto('email', e.target.value)} placeholder="hola@matelaserstudio.com" />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input className={inputCls} value={contacto.telefono || ''} onChange={e => setContacto('telefono', e.target.value)} placeholder="+54 9 11 1234-5678" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Dirección</label>
            <input className={inputCls} value={contacto.direccion || ''} onChange={e => setContacto('direccion', e.target.value)} placeholder="Buenos Aires, Argentina" />
          </div>
        </div>
      </div>

      {/* Métodos de pago */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Métodos de pago</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">Se muestran como logos al pie, más grandes que el resto de los elementos secundarios del footer.</p>
        <div className="flex flex-wrap gap-3">
          {METODOS_PAGO_DISPONIBLES.map(m => (
            <label key={m.value} className="flex items-center gap-2 text-xs border border-[var(--line)] rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={metodosPago.includes(m.value)} onChange={() => toggleMetodoPago(m.value)} />
              {m.label}
            </label>
          ))}
        </div>
        {metodosPago.map(m => {
          const Logo = PAYMENT_LOGOS[m];
          return (
            <div key={m} className="flex items-center gap-3 border-t border-[var(--line)] pt-3">
              <span className="w-24 flex-shrink-0 text-xs text-[var(--ink-soft)]">{PAYMENT_LABELS[m] ?? m}</span>
              {metodosPagoLogos[m] ? (
                <img src={metodosPagoLogos[m]} alt={m} className="h-8 w-auto object-contain" />
              ) : Logo ? (
                <Logo className="h-8 w-auto" />
              ) : null}
              <SeccionImageUploader label="" value={metodosPagoLogos[m] || ''} onChange={v => setMetodoPagoLogo(m, v)} />
            </div>
          );
        })}
        <p className="text-[10px] text-[var(--ink-soft)]">Por default se usa un logo genérico incluido. Subí una imagen para reemplazarlo por el logo oficial.</p>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-[var(--line)]">
        <div className="text-[10px] text-[var(--ink-soft)] uppercase tracking-wider px-3 py-1.5 bg-[var(--n-50)] border-b border-[var(--line)] font-semibold">Preview</div>
        <div className="px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={{ backgroundColor: bg, fontFamily }}>
          <div>
            <div className="font-bold tracking-tight mb-1" style={{ color: texto }}>matelaser studio</div>
            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: `${texto}70` }}>
              {datos.tagline ?? FOOTER_TAGLINE_DEFAULT}
            </p>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: texto }}>
            {grupoTienda.map((l, i) => <span key={i}>{l.label}</span>)}
          </div>
          <div className="flex gap-3 items-center text-xs" style={{ color: texto }}>
            {redes.map((r, i) => <span key={i}>{r.label}</span>)}
            <span style={{ color: `${texto}50` }}>{datos.copyright ?? FOOTER_COPYRIGHT_DEFAULT}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card del footer (dentro del tab Inicio, al final) ────────────────────────
// Mismo criterio que NavbarCard: el footer vive en el mismo array/endpoint
// que el resto de las secciones, pero no se reordena ni se elimina — se
// renderiza fijo al pie de TODAS las páginas del sitio, no solo el inicio.
export function FooterCard({ datos, set, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; tema: TemaGlobal;
}) {
  const [expandida, setExpandida] = useState(false);
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <Layout size={16} className="text-[var(--n-300)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Footer</div>
          <div className="text-xs text-[var(--ink-soft)] truncate">Fijo al pie de todas las páginas — no se reordena</div>
        </div>
        <button onClick={() => setExpandida(e => !e)}
          aria-label={expandida ? 'Colapsar footer' : 'Editar footer'}
          className="w-7 h-7 border border-[var(--line)] rounded-lg flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex-shrink-0">
          {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expandida && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-[var(--line)] px-4 pb-4 pt-3"
          >
            <FooterEditor datos={datos} set={set} tema={tema} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

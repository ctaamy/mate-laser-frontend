import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Layout } from 'lucide-react';
import SeccionImageUploader from '../../ui/SeccionImageUploader';
import type { TemaGlobal } from '../../../hooks/useThemeGlobal';
import { labelCls, inputCls, selectCls, FUENTES } from './constantes';
import { ColorField, Toggle, cargarGoogleFont } from './campos-comunes';
import { NAV_LINKS_DEFAULT } from './defaults';
import { EnlacesEditor } from './EnlacesEditor';

// ── Card del navbar (dentro del tab Inicio) ──────────────────────────────────
// El navbar vive en el mismo array/endpoint que el resto de las secciones
// (ver comentario de SeccionTipo más arriba), pero a diferencia de ellas no
// se reordena ni se elimina: se renderiza fijo arriba de TODAS las páginas
// del sitio (no solo el inicio), así que no tiene sentido moverlo entre
// Hero/Stats/etc. Por eso es una card fija al principio de la lista en vez
// de aparecer mezclado en el drag-and-drop.
export function NavbarCard({ datos, set, nombreTienda, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; nombreTienda: string; tema: TemaGlobal;
}) {
  const [expandida, setExpandida] = useState(false);
  return (
    // Nota: esta card usa deliberadamente una combinación de clases distinta
    // a la de SeccionCard (sin "overflow-hidden") — varios tests e2e ya
    // existentes ubican la primera sección reordenable con el selector
    // '.bg-white.border.rounded-xl.overflow-hidden', y esta card no debe
    // matchear esa consulta (no es una sección reordenable).
    <div className="bg-white border border-[var(--line)] rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <Layout size={16} className="text-[var(--n-300)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Navbar</div>
          <div className="text-xs text-[var(--ink-soft)] truncate">Fijo arriba de todas las páginas — no se reordena</div>
        </div>
        <button onClick={() => setExpandida(e => !e)}
          aria-label={expandida ? 'Colapsar navbar' : 'Editar navbar'}
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
            <NavbarEditor datos={datos} set={set} nombreTienda={nombreTienda} tema={tema} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Editor de navbar ──────────────────────────────────────────────────────────
function NavbarEditor({ datos, set, nombreTienda, tema }: {
  datos: Record<string, any>; set: (k: string, v: any) => void; nombreTienda: string; tema: TemaGlobal;
}) {
  // Consolidación de campos duplicados: antes había un input de URL manual +
  // preview + "Quitar imagen" a mano, MÁS el uploader con su propio fallback
  // de URL abajo — tres formas de tocar el mismo logo_url. Ahora es un único
  // flujo (preview + botón "Subir imagen" primario, ver SeccionImageUploader)
  // con la URL manual colapsada por default detrás de "o pegar una URL".
  const [mostrarUrlLogo, setMostrarUrlLogo] = useState(false);
  const bool = (k: string, def = true) => datos[k] ?? def;
  const tipoMenu: 'tradicional' | 'hamburguesa' = datos.tipo_menu === 'hamburguesa' ? 'hamburguesa' : 'tradicional';
  const menuPosicion: 'izquierda' | 'derecha' = datos.menu_posicion === 'izquierda' ? 'izquierda' : 'derecha';
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : NAV_LINKS_DEFAULT;

  return (
    <div className="flex flex-col gap-4">
      {/* Colores */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Colores</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">Vacío = hereda el color del tema global.</p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          <ColorField label="Color del texto / íconos" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
        </div>
        <div>
          <label className={labelCls}>Color del borde inferior / sombra</label>
          <div className="flex items-center gap-2">
            <input type="color" value={datos.border_color ?? '#f3f4f6'}
              onChange={e => set('border_color', e.target.value)}
              className="w-9 h-9 rounded-lg border border-[var(--line)] cursor-pointer p-0.5 bg-white" />
            <input className={inputCls} value={datos.border_color ?? '#f3f4f6'}
              onChange={e => set('border_color', e.target.value)} placeholder="#f3f4f6" />
          </div>
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

      {/* Logo */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Logo</div>
        <SeccionImageUploader
          value={datos.logo_url ?? ''}
          onChange={url => set('logo_url', url)}
          label="Logo de la tienda"
          mostrarUrlManual={false}
        />
        {!datos.logo_url && (
          <p className="text-[10px] text-[var(--ink-soft)] -mt-2">Si no se especifica una imagen, se muestra el nombre de la tienda como texto.</p>
        )}
        {mostrarUrlLogo ? (
          <div>
            <label className={labelCls}>URL del logo</label>
            <input className={inputCls} autoFocus value={datos.logo_url ?? ''} placeholder="https://..."
              onChange={e => set('logo_url', e.target.value)} />
          </div>
        ) : (
          <button type="button" onClick={() => setMostrarUrlLogo(true)}
            className="text-xs text-[var(--accent)] hover:underline self-start -mt-2">
            o pegar una URL
          </button>
        )}
        <div>
          <label className={labelCls}>Altura del logo (px)</label>
          <input className={inputCls} type="number" min={20} max={80} value={datos.logo_alto ?? '32'}
            onChange={e => set('logo_alto', e.target.value)} placeholder="32" />
        </div>
      </div>

      {/* Visibilidad de íconos */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-3">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Íconos visibles</div>
        <Toggle label="Buscador" desc="Muestra el ícono de búsqueda en la navbar"
          value={bool('mostrar_buscar')} onChange={v => set('mostrar_buscar', v)} />
        <Toggle label="Ícono de usuario" desc="Muestra el ícono de usuario / login"
          value={bool('mostrar_usuario')} onChange={v => set('mostrar_usuario', v)} />
        <Toggle label="Carrito" desc="Muestra el ícono del carrito con badge de items"
          value={bool('mostrar_carrito')} onChange={v => set('mostrar_carrito', v)} />
      </div>

      {/* Tipo de menú */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Tipo de menú</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">
          En pantallas chicas el menú siempre es hamburguesa (no rompe el layout con muchos links) —
          esta opción solo define cómo se ve en desktop/tablet.
        </p>
        <div className="flex gap-2">
          <button onClick={() => set('tipo_menu', 'tradicional')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${tipoMenu === 'tradicional' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--n-50)]'}`}>
            Tradicional
          </button>
          <button onClick={() => set('tipo_menu', 'hamburguesa')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${tipoMenu === 'hamburguesa' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--n-50)]'}`}>
            Hamburguesa
          </button>
        </div>
        {links.length > 6 && tipoMenu === 'tradicional' && (
          <p className="text-[10px] text-amber-600">
            {links.length} links puede verse apretado en modo Tradicional en pantallas más chicas de desktop — considerá Hamburguesa.
          </p>
        )}
      </div>

      {/* Posición del ícono hamburguesa */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Posición del ícono hamburguesa</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">
          En mobile el menú siempre es hamburguesa (ver arriba) — esta posición aplica ahí, y también en
          desktop/tablet si elegiste el tipo de menú Hamburguesa. El menú se despliega pegado al mismo lado del ícono.
        </p>
        <div className="flex gap-2">
          <button onClick={() => set('menu_posicion', 'izquierda')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${menuPosicion === 'izquierda' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--n-50)]'}`}>
            Izquierda
          </button>
          <button onClick={() => set('menu_posicion', 'derecha')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${menuPosicion === 'derecha' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--n-50)]'}`}>
            Derecha
          </button>
        </div>
      </div>

      <EnlacesEditor titulo="Links de navegación" enlaces={links} onChange={v => set('links', v)}
        placeholderLabel="Nuevo link" placeholderHref="/" />

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-[var(--line)]" data-testid="navbar-preview-editor">
        <div className="text-[10px] text-[var(--ink-soft)] uppercase tracking-wider px-3 py-1.5 bg-[var(--n-50)] border-b border-[var(--line)] font-semibold">Preview (desktop)</div>
        <NavbarPreviewBar datos={datos} tema={tema} nombreTienda={nombreTienda} />
      </div>
    </div>
  );
}

// Barra estática del navbar (sin routing, sin estado) — reusada dentro del
// mini-preview de NavbarCard y en el panel grande "Vista previa en vivo"
// (ScaledPreview), ambos alimentados por el mismo borrador en memoria.
export function NavbarPreviewBar({ datos, tema, nombreTienda }: {
  datos: Record<string, any>; tema: TemaGlobal; nombreTienda: string;
}) {
  const bool = (k: string, def = true) => datos[k] ?? def;
  const bg = datos.bg_color || tema.bg_color;
  const texto = datos.texto_color || tema.texto_color;
  const fontFamily = datos.font_family || tema.font_family || undefined;
  const tipoMenu: 'tradicional' | 'hamburguesa' = datos.tipo_menu === 'hamburguesa' ? 'hamburguesa' : 'tradicional';
  const menuPosicion: 'izquierda' | 'derecha' = datos.menu_posicion === 'izquierda' ? 'izquierda' : 'derecha';
  const links: { label: string; href: string }[] = Array.isArray(datos.links) ? datos.links : NAV_LINKS_DEFAULT;

  const hamburguesa = tipoMenu === 'hamburguesa' && (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: texto }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </div>
  );
  const logo = datos.logo_url
    ? <img src={datos.logo_url} alt="Logo" style={{ height: `${datos.logo_alto ?? 32}px` }} className="object-contain" />
    : <span className="text-base font-semibold whitespace-nowrap" style={{ color: texto }}>
        {nombreTienda || 'matelaser studio'}
      </span>;

  return (
    <div className="px-6 h-14 flex items-center justify-between gap-4"
      style={{ backgroundColor: bg, borderBottom: `1px solid ${datos.border_color || '#f3f4f6'}`, fontFamily }}>
      <div className="flex items-center gap-3">
        {menuPosicion === 'izquierda' && hamburguesa}
        {logo}
      </div>
      {tipoMenu === 'tradicional' && (
        <div className="flex items-center gap-4 flex-1 justify-center min-w-0 overflow-hidden">
          {links.map((l, i) => <span key={i} className="text-xs whitespace-nowrap" style={{ color: texto }}>{l.label}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2">
        {bool('mostrar_buscar') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>}
        {bool('mostrar_usuario') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>}
        {bool('mostrar_carrito') && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: texto }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>}
        {menuPosicion === 'derecha' && hamburguesa}
      </div>
    </div>
  );
}

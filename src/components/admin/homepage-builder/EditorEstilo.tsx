import { labelCls, inputCls, selectCls, SIZES, PADDINGS, ALINEACIONES, TRANSICIONES, PESOS, IMAGE_POSITIONS, OVERLAY_DIRECTIONS, FUENTES, GOOGLE_FONTS, COLUMNAS } from './constantes';
import { ColorField, SelectField, cargarGoogleFont } from './campos-comunes';
import type { TipoSeccion } from './types';

// ── Editor de ESTILO por tipo ────────────────────────────────────────────────
export function EditorEstilo({ tipo, datos, set }: {
  tipo: TipoSeccion; datos: Record<string, any>; set: (k: string, v: any) => void;
}) {
  // El overlay del hero aplica sobre la imagen del slide activo — hay que
  // mirar los slides (formato actual), no solo el campo legacy datos.imagen_url
  // (única imagen, formato previo a los slides múltiples).
  const heroTieneImagen = tipo === 'hero' && (!!datos.imagen_url || !!datos.slides?.some((s: any) => s.imagen_url));
  const tieneSubtitulo = ['hero', 'cta_banner', 'productos_destacados', 'categorias_grid', 'como_funciona', 'galeria_combos', 'newsletter'].includes(tipo);
  const tieneBotonesConColorPropio = tipo === 'hero' || tipo === 'cta_banner' || tipo === 'newsletter';

  return (
    <div className="flex flex-col gap-4">
      {/* Colores comunes */}
      <div>
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Colores</div>
        {(tipo === 'hero' || tieneBotonesConColorPropio) && (
          <p className="text-xs text-[var(--ink-soft)] -mt-1 mb-2">
            Esto es la base del bloque{tipo === 'hero' ? ' — un slide o un botón con su propio color (tab Contenido) lo pisa.' : ' — un botón con su propio color (tab Contenido) lo pisa.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {tipo !== 'banner_imagen' && (
            <ColorField label="Fondo del bloque (base)" value={datos.bg_color || ''} onChange={v => set('bg_color', v)} />
          )}
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <ColorField label="Texto del bloque (base)" value={datos.texto_color || ''} onChange={v => set('texto_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Color título" value={datos.titulo_color || ''} onChange={v => set('titulo_color', v)} />
          )}
          {tieneSubtitulo && (
            <ColorField label="Color subtítulo" value={datos.subtitulo_color || ''} onChange={v => set('subtitulo_color', v)} />
          )}
          {tipo === 'hero' && (
            <ColorField label="Color eyebrow" value={datos.eyebrow_color || ''} onChange={v => set('eyebrow_color', v)} />
          )}
          {tieneBotonesConColorPropio && (
            <ColorField label="Fondo botón (default)" value={datos.btn_color || ''} onChange={v => set('btn_color', v)} />
          )}
          {tieneBotonesConColorPropio && (
            <ColorField label="Texto botón (default)" value={datos.btn_texto_color || ''} onChange={v => set('btn_texto_color', v)} />
          )}
          {tipo === 'categorias_grid' && (
            <ColorField label="Color de acento (link 'Ver productos')" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
          {tipo === 'productos_destacados' && (
            <ColorField label="Color de acento (link 'Ver producto')" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
          {tipo === 'stats_barra' && (
            <ColorField label="Color del ícono (default: hereda el texto)" value={datos.icon_color || ''} onChange={v => set('icon_color', v)} />
          )}
          {tipo === 'como_funciona' && (
            <ColorField label="Color de acento (burbuja del ícono, línea conectora)" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
          {tipo === 'galeria_combos' && (
            <ColorField label="Color de acento (link 'Armá el tuyo')" value={datos.accent_color || ''} onChange={v => set('accent_color', v)} />
          )}
        </div>
        <p className="text-[10px] text-[var(--ink-soft)] mt-2">
          Por defecto, título y subtítulo usan el color de texto primario del tema (alto contraste). Para un look más sutil, elegí acá el color secundario del tema en vez de dejarlo en blanco.
        </p>
      </div>

      {heroTieneImagen && (
        <div>
          <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Imagen y overlay</div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Posición de la imagen" value={datos.image_position || 'bleed'} onChange={v => set('image_position', v)} options={IMAGE_POSITIONS} />
            <SelectField label="Dirección del overlay" value={datos.overlay_direction || 'left'} onChange={v => set('overlay_direction', v)} options={OVERLAY_DIRECTIONS} />
          </div>
          {datos.image_position === 'background' && !datos.overlay_direction && (
            <p className="text-[10px] text-amber-600 mt-2">
              Con imagen de fondo completa, sugerimos overlay "Completo (parejo)" con intensidad 45-55% para que el texto se lea bien.
            </p>
          )}
          {(datos.overlay_direction || 'left') !== 'none' && (
            <div className="mt-3">
              <label className={labelCls}>Intensidad del overlay: {datos.overlay_intensity ?? 60}%</label>
              <input type="range" min={0} max={100} value={datos.overlay_intensity ?? 60}
                onChange={e => set('overlay_intensity', parseInt(e.target.value))}
                className="w-full accent-[var(--accent)]" />
            </div>
          )}
        </div>
      )}

      {/* Tipografía */}
      {tipo !== 'banner_imagen' && (
        <div>
          <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Tipografía</div>
          <div className="grid grid-cols-2 gap-3">
            {/* Fuente — aplica a toda la sección */}
            <div className="col-span-2">
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
              {datos.font_family && GOOGLE_FONTS.includes(datos.font_family.split(',')[0].trim()) && (
                <p className="text-[10px] text-[var(--ink-soft)] mt-1">Google Font — se carga desde internet</p>
              )}
            </div>
            {['hero', 'productos_destacados', 'categorias_grid', 'galeria_combos'].includes(tipo) && (
              <SelectField label="Tamaño título" value={datos.titulo_size || 'lg'} onChange={v => set('titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'categorias_grid' && (
              <SelectField label="Tamaño nombre de categoría (dentro de cada card)" value={datos.item_titulo_size || 'sm'} onChange={v => set('item_titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'categorias_grid' && (
              <SelectField label='Tamaño link "Ver productos"' value={datos.item_link_size || 'xs'} onChange={v => set('item_link_size', v)} options={SIZES} />
            )}
            {tipo === 'productos_destacados' && (
              <SelectField label="Tamaño nombre de producto (dentro de cada card)" value={datos.item_titulo_size || 'sm'} onChange={v => set('item_titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'productos_destacados' && (
              <SelectField label='Tamaño precio / link "Ver producto"' value={datos.item_link_size || 'xs'} onChange={v => set('item_link_size', v)} options={SIZES} />
            )}
            {tipo === 'galeria_combos' && (
              <SelectField label="Tamaño nombre del combo (dentro de cada card)" value={datos.item_titulo_size || 'sm'} onChange={v => set('item_titulo_size', v)} options={SIZES} />
            )}
            {tipo === 'galeria_combos' && (
              <SelectField label='Tamaño link "Armá el tuyo"' value={datos.item_link_size || 'xs'} onChange={v => set('item_link_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso título" value={datos.titulo_font_weight || 'bold'} onChange={v => set('titulo_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente título (opcional, pisa la fuente del bloque)" value={datos.titulo_font_family || ''} onChange={v => { set('titulo_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Tamaño subtítulo" value={datos.subtitulo_size || 'xl'} onChange={v => set('subtitulo_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso subtítulo" value={datos.subtitulo_font_weight || 'normal'} onChange={v => set('subtitulo_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente subtítulo (opcional, pisa la fuente del bloque)" value={datos.subtitulo_font_family || ''} onChange={v => { set('subtitulo_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Tamaño eyebrow" value={datos.eyebrow_size || 'xs'} onChange={v => set('eyebrow_size', v)} options={SIZES} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Peso eyebrow" value={datos.eyebrow_font_weight || 'semibold'} onChange={v => set('eyebrow_font_weight', v)} options={PESOS} />
            )}
            {tipo === 'hero' && (
              <SelectField label="Fuente eyebrow (opcional, pisa la fuente del bloque)" value={datos.eyebrow_font_family || ''} onChange={v => { set('eyebrow_font_family', v); cargarGoogleFont(v); }} options={FUENTES} />
            )}
            {tipo === 'banner_texto' && (
              <SelectField label="Tamaño texto" value={datos.font_size || 'sm'} onChange={v => set('font_size', v)} options={SIZES} />
            )}
            {tipo === 'banner_texto' && (
              <SelectField label="Peso tipográfico" value={datos.font_weight || 'medium'} onChange={v => set('font_weight', v)} options={PESOS} />
            )}
          </div>
        </div>
      )}

      {/* Layout */}
      <div>
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">Layout</div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Espaciado vertical" value={datos.padding || 'md'} onChange={v => set('padding', v)} options={PADDINGS} />
          <SelectField label="Transición al bloque siguiente" value={datos.transicion_inferior || 'ninguna'} onChange={v => set('transicion_inferior', v)} options={TRANSICIONES} />
          {tipo !== 'banner_imagen' && tipo !== 'texto_libre' && (
            <SelectField label="Alineación" value={datos.alineacion || 'left'} onChange={v => set('alineacion', v)} options={ALINEACIONES} />
          )}
          {tipo === 'como_funciona' && (
            <SelectField label="Espaciado título → subtítulo" value={datos.titulo_subtitulo_gap || 'sm'} onChange={v => set('titulo_subtitulo_gap', v)} options={PADDINGS} />
          )}
          {['productos_destacados', 'categorias_grid', 'galeria_combos'].includes(tipo) && (
            <SelectField label="Columnas" value={String(datos.columnas || 3)} onChange={v => set('columnas', parseInt(v))} options={COLUMNAS} />
          )}
          {tipo !== 'banner_imagen' && (
            <div>
              <label className={labelCls}>Alto mínimo del bloque (px, vacío = automático)</label>
              <input className={inputCls} type="number" min={100} step={50} value={datos.min_height === 'auto' ? '' : datos.min_height || ''}
                onChange={e => set('min_height', e.target.value || 'auto')} placeholder={tipo === 'hero' ? '400' : 'auto'} />
            </div>
          )}
          {tipo === 'stats_barra' && (
            <div className="col-span-2">
              <label className={labelCls}>Escala general: {Math.round((datos.escala ?? 1) * 100)}%</label>
              <input type="range" min={0.4} max={2} step={0.05} value={datos.escala ?? 1}
                onChange={e => set('escala', parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)]" />
              <p className="text-[10px] text-[var(--ink-soft)] mt-1">Achica o agranda números, ícono, etiqueta y espaciado juntos, en proporción — sin tope mínimo fijo.</p>
            </div>
          )}
          {tipo === 'banner_imagen' && (
            <>
              <div>
                <label className={labelCls}>Altura máxima (px)</label>
                <input className={inputCls} type="number" value={datos.max_height || 300}
                  onChange={e => set('max_height', e.target.value)} />
              </div>
              <SelectField label="Ajuste imagen" value={datos.object_fit || 'cover'}
                onChange={v => set('object_fit', v)}
                options={[{ value: 'cover', label: 'Cubrir (recorta)' }, { value: 'contain', label: 'Contener (completa)' }]} />
              <SelectField label="Bordes redondeados" value={datos.border_radius || 'xl'}
                onChange={v => set('border_radius', v)}
                options={[{ value: 'none', label: 'Sin redondeo' }, { value: 'md', label: 'Suave' }, { value: 'xl', label: 'Redondo' }, { value: '2xl', label: 'Muy redondo' }]} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

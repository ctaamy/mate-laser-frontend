import SeccionImageUploader from '../../ui/SeccionImageUploader';
import { labelCls, inputCls, LAYOUTS_PRODUCTOS } from './constantes';
import { SelectField } from './campos-comunes';
import { IconPickerButton } from './IconPickerButton';
import { CategoriasGridEditor } from './CategoriasGridEditor';
import { FiltrosRapidosEditor } from './FiltrosRapidosEditor';
import { HeroSlidesEditor } from './HeroEditor';
import { BotonesEditor, resolverBotonesLegacy } from './BotonesEditor';
import { StatsBarraEditor } from './StatsBarraEditor';
import type { TipoSeccion } from './types';

// ── Editor de CONTENIDO por tipo ─────────────────────────────────────────────
export function EditorContenido({ tipo, datos, set }: {
  tipo: TipoSeccion; datos: Record<string, any>; set: (k: string, v: any) => void;
}) {
  if (tipo === 'hero') return <HeroSlidesEditor datos={datos} set={set} />;

  if (tipo === 'filtros_rapidos') return <FiltrosRapidosEditor datos={datos} set={set} />;

  if (tipo === 'galeria_combos') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Título de sección</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Cantidad de combos a mostrar (máx.)</label>
        <input className={inputCls} type="number" min={1} max={12} value={datos.cantidad || 6}
          onChange={e => set('cantidad', parseInt(e.target.value))} />
      </div>
      <p className="text-xs text-[var(--ink-soft)] bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-4 py-3">
        Los combos se traen automáticamente: primero los reales (armados por clientes a través de "Diseñá tu mate"), completando con los combos de ejemplo que cargues en <strong>Configurador → Combos de ejemplo</strong> solo si faltan para llegar a la cantidad configurada.
      </p>
    </div>
  );

  if (tipo === 'banner_texto') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Texto del banner</label>
        <input className={inputCls} value={datos.texto || ''} onChange={e => set('texto', e.target.value)} placeholder="Ej: Envío gratis a partir de $15.000" />
      </div>
      <div className="flex items-center justify-between bg-[var(--n-50)] rounded-lg px-4 py-3 border border-[var(--line)]">
        <div>
          <div className="text-sm font-medium">Modo ticker (marquee)</div>
          <div className="text-xs text-[var(--ink-soft)]">Texto en movimiento continuo</div>
        </div>
        <button
          onClick={() => set('marquee', !datos.marquee)}
          className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${datos.marquee ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${datos.marquee ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );

  if (tipo === 'productos_destacados') return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Título de sección</label>
          <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Cantidad a mostrar</label>
          <input className={inputCls} type="number" min={1} max={24} value={datos.cantidad || 8}
            onChange={e => set('cantidad', parseInt(e.target.value))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>
      <SelectField label="Estilo de cards" value={datos.layout || 'carrusel'} onChange={v => set('layout', v)} options={LAYOUTS_PRODUCTOS} />
    </div>
  );

  if (tipo === 'categorias_grid') return <CategoriasGridEditor datos={datos} set={set} />;

  if (tipo === 'texto_libre') return (
    <div>
      <label className={labelCls}>HTML</label>
      <textarea className={inputCls + ' h-32 resize-y font-mono text-xs'} value={datos.html || ''}
        onChange={e => set('html', e.target.value)} placeholder="<p>Tu contenido aquí...</p>" />
    </div>
  );

  if (tipo === 'banner_imagen') return (
    <div className="flex flex-col gap-3">
      <SeccionImageUploader
        label="Imagen del banner"
        value={datos.imagen_url || ''}
        onChange={v => set('imagen_url', v)}
      />
      <div>
        <label className={labelCls}>Link al hacer click (opcional)</label>
        <input className={inputCls} value={datos.link || ''} onChange={e => set('link', e.target.value)} placeholder="/productos" />
      </div>
    </div>
  );

  if (tipo === 'stats_barra') return <StatsBarraEditor datos={datos} set={set} />;

  if (tipo === 'como_funciona') {
    const pasos: { icono?: string; titulo: string; desc: string }[] = datos.pasos ?? [];
    const actualizarPaso = (i: number, patch: Partial<{ icono: string; titulo: string; desc: string }>) => {
      const np = [...pasos]; np[i] = { ...np[i], ...patch }; set('pasos', np);
    };
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Eyebrow (texto pequeño arriba del título, opcional)</label>
          <input className={inputCls} value={datos.eyebrow || ''} onChange={e => set('eyebrow', e.target.value)} placeholder="Ej: Proceso" />
        </div>
        <div>
          <label className={labelCls}>Título de sección</label>
          <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Subtítulo</label>
          <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
        </div>
        {pasos.map((p, i) => (
          <div key={i} className="border border-[var(--line)] rounded-lg p-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-[var(--ink-soft)]">Paso {i + 1}</div>
            <div className="flex items-center gap-2">
              <IconPickerButton value={p.icono} onChange={nombre => actualizarPaso(i, { icono: nombre })} />
              <input className={inputCls} value={p.titulo} placeholder="Título del paso"
                onChange={e => actualizarPaso(i, { titulo: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} value={p.desc} onChange={e => actualizarPaso(i, { desc: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tipo === 'cta_banner') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Texto sobre el título (eyebrow)</label>
        <input className={inputCls} value={datos.eyebrow || ''} onChange={e => set('eyebrow', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Título principal</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} />
      </div>
      <BotonesEditor botones={resolverBotonesLegacy(datos)} onChange={b => set('botones', b)} />
    </div>
  );

  if (tipo === 'newsletter') return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Título</label>
        <input className={inputCls} value={datos.titulo || ''} onChange={e => set('titulo', e.target.value)} placeholder="Sumate a la comunidad" />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input className={inputCls} value={datos.subtitulo || ''} onChange={e => set('subtitulo', e.target.value)} placeholder="Enterate primero de nuevos diseños y descuentos" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Placeholder del input</label>
          <input className={inputCls} value={datos.placeholder || ''} onChange={e => set('placeholder', e.target.value)} placeholder="Tu email" />
        </div>
        <div>
          <label className={labelCls}>Texto del botón</label>
          <input className={inputCls} value={datos.btn_texto || ''} onChange={e => set('btn_texto', e.target.value)} placeholder="Suscribirme" />
        </div>
      </div>
    </div>
  );

  return null;
}

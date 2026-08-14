import { labelCls, selectCls, FUENTES, GOOGLE_FONTS } from './constantes';
import { ColorField, FeedbackToast, cargarGoogleFont } from './campos-comunes';

// ── Editor de tema global ────────────────────────────────────────────────────
export function TemaEditor({ form, setForm, onAplicarATodo, onAplicar, aplicando, aplicadoOk }: {
  form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAplicarATodo: () => void; onAplicar: () => void; aplicando: boolean; aplicadoOk: boolean;
}) {
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Colores por defecto</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-2">
          Se aplican a todo el sitio salvo que un bloque tenga su propio color configurado.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Color de fondo" value={form.tema_bg_color ?? '#ffffff'} onChange={v => set('tema_bg_color', v)} />
          <ColorField label="Color de letra" value={form.tema_texto_color ?? '#111111'} onChange={v => set('tema_texto_color', v)} />
          <ColorField label="Color de letra secundario" value={form.tema_texto_secundario_color ?? '#6b7280'} onChange={v => set('tema_texto_secundario_color', v)} />
          <ColorField label="Color de acento" value={form.tema_accent_color ?? '#1D9E75'} onChange={v => set('tema_accent_color', v)} />
          <ColorField label='Color de badge (ej. "Apto grabado")' value={form.tema_badge_color ?? '#111111'} onChange={v => set('tema_badge_color', v)} />
        </div>
        <p className="text-[10px] text-[var(--ink-soft)] -mt-2">
          El acento se usa en links y detalles que necesitan destacar (ej. "Ver productos" de Categorías) — no reemplaza el color de letra.
          El color secundario es para texto de menor jerarquía (elegido explícitamente por elemento, no aplicado por opacidad).
          El color de badge es para etiquetas informativas sobre imágenes — deliberadamente distinto del acento, para no confundirse con un llamado a la acción.
        </p>
      </div>

      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Tipografía por defecto</div>
        <div>
          <label className={labelCls}>Fuente de letra</label>
          <select className={selectCls}
            value={form.tema_font_family ?? ''}
            onChange={e => { set('tema_font_family', e.target.value); cargarGoogleFont(e.target.value); }}
            style={{ fontFamily: form.tema_font_family || undefined }}>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.label}
              </option>
            ))}
          </select>
          {form.tema_font_family && GOOGLE_FONTS.includes(form.tema_font_family.split(',')[0].trim()) && (
            <p className="text-[10px] text-[var(--ink-soft)] mt-1">Google Font — se carga desde internet</p>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-[var(--line)]">
        <div className="text-[10px] text-[var(--ink-soft)] uppercase tracking-wider px-3 py-1.5 bg-[var(--n-50)] border-b border-[var(--line)] font-semibold">Preview</div>
        <div className="px-6 py-8"
          style={{
            backgroundColor: form.tema_bg_color || '#ffffff',
            color: form.tema_texto_color || '#111111',
            fontFamily: form.tema_font_family || undefined,
          }}>
          <p className="text-sm">Así se ve el texto por defecto del sitio.</p>
        </div>
      </div>

      {/* Aplicar a los bloques */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-3">
        <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Aplicar a los bloques</div>
        <p className="text-xs text-[var(--ink-soft)] -mt-1">
          Hace que los bloques, títulos/subtítulos y botones vuelvan a heredar el color y la tipografía de acá arriba,
          en vez de tener los suyos propios. Guarda automáticamente al ejecutarse.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onAplicar} disabled={aplicando}
            className="bg-[var(--n-100)] hover:bg-[var(--n-200)] text-[var(--ink)] rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
            Aplicar
          </button>
          <button onClick={onAplicarATodo} disabled={aplicando}
            className="bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
            Aplicar a todo
          </button>
        </div>
        <p className="text-[10px] text-[var(--ink-soft)]">
          <strong>Aplicar</strong>: solo normaliza los bloques/títulos/botones que ya no tenían color propio configurado — no toca lo que personalizaste a mano.<br />
          <strong>Aplicar a todo</strong>: borra el color y la tipografía propios de <em>todos</em> los bloques, títulos y botones, sin excepción. Pide confirmación.
        </p>
        <FeedbackToast show={aplicadoOk} className="text-xs text-[var(--accent)]">¡Guardado correctamente!</FeedbackToast>
      </div>
    </div>
  );
}

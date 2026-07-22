import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import api from '../../lib/api';

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-gray-400 transition-colors';
const labelCls = 'text-xs text-gray-500 mb-1 block font-medium';
const tabCls = (activo: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-lg ${activo ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`;

interface VarianteSelector {
  id: string;
  sku?: string | null;
  productos: { nombre: string; precio_base: number };
  imagenes_producto?: { url: string } | null;
}

function BuscadorVariante({
  label,
  onElegir,
  excluirId,
}: {
  label: string;
  onElegir: (v: VarianteSelector) => void;
  excluirId?: string;
}) {
  const [q, setQ] = useState('');
  const { data: variantes = [] } = useQuery<VarianteSelector[]>({
    queryKey: ['configurador-variantes', q],
    queryFn: () => api.get('/configurador/admin/variantes', { params: { q: q || undefined } }).then((r) => r.data),
  });

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre de producto..." />
      {q && (
        <div className="mt-1 border border-gray-100 rounded-lg max-h-48 overflow-y-auto">
          {variantes.filter((v) => v.id !== excluirId).length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-2">Sin resultados.</p>
          )}
          {variantes.filter((v) => v.id !== excluirId).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onElegir(v); setQ(''); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              {v.imagenes_producto?.url && <img src={v.imagenes_producto.url} alt="" className="w-6 h-6 object-cover rounded" />}
              <span>{v.productos.nombre}{v.sku ? ` (${v.sku})` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Sugerencias de bombilla (Paso 3) ──────────────────────────────────────
interface Sugerencia {
  id: string;
  orden: number;
  variante_origen: { productos: { nombre: string } };
  variante_sugerida: { productos: { nombre: string } };
}

function TabSugerencias() {
  const queryClient = useQueryClient();
  const [origen, setOrigen] = useState<VarianteSelector | null>(null);
  const [sugerida, setSugerida] = useState<VarianteSelector | null>(null);

  const { data: sugerencias = [], isLoading } = useQuery<Sugerencia[]>({
    queryKey: ['configurador-admin-sugerencias'],
    queryFn: () => api.get('/configurador/admin/sugerencias').then((r) => r.data),
  });

  const crear = useMutation({
    mutationFn: () => api.post('/configurador/admin/sugerencias', { variante_origen_id: origen!.id, variante_sugerida_id: sugerida!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-sugerencias'] });
      setOrigen(null);
      setSugerida(null);
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete(`/configurador/admin/sugerencias/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-sugerencias'] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-900">Nueva sugerencia</p>
        <p className="text-xs text-gray-400">Para una variante de mate, elegí qué variante de bombilla sugerir en el Paso 3.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <BuscadorVariante label="Variante de mate" onElegir={setOrigen} />
            {origen && (
              <p className="text-xs mt-1 flex items-center gap-2">
                <Check size={12} className="text-green-600" /> {origen.productos.nombre}
                <button type="button" onClick={() => setOrigen(null)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
              </p>
            )}
          </div>
          <div>
            <BuscadorVariante label="Variante de bombilla sugerida" onElegir={setSugerida} excluirId={origen?.id} />
            {sugerida && (
              <p className="text-xs mt-1 flex items-center gap-2">
                <Check size={12} className="text-green-600" /> {sugerida.productos.nombre}
                <button type="button" onClick={() => setSugerida(null)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={!origen || !sugerida || crear.isPending}
          onClick={() => crear.mutate()}
          className="self-start px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
        >
          {crear.isPending ? 'Guardando...' : 'Agregar sugerencia'}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Cargando...</div>
        ) : sugerencias.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Sin sugerencias cargadas todavía.</div>
        ) : (
          sugerencias.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-50 last:border-b-0">
              <span>{s.variante_origen.productos.nombre} <span className="text-gray-400">→</span> {s.variante_sugerida.productos.nombre}</span>
              <button onClick={() => eliminar.mutate(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tab: Anclajes de composición visual (Paso 3/preview) ───────────────────────
interface Anclaje {
  anclaje_x: number;
  anclaje_y: number;
  rotacion: number;
  escala: number;
}

function TabAnclajes() {
  const queryClient = useQueryClient();
  const [variante, setVariante] = useState<VarianteSelector | null>(null);
  const [form, setForm] = useState<Anclaje>({ anclaje_x: 50, anclaje_y: 50, rotacion: 0, escala: 1 });

  const { data: existente } = useQuery<Anclaje | null>({
    queryKey: ['configurador-admin-anclaje', variante?.id],
    queryFn: () => api.get(`/configurador/admin/anclaje/${variante!.id}`).then((r) => r.data),
    enabled: !!variante,
  });

  const guardar = useMutation({
    mutationFn: () => api.put(`/configurador/admin/anclaje/${variante!.id}`, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-anclaje', variante?.id] }),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/configurador/admin/anclaje/${variante!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-anclaje', variante?.id] });
      setForm({ anclaje_x: 50, anclaje_y: 50, rotacion: 0, escala: 1 });
    },
  });

  const elegirVariante = (v: VarianteSelector) => {
    setVariante(v);
    setForm({ anclaje_x: 50, anclaje_y: 50, rotacion: 0, escala: 1 });
  };

  const campos = existente ?? form;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-4 max-w-lg">
      <p className="text-sm font-semibold text-gray-900">Punto de anclaje para componer bombilla sobre mate</p>
      <p className="text-xs text-gray-400">
        Si no configurás un anclaje para una variante de mate, el preview del configurador muestra las imágenes de mate y bombilla por separado (fallback automático).
      </p>
      <BuscadorVariante label="Variante de mate" onElegir={elegirVariante} />
      {variante && (
        <>
          <p className="text-xs flex items-center gap-2">
            <Check size={12} className="text-green-600" /> {variante.productos.nombre}
            {existente && <span className="text-gray-400">— ya tiene anclaje configurado</span>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Posición X (%)</label>
              <input className={inputCls} type="number" value={campos.anclaje_x} onChange={(e) => setForm({ ...campos, anclaje_x: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Posición Y (%)</label>
              <input className={inputCls} type="number" value={campos.anclaje_y} onChange={(e) => setForm({ ...campos, anclaje_y: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Rotación (grados)</label>
              <input className={inputCls} type="number" value={campos.rotacion} onChange={(e) => setForm({ ...campos, rotacion: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Escala</label>
              <input className={inputCls} type="number" step="0.1" value={campos.escala} onChange={(e) => setForm({ ...campos, escala: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar anclaje'}
            </button>
            {existente && (
              <button
                type="button"
                onClick={() => eliminar.mutate()}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50"
              >
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Diseños predeterminados de grabado (Paso 4) ────────────────────────────
interface DisenoPredeterminado {
  id: string;
  nombre: string;
  imagen_url: string;
  orden: number;
  activo: boolean;
}

function DisenoModal({ diseno, onClose }: { diseno?: DisenoPredeterminado | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editando = !!diseno;
  const [form, setForm] = useState({
    nombre: diseno?.nombre ?? '',
    imagen_url: diseno?.imagen_url ?? '',
    orden: diseno?.orden?.toString() ?? '0',
    activo: diseno?.activo ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      editando ? api.put(`/configurador/admin/disenos-predeterminados/${diseno!.id}`, data) : api.post('/configurador/admin/disenos-predeterminados', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-disenos'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      nombre: form.nombre.trim(),
      imagen_url: form.imagen_url.trim(),
      orden: parseInt(form.orden) || 0,
      activo: form.activo,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">{editando ? 'Editar diseño' : 'Nuevo diseño'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Imagen (URL) *</label>
            <input className={inputCls} value={form.imagen_url} onChange={(e) => setForm((f) => ({ ...f, imagen_url: e.target.value }))} required />
            {form.imagen_url.trim() && <img src={form.imagen_url.trim()} alt="" className="mt-2 w-16 h-16 object-cover rounded-lg border border-gray-100" />}
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input className={inputCls} type="number" value={form.orden} onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
            Activo (visible en el configurador)
          </label>
          {mutation.isError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">Error al guardar.</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {mutation.isPending ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar' : 'Crear'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabDisenos() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; diseno: DisenoPredeterminado | null }>({ open: false, diseno: null });

  const { data: disenos = [], isLoading } = useQuery<DisenoPredeterminado[]>({
    queryKey: ['configurador-admin-disenos'],
    queryFn: () => api.get('/configurador/admin/disenos-predeterminados').then((r) => r.data),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete(`/configurador/admin/disenos-predeterminados/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-disenos'] }),
  });

  const toggleActivo = (d: DisenoPredeterminado) => {
    api.put(`/configurador/admin/disenos-predeterminados/${d.id}`, { activo: !d.activo }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-disenos'] })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setModal({ open: true, diseno: null })}
        className="self-start flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700"
      >
        <Plus size={15} /> Nuevo diseño
      </button>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Cargando...</div>
      ) : disenos.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-14 text-center">
          <p className="text-sm text-gray-400">No hay diseños predeterminados todavía</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {disenos.map((d) => (
            <div key={d.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <img src={d.imagen_url} alt={d.nombre} className="w-full h-28 object-cover" />
              <div className="p-3">
                <p className="text-sm font-medium truncate">{d.nombre}</p>
                {!d.activo && <p className="text-[10px] text-red-400">Inactivo</p>}
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={() => toggleActivo(d)} className="text-[11px] font-medium text-gray-500 hover:text-gray-900 px-2 py-1">
                    {d.activo ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button onClick={() => setModal({ open: true, diseno: d })} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => eliminar.mutate(d.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && <DisenoModal diseno={modal.diseno} onClose={() => setModal({ open: false, diseno: null })} />}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function AdminConfiguradorV2() {
  const [tab, setTab] = useState<'sugerencias' | 'anclajes' | 'disenos'>('sugerencias');

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configurador "Diseñá tu mate" v2</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Sugerencias de bombilla, composición visual y diseños de grabado. Ruta pública: /disena-tu-mate-v2. Las imágenes por subcategoría del Paso 1 se configuran en Categorías.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl w-fit">
        <button className={tabCls(tab === 'sugerencias')} onClick={() => setTab('sugerencias')}>Sugerencias de bombilla</button>
        <button className={tabCls(tab === 'anclajes')} onClick={() => setTab('anclajes')}>Anclajes (preview)</button>
        <button className={tabCls(tab === 'disenos')} onClick={() => setTab('disenos')}>Diseños de grabado</button>
      </div>

      {tab === 'sugerencias' && <TabSugerencias />}
      {tab === 'anclajes' && <TabAnclajes />}
      {tab === 'disenos' && <TabDisenos />}
    </div>
  );
}

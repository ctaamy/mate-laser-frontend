import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../lib/api';

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-gray-400 transition-colors';
const labelCls = 'text-xs text-gray-500 mb-1 block font-medium';

interface Opcion {
  id: string;
  variante_id: string;
  nombre_visible?: string | null;
  descripcion_corta?: string | null;
  imagen_url?: string | null;
  orden: number;
  visible: boolean;
  variantes_producto?: {
    precio_override?: number | null;
    stock: number;
    activo: boolean;
    productos: { nombre: string; precio_base: number };
    imagenes_producto?: { url: string } | null;
  };
}

interface Paso {
  id: string;
  nombre: string;
  slug: string;
  orden: number;
  salteable: boolean;
  nota_texto?: string | null;
  permite_upload: boolean;
  es_resumen: boolean;
  activo: boolean;
  opciones: Opcion[];
}

interface VarianteSelector {
  id: string;
  sku?: string | null;
  precio_override?: number | null;
  stock: number;
  activo: boolean;
  productos: { nombre: string; precio_base: number };
  imagenes_producto?: { url: string } | null;
}

function PasoModal({ paso, onClose }: { paso?: Paso | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editando = !!paso;
  const [form, setForm] = useState({
    nombre: paso?.nombre ?? '',
    slug: paso?.slug ?? '',
    orden: paso?.orden?.toString() ?? '0',
    salteable: paso?.salteable ?? false,
    nota_texto: paso?.nota_texto ?? '',
    permite_upload: paso?.permite_upload ?? false,
    es_resumen: paso?.es_resumen ?? false,
    activo: paso?.activo ?? true,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      editando ? api.put(`/configurador/admin/pasos/${paso!.id}`, data) : api.post('/configurador/admin/pasos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      nombre: form.nombre.trim(),
      slug: form.slug.trim(),
      orden: parseInt(form.orden) || 0,
      salteable: form.salteable,
      nota_texto: form.nota_texto.trim() || undefined,
      permite_upload: form.permite_upload,
      es_resumen: form.es_resumen,
      activo: form.activo,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">{editando ? 'Editar paso' : 'Nuevo paso'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div>
            <label className={labelCls}>Slug *</label>
            <input className={inputCls} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required placeholder="material" />
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input className={inputCls} type="number" value={form.orden} onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Nota / aviso (ej. WhatsApp)</label>
            <textarea className={inputCls + ' resize-none h-20 text-xs'} value={form.nota_texto} onChange={(e) => setForm((f) => ({ ...f, nota_texto: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.salteable} onChange={(e) => setForm((f) => ({ ...f, salteable: e.target.checked }))} />
              Salteable
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.permite_upload} onChange={(e) => setForm((f) => ({ ...f, permite_upload: e.target.checked }))} />
              Permite subir imagen de referencia
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.es_resumen} onChange={(e) => setForm((f) => ({ ...f, es_resumen: e.target.checked }))} />
              Es el paso de resumen final
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
              Activo
            </label>
          </div>
          {mutation.isError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">Error al guardar. Verificá que el slug no esté repetido.</p>}
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

function OpcionModal({ pasoId, opcion, onClose }: { pasoId: string; opcion?: Opcion | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editando = !!opcion;
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState({
    variante_id: opcion?.variante_id ?? '',
    nombre_visible: opcion?.nombre_visible ?? '',
    descripcion_corta: opcion?.descripcion_corta ?? '',
    imagen_url: opcion?.imagen_url ?? '',
    orden: opcion?.orden?.toString() ?? '0',
    visible: opcion?.visible ?? true,
  });

  const { data: variantes = [] } = useQuery<VarianteSelector[]>({
    queryKey: ['configurador-variantes', busqueda],
    queryFn: () => api.get('/configurador/admin/variantes', { params: { q: busqueda || undefined } }).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      editando ? api.put(`/configurador/admin/opciones/${opcion!.id}`, data) : api.post(`/configurador/admin/pasos/${pasoId}/opciones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      variante_id: form.variante_id,
      nombre_visible: form.nombre_visible.trim() || undefined,
      descripcion_corta: form.descripcion_corta.trim() || undefined,
      imagen_url: form.imagen_url.trim() || undefined,
      orden: parseInt(form.orden) || 0,
      visible: form.visible,
    });
  };

  const varianteElegida = variantes.find((v) => v.id === form.variante_id);

  const handleElegirVariante = (id: string) => {
    const v = variantes.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      variante_id: id,
      // Solo autocompletar si el campo estaba vacío (no pisar texto ya editado por el admin).
      nombre_visible: f.nombre_visible || v?.productos.nombre || '',
    }));
  };

  const imagenPreview = form.imagen_url.trim() || varianteElegida?.imagenes_producto?.url || '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">{editando ? 'Editar opción' : 'Nueva opción'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Buscar variante por producto</label>
            <input className={inputCls} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: Mate Torpedo" />
          </div>
          <div>
            <label className={labelCls}>Variante *</label>
            <select
              className={inputCls}
              value={form.variante_id}
              onChange={(e) => handleElegirVariante(e.target.value)}
              disabled={editando}
              required
            >
              <option value="">— Elegí una variante —</option>
              {variantes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.productos.nombre} {v.sku ? `(${v.sku})` : ''}
                </option>
              ))}
            </select>
            {editando && <p className="text-[10px] text-gray-400 mt-1">La variante no se puede cambiar. Si necesitás otra, eliminá esta opción y creá una nueva.</p>}
            {varianteElegida && (
              <p className="text-[10px] text-gray-400 mt-1">
                Precio: ${Number(varianteElegida.precio_override ?? varianteElegida.productos.precio_base).toLocaleString('es-AR')} · Stock: {varianteElegida.stock} (solo lectura)
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Nombre visible (editable, prellenado con el nombre del producto)</label>
            <input className={inputCls} value={form.nombre_visible} onChange={(e) => setForm((f) => ({ ...f, nombre_visible: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Descripción corta</label>
            <textarea className={inputCls + ' resize-none h-16 text-xs'} value={form.descripcion_corta} onChange={(e) => setForm((f) => ({ ...f, descripcion_corta: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Imagen (URL, opcional — si se deja vacío usa la imagen principal de la variante)</label>
            <input className={inputCls} value={form.imagen_url} onChange={(e) => setForm((f) => ({ ...f, imagen_url: e.target.value }))} />
            {imagenPreview && (
              <img src={imagenPreview} alt="" className="mt-2 w-16 h-16 object-cover rounded-lg border border-gray-100" />
            )}
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input className={inputCls} type="number" value={form.orden} onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))} />
            Visible en el configurador
          </label>
          {mutation.isError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">Error al guardar.</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={mutation.isPending || !form.variante_id} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {mutation.isPending ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar' : 'Crear'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminConfigurador() {
  const queryClient = useQueryClient();
  const [pasoModal, setPasoModal] = useState<{ open: boolean; paso: Paso | null }>({ open: false, paso: null });
  const [opcionModal, setOpcionModal] = useState<{ open: boolean; pasoId: string; opcion: Opcion | null }>({ open: false, pasoId: '', opcion: null });
  const [pasoExpandido, setPasoExpandido] = useState<string | null>(null);

  const { data: pasos = [], isLoading } = useQuery<Paso[]>({
    queryKey: ['configurador-admin-pasos'],
    queryFn: () => api.get('/configurador/admin/pasos').then((r) => r.data),
  });

  const deletePasoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/configurador/admin/pasos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] }),
  });

  const deleteOpcionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/configurador/admin/opciones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] }),
  });

  const toggleOpcionVisible = (op: Opcion) => {
    api.put(`/configurador/admin/opciones/${op.id}`, { visible: !op.visible }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] })
    );
  };

  const reordenarMutation = useMutation({
    mutationFn: ({ id, orden }: { id: string; orden: number }) => api.put(`/configurador/admin/pasos/${id}`, { orden }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] }),
  });

  const moverPaso = (paso: Paso, direccion: -1 | 1) => {
    const ordenados = [...pasos].sort((a, b) => a.orden - b.orden);
    const idx = ordenados.findIndex((p) => p.id === paso.id);
    const vecino = ordenados[idx + direccion];
    if (!vecino) return;
    reordenarMutation.mutate({ id: paso.id, orden: vecino.orden });
    reordenarMutation.mutate({ id: vecino.id, orden: paso.orden });
  };

  const toggleActivo = (paso: Paso) => {
    api.put(`/configurador/admin/pasos/${paso.id}`, { activo: !paso.activo }).then(() =>
      queryClient.invalidateQueries({ queryKey: ['configurador-admin-pasos'] })
    );
  };

  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden);

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Configurador "Diseñá tu mate"</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestioná los pasos y opciones del configurador. Ruta pública: /disena-tu-mate</p>
        </div>
        <button
          onClick={() => setPasoModal({ open: true, paso: null })}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700"
        >
          <Plus size={15} /> Nuevo paso
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Cargando...</div>
      ) : ordenados.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-14 text-center">
          <p className="text-sm text-gray-400">No hay pasos configurados todavía</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ordenados.map((paso, i) => (
            <div key={paso.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <button disabled={i === 0} onClick={() => moverPaso(paso, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowUp size={13} /></button>
                  <button disabled={i === ordenados.length - 1} onClick={() => moverPaso(paso, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowDown size={13} /></button>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setPasoExpandido((p) => (p === paso.id ? null : paso.id))}>
                  <span className="text-sm font-semibold text-gray-900">{paso.nombre}</span>
                  <span className="ml-2 text-[10px] text-gray-400 font-mono">{paso.slug}</span>
                  {!paso.activo && <span className="ml-2 text-[10px] text-red-400">Inactivo</span>}
                  {paso.salteable && <span className="ml-2 text-[10px] text-gray-400">Salteable</span>}
                  {paso.es_resumen && <span className="ml-2 text-[10px] text-gray-400">Resumen</span>}
                  <span className="ml-2 text-[10px] text-gray-400">{paso.opciones.filter((o) => o.visible).length} opciones</span>
                </div>
                <button onClick={() => toggleActivo(paso)} className="text-[11px] font-medium text-gray-500 hover:text-gray-900 px-2 py-1">
                  {paso.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => setPasoModal({ open: true, paso })} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => { if (confirm(`¿Eliminar el paso "${paso.nombre}"?`)) deletePasoMutation.mutate(paso.id); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {pasoExpandido === paso.id && !paso.es_resumen && (
                <div className="border-t border-gray-50 p-4 flex flex-col gap-2">
                  {paso.opciones.length === 0 && <p className="text-xs text-gray-400 mb-2">Sin opciones todavía — conectá una variante de producto con "Agregar opción"</p>}
                  {paso.opciones.map((op) => {
                    const v = op.variantes_producto;
                    const imagen = op.imagen_url || v?.imagenes_producto?.url;
                    const precio = v ? Number(v.precio_override ?? v.productos.precio_base) : null;
                    return (
                      <div key={op.id} className="flex items-center gap-3 text-sm border border-gray-100 rounded-lg px-3 py-2">
                        {imagen ? (
                          <img src={imagen} alt="" className="w-9 h-9 object-cover rounded-md flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-gray-50 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{op.nombre_visible || v?.productos.nombre || '(sin nombre)'}</div>
                          <div className="text-[10px] text-gray-400">
                            {precio != null ? `$${precio.toLocaleString('es-AR')}` : '—'} · Stock: {v?.stock ?? '—'} · Orden {op.orden}
                          </div>
                        </div>
                        {!op.visible && <span className="text-[10px] text-red-400">Oculta</span>}
                        <button onClick={() => toggleOpcionVisible(op)} className="text-[11px] font-medium text-gray-500 hover:text-gray-900 px-2 py-1">
                          {op.visible ? 'Ocultar' : 'Mostrar'}
                        </button>
                        <button onClick={() => setOpcionModal({ open: true, pasoId: paso.id, opcion: op })} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                        <button onClick={() => deleteOpcionMutation.mutate(op.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setOpcionModal({ open: true, pasoId: paso.id, opcion: null })}
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    <Plus size={13} /> Agregar opción
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pasoModal.open && <PasoModal paso={pasoModal.paso} onClose={() => setPasoModal({ open: false, paso: null })} />}
      {opcionModal.open && (
        <OpcionModal pasoId={opcionModal.pasoId} opcion={opcionModal.opcion} onClose={() => setOpcionModal({ open: false, pasoId: '', opcion: null })} />
      )}
    </div>
  );
}

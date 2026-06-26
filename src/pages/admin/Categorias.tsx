import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, FolderOpen, Folder, X, Check } from 'lucide-react';
import api from '../../lib/api';
import type { Categoria } from '../../types/index';

// ── helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-gray-400 transition-colors';
const labelCls = 'text-xs text-gray-500 mb-1 block font-medium';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Modal crear/editar categoría ──────────────────────────────────────────────
interface FormData { nombre: string; slug: string; descripcion: string; padre_id: string; orden: string }

function CategoriaModal({
  categoria, categoriasPadre, onClose,
}: {
  categoria?: Categoria | null;
  categoriasPadre: Categoria[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editando = !!categoria;

  const [form, setForm] = useState<FormData>({
    nombre: categoria?.nombre ?? '',
    slug: categoria?.slug ?? '',
    descripcion: categoria?.descripcion ?? '',
    padre_id: categoria?.padre_id?.toString() ?? '',
    orden: categoria?.orden?.toString() ?? '0',
  });
  const [slugManual, setSlugManual] = useState(editando);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleNombre = (v: string) => {
    set('nombre', v);
    if (!slugManual) set('slug', toSlug(v));
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      editando
        ? api.put(`/categorias/${categoria!.id}`, data)
        : api.post('/categorias', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      queryClient.invalidateQueries({ queryKey: ['categorias-admin'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      nombre: form.nombre.trim(),
      slug: form.slug.trim(),
      descripcion: form.descripcion.trim() || undefined,
      orden: parseInt(form.orden) || 0,
    };
    if (form.padre_id) payload.padre_id = parseInt(form.padre_id);
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-sm">{editando ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Nombre */}
          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={e => handleNombre(e.target.value)}
              placeholder="Ej: Mate" required autoFocus />
          </div>

          {/* Slug */}
          <div>
            <label className={labelCls}>Slug (URL) *</label>
            <input className={inputCls} value={form.slug}
              onChange={e => { setSlugManual(true); set('slug', e.target.value); }}
              placeholder="mate" required />
            <p className="text-[10px] text-gray-400 mt-1">Se usa en la URL: /productos?categoria={form.slug || 'mate'}</p>
          </div>

          {/* Categoría padre */}
          <div>
            <label className={labelCls}>Categoría padre (opcional)</label>
            <select className={inputCls} value={form.padre_id} onChange={e => set('padre_id', e.target.value)}>
              <option value="">— Sin padre (categoría raíz) —</option>
              {categoriasPadre
                .filter(c => c.id !== categoria?.id)
                .map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea className={inputCls + ' resize-none h-16 text-xs'} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)} placeholder="Descripción opcional" />
          </div>

          {/* Orden */}
          <div>
            <label className={labelCls}>Orden de aparición</label>
            <input className={inputCls} type="number" min={0} value={form.orden}
              onChange={e => set('orden', e.target.value)} />
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              Error al guardar. Verificá que el slug no esté repetido.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {mutation.isPending ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar' : 'Crear'}</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Fila de subcategoría ──────────────────────────────────────────────────────
function SubcategoriaRow({
  cat, todasPadre, onEdit, onDelete,
}: { cat: Categoria; todasPadre: Categoria[]; onEdit: (c: Categoria) => void; onDelete: (c: Categoria) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 ml-6 pl-4 py-2.5 border-l border-gray-100 group"
    >
      <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{cat.nombre}</span>
        <span className="ml-2 text-[10px] text-gray-400 font-mono">{cat.slug}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(cat)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(cat)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Fila de categoría padre ───────────────────────────────────────────────────
function CategoriaRow({
  cat, todasPadre, onEdit, onDelete, onAgregarHijo,
}: {
  cat: Categoria; todasPadre: Categoria[];
  onEdit: (c: Categoria) => void; onDelete: (c: Categoria) => void; onAgregarHijo: (padre: Categoria) => void;
}) {
  const [abierta, setAbierta] = useState(true);
  const hijos: Categoria[] = (cat as any).other_categorias ?? [];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header categoría padre */}
      <div className="flex items-center gap-3 px-4 py-3 group">
        <button onClick={() => setAbierta(a => !a)}
          className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {abierta ? <FolderOpen size={16} className="text-gray-400 flex-shrink-0" /> : <Folder size={16} className="text-gray-400 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900">{cat.nombre}</span>
          <span className="ml-2 text-[10px] text-gray-400 font-mono">{cat.slug}</span>
          {hijos.length > 0 && (
            <span className="ml-2 text-[10px] text-gray-400">{hijos.length} subcategoría{hijos.length > 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onAgregarHijo(cat)}
            className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <Plus size={11} /> Sub
          </button>
          <button onClick={() => onEdit(cat)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(cat)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Subcategorías */}
      <AnimatePresence>
        {abierta && hijos.length > 0 && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-50 pb-1"
          >
            {hijos.map(h => (
              <SubcategoriaRow key={h.id} cat={h} todasPadre={todasPadre} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminCategorias() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [padrePreseleccionado, setPadrePreseleccionado] = useState<number | null>(null);

  // Traemos TODAS las categorías (incluyendo inactivas para el admin)
  const { data: todasRaw = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ['categorias-admin'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  // Separamos padres (sin padre_id) e hijos
  const padres = todasRaw.filter(c => !c.padre_id);
  // Las categorías raíz para el select "padre" del modal
  const opcionesPadre = padres;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categorias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      queryClient.invalidateQueries({ queryKey: ['categorias-admin'] });
    },
  });

  const handleEditar = (cat: Categoria) => { setEditando(cat); setPadrePreseleccionado(null); setModalAbierto(true); };
  const handleNueva = () => { setEditando(null); setPadrePreseleccionado(null); setModalAbierto(true); };
  const handleAgregarHijo = (padre: Categoria) => {
    // Abre el modal con la categoría padre preseleccionada
    setEditando({ nombre: '', slug: '', id: 0, padre_id: padre.id, orden: 0, activo: true } as any);
    setModalAbierto(true);
  };
  const handleEliminar = (cat: Categoria) => {
    if (confirm(`¿Eliminar "${cat.nombre}"? Los productos de esta categoría quedarán sin categoría.`))
      deleteMutation.mutate(cat.id);
  };
  const handleClose = () => { setModalAbierto(false); setEditando(null); };

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Categorías</h1>
          <p className="text-sm text-gray-400 mt-0.5">Organizá tus productos en categorías y subcategorías</p>
        </div>
        <button onClick={handleNueva}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
          <Plus size={15} /> Nueva categoría
        </button>
      </div>

      {/* Árbol de categorías */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Cargando...</div>
      ) : padres.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-14 text-center">
          <p className="text-sm text-gray-400 mb-3">No hay categorías todavía</p>
          <button onClick={handleNueva}
            className="text-sm font-medium text-gray-700 underline underline-offset-2">
            Crear la primera
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {padres.map(cat => (
            <CategoriaRow
              key={cat.id}
              cat={cat}
              todasPadre={opcionesPadre}
              onEdit={handleEditar}
              onDelete={handleEliminar}
              onAgregarHijo={handleAgregarHijo}
            />
          ))}
        </div>
      )}

      {/* Ayuda */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
        <strong className="text-gray-700">Jerarquía:</strong> Las categorías raíz (sin padre) aparecen como secciones principales.
        Usá <strong className="text-gray-700">+ Sub</strong> para agregar subcategorías dentro de una categoría padre.
        Ejemplo: <span className="font-mono bg-gray-100 px-1 rounded">Mate</span> → <span className="font-mono bg-gray-100 px-1 rounded">Calabaza</span>, <span className="font-mono bg-gray-100 px-1 rounded">Algarrobo</span>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalAbierto && (
          <CategoriaModal
            categoria={editando?.id === 0 ? null : editando}
            categoriasPadre={opcionesPadre}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

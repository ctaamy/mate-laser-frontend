import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, FolderOpen, Folder, X, Check } from 'lucide-react';
import api from '../../lib/api';
import type { Categoria } from '../../types/index';
import AdminButton from './ui/AdminButton';

// Antes vivía en pages/admin/Categorias.tsx como ruta de primer nivel
// (/admin/categorias). Ahora es un panel reusado dentro del tab "Categorías"
// de la página de Productos — mismo componente, sin ruta propia.

// ── helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'border border-[var(--line)] rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-[var(--accent)] transition-colors';
const labelCls = 'text-xs text-[var(--ink-soft)] mb-1 block font-medium';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Modal crear/editar categoría ──────────────────────────────────────────────
interface FormData { nombre: string; slug: string; descripcion: string; padre_id: string; orden: string; imagen_configurador_url: string }

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
    imagen_configurador_url: categoria?.imagen_configurador_url ?? '',
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
      imagen_configurador_url: form.imagen_configurador_url.trim() || undefined,
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
        className="bg-[var(--panel)] rounded-[var(--radius-card)] w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h2 className="font-semibold text-sm text-[var(--ink)]">{editando ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button onClick={onClose} className="text-[var(--ink-soft)] hover:text-[var(--ink)]"><X size={16} /></button>
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
            <p className="text-[10px] text-[var(--ink-soft)] mt-1">Se usa en la URL: /productos?categoria={form.slug || 'mate'}</p>
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

          {/* Imagen del configurador (solo relevante para subcategorías de "Mates", Paso 1) */}
          <div>
            <label className={labelCls}>Imagen para "Diseñá tu mate" (URL, opcional)</label>
            <input className={inputCls} value={form.imagen_configurador_url}
              onChange={e => set('imagen_configurador_url', e.target.value)}
              placeholder="https://..." />
            <p className="text-[10px] text-[var(--ink-soft)] mt-1">Se muestra en el Paso 1 del configurador si esta categoría es subcategoría de "Mates".</p>
            {form.imagen_configurador_url.trim() && (
              <img src={form.imagen_configurador_url.trim()} alt="" className="mt-2 w-16 h-16 object-cover rounded-lg border border-[var(--line)]" />
            )}
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              Error al guardar. Verificá que el slug no esté repetido.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <AdminButton type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </AdminButton>
            <AdminButton type="submit" variant="primary" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar' : 'Crear'}</>}
            </AdminButton>
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
      className="flex items-center gap-3 ml-6 pl-4 py-2.5 border-l border-[var(--line)] group"
    >
      <ChevronRight size={12} className="text-[var(--n-300)] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--ink)]">{cat.nombre}</span>
        <span className="ml-2 text-[10px] text-[var(--ink-soft)] font-mono">{cat.slug}</span>
      </div>
      {/* Antes solo visibles con hover (opacity-0 group-hover:opacity-100) —
          en tablet/touch no hay hover real, así que las acciones quedaban
          sin forma de descubrirlas. Ahora siempre visibles, igual que en
          la fila de categoría padre (CategoriaRow, arriba). */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(cat)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--n-100)] transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(cat)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:text-red-500 hover:bg-red-50 transition-colors">
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
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-card)] overflow-hidden">
      {/* Header categoría padre */}
      <div className="flex items-center gap-3 px-4 py-3 group">
        <button onClick={() => setAbierta(a => !a)}
          className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex-shrink-0">
          {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {abierta ? <FolderOpen size={16} className="text-[var(--ink-soft)] flex-shrink-0" /> : <Folder size={16} className="text-[var(--ink-soft)] flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[var(--ink)]">{cat.nombre}</span>
          <span className="ml-2 text-[10px] text-[var(--ink-soft)] font-mono">{cat.slug}</span>
          {hijos.length > 0 && (
            <span className="ml-2 text-[10px] text-[var(--ink-soft)]">{hijos.length} subcategoría{hijos.length > 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onAgregarHijo(cat)}
            className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--n-100)] transition-colors">
            <Plus size={11} /> Sub
          </button>
          <button onClick={() => onEdit(cat)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--n-100)] transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(cat)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:text-red-500 hover:bg-red-50 transition-colors">
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
            className="overflow-hidden border-t border-[var(--line)] pb-1"
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

// ── Panel principal (embebido en el tab "Categorías" de Productos) ────────────
export default function CategoriasPanel() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);

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

  const handleEditar = (cat: Categoria) => { setEditando(cat); setModalAbierto(true); };
  const handleNueva = () => { setEditando(null); setModalAbierto(true); };
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
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Categorías</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Organizá tus productos en categorías y subcategorías</p>
        </div>
        <AdminButton variant="primary" icon={<Plus size={15} />} onClick={handleNueva}>
          Nueva categoría
        </AdminButton>
      </div>

      {/* Árbol de categorías */}
      {isLoading ? (
        <div className="text-sm text-[var(--ink-soft)] py-10 text-center">Cargando...</div>
      ) : padres.length === 0 ? (
        <div className="bg-[var(--panel)] border border-dashed border-[var(--line)] rounded-[var(--radius-card)] py-14 text-center">
          <p className="text-sm text-[var(--ink-soft)] mb-3">No hay categorías todavía</p>
          <button onClick={handleNueva}
            className="text-sm font-medium text-[var(--ink)] underline underline-offset-2">
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
      <div className="bg-[var(--n-50)] border border-[var(--line)] rounded-xl p-4 text-xs text-[var(--ink-soft)] leading-relaxed">
        <strong className="text-[var(--ink)]">Jerarquía:</strong> Las categorías raíz (sin padre) aparecen como secciones principales.
        Usá <strong className="text-[var(--ink)]">+ Sub</strong> para agregar subcategorías dentro de una categoría padre.
        Ejemplo: <span className="font-mono bg-[var(--n-100)] px-1 rounded">Mate</span> → <span className="font-mono bg-[var(--n-100)] px-1 rounded">Calabaza</span>, <span className="font-mono bg-[var(--n-100)] px-1 rounded">Algarrobo</span>
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

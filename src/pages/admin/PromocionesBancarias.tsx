import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminLabel } from '../../components/admin/ui/AdminInput';

interface Categoria {
  id: number;
  nombre: string;
}

interface Producto {
  id: string;
  nombre: string;
}

interface PromocionBancaria {
  id: number;
  banco: string;
  tarjetas: string[];
  cuotas: number;
  descripcion: string;
  fecha_desde: string;
  fecha_hasta: string;
  activo: boolean;
  aplica_a_todos: boolean;
  categorias: { categoria_id: number }[];
  productos: { producto_id: string }[];
}

const FORM_VACIO = {
  banco: '',
  tarjetas: '',
  cuotas: '',
  descripcion: '',
  fecha_desde: '',
  fecha_hasta: '',
  activo: true,
  aplica_a_todos: false,
  categoria_ids: [] as number[],
  producto_ids: [] as string[],
};

// Formatea el ISO/fecha del backend al formato que espera <input type="date">.
function isoAFecha(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function SelectorMultiple({
  items,
  seleccionados,
  onToggle,
  placeholder,
}: {
  items: { id: string | number; label: string }[];
  seleccionados: (string | number)[];
  onToggle: (id: string | number) => void;
  placeholder: string;
}) {
  const [filtro, setFiltro] = useState('');
  const filtrados = useMemo(
    () => items.filter(i => i.label.toLowerCase().includes(filtro.toLowerCase())),
    [items, filtro],
  );

  return (
    <div className="border border-[var(--line)] rounded-[var(--radius-el)]">
      <input
        className="w-full px-3 py-2 text-sm border-b border-[var(--line)] focus:outline-none rounded-t-[var(--radius-el)] bg-[var(--panel)] text-[var(--ink)] placeholder:text-[var(--ink-soft)]"
        placeholder={placeholder}
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto flex flex-col">
        {filtrados.map(item => (
          <label key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--n-50)] cursor-pointer">
            <input
              type="checkbox"
              checked={seleccionados.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="accent-[var(--accent)]"
            />
            {item.label}
          </label>
        ))}
        {filtrados.length === 0 && (
          <div className="px-3 py-2 text-xs text-[var(--ink-soft)]">Sin resultados</div>
        )}
      </div>
    </div>
  );
}

export default function AdminPromocionesBancarias() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [promoEditando, setPromoEditando] = useState<PromocionBancaria | null>(null);
  const [form, setForm] = useState(FORM_VACIO);

  const { data: promos, isLoading, isError } = useQuery<PromocionBancaria[]>({
    queryKey: ['admin-promociones-bancarias'],
    queryFn: () => api.get('/promociones-bancarias').then(r => r.data),
  });

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['productos-admin-todos'],
    queryFn: () => api.get('/productos/admin/todos?limit=100').then(r => r.data.data),
  });

  const crearMutation = useMutation({
    mutationFn: (data: any) => api.post('/promociones-bancarias', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promociones-bancarias'] });
      cerrarModal();
    },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/promociones-bancarias/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promociones-bancarias'] });
      cerrarModal();
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/promociones-bancarias/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promociones-bancarias'] }),
  });

  const abrirModal = (promo?: PromocionBancaria) => {
    if (promo) {
      setPromoEditando(promo);
      setForm({
        banco: promo.banco,
        tarjetas: promo.tarjetas.join(', '),
        cuotas: String(promo.cuotas),
        descripcion: promo.descripcion,
        fecha_desde: isoAFecha(promo.fecha_desde),
        fecha_hasta: isoAFecha(promo.fecha_hasta),
        activo: promo.activo,
        aplica_a_todos: promo.aplica_a_todos,
        categoria_ids: promo.categorias.map(c => c.categoria_id),
        producto_ids: promo.productos.map(p => p.producto_id),
      });
    } else {
      setPromoEditando(null);
      setForm(FORM_VACIO);
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setPromoEditando(null);
    setForm(FORM_VACIO);
  };

  const handleSubmit = () => {
    const data = {
      banco: form.banco,
      tarjetas: form.tarjetas.split(',').map(t => t.trim()).filter(Boolean),
      cuotas: parseInt(form.cuotas, 10),
      descripcion: form.descripcion,
      fecha_desde: form.fecha_desde,
      fecha_hasta: form.fecha_hasta,
      activo: form.activo,
      aplica_a_todos: form.aplica_a_todos,
      categoria_ids: form.aplica_a_todos ? [] : form.categoria_ids,
      producto_ids: form.aplica_a_todos ? [] : form.producto_ids,
    };
    if (promoEditando) {
      editarMutation.mutate({ id: promoEditando.id, data });
    } else {
      crearMutation.mutate(data);
    }
  };

  const guardando = crearMutation.isPending || editarMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Promociones bancarias</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{promos?.length || 0} promociones</p>
        </div>
        <AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => abrirModal()}>
          Nueva promoción
        </AdminButton>
      </div>

      <AdminCard padded={false}>
        <AdminTable
          columns={['Banco', 'Tarjetas', 'Cuotas', 'Vigencia', 'Alcance', 'Estado', 'Acciones']}
          isLoading={isLoading}
          isError={isError}
          isEmpty={!promos || promos.length === 0}
          emptyMessage="No hay promociones bancarias todavía"
        >
          {promos?.map(p => (
            <tr key={p.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
              <td className="px-5 py-3 text-sm font-medium text-[var(--ink)]">{p.banco}</td>
              <td className="px-5 py-3 text-sm text-[var(--ink-soft)]">{p.tarjetas.join(', ') || '—'}</td>
              <td className="px-5 py-3 text-sm text-[var(--ink)]">{p.cuotas} cuotas</td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                {new Date(p.fecha_desde).toLocaleDateString('es-AR')} – {new Date(p.fecha_hasta).toLocaleDateString('es-AR')}
              </td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                {p.aplica_a_todos
                  ? 'Todos los productos'
                  : `${p.categorias.length} categoría(s), ${p.productos.length} producto(s)`}
              </td>
              <td className="px-5 py-3">
                <ActivoBadge activo={p.activo} />
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1">
                  <AdminButton variant="ghost" size="sm" onClick={() => abrirModal(p)} aria-label="Editar">
                    <Pencil size={13} />
                  </AdminButton>
                  <AdminButton
                    variant="danger" size="sm"
                    disabled={eliminarMutation.isPending && eliminarMutation.variables === p.id}
                    onClick={() => {
                      if (confirm(`¿Eliminar la promoción de "${p.banco}"? Esta acción no se puede deshacer.`)) eliminarMutation.mutate(p.id);
                    }}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={13} />
                  </AdminButton>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>

      <AdminModal
        open={modalAbierto}
        onClose={cerrarModal}
        title={promoEditando ? 'Editar promoción' : 'Nueva promoción'}
        maxWidth="lg"
        footer={<>
          <AdminButton variant="secondary" onClick={cerrarModal}>Cancelar</AdminButton>
          <AdminButton variant="primary" disabled={guardando} onClick={handleSubmit}>
            {guardando ? 'Guardando...' : promoEditando ? 'Guardar cambios' : 'Crear promoción'}
          </AdminButton>
        </>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <AdminLabel>Banco *</AdminLabel>
              <AdminInput value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Galicia" />
            </div>
            <div>
              <AdminLabel>Cuotas *</AdminLabel>
              <AdminInput type="number" min={1} value={form.cuotas} onChange={e => setForm(f => ({ ...f, cuotas: e.target.value }))} placeholder="6" />
            </div>
          </div>
          <div>
            <AdminLabel>Tarjetas (separadas por coma)</AdminLabel>
            <AdminInput value={form.tarjetas} onChange={e => setForm(f => ({ ...f, tarjetas: e.target.value }))} placeholder="visa, mastercard" />
          </div>
          <div>
            <AdminLabel>Descripción *</AdminLabel>
            <AdminInput value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="6 cuotas sin interés" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <AdminLabel>Vigente desde *</AdminLabel>
              <AdminInput type="date" value={form.fecha_desde} onChange={e => setForm(f => ({ ...f, fecha_desde: e.target.value }))} />
            </div>
            <div>
              <AdminLabel>Vigente hasta *</AdminLabel>
              <AdminInput type="date" value={form.fecha_hasta} onChange={e => setForm(f => ({ ...f, fecha_hasta: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-[var(--n-50)] rounded-[var(--radius-el)] px-4 py-3 border border-[var(--line)]">
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">Aplica a todos los productos</div>
              <div className="text-xs text-[var(--ink-soft)]">Si está activo, ignora la selección de categorías/productos</div>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, aplica_a_todos: !f.aplica_a_todos }))}
              className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.aplica_a_todos ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.aplica_a_todos ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>

          {!form.aplica_a_todos && (
            <>
              <div>
                <AdminLabel>Categorías</AdminLabel>
                <SelectorMultiple
                  items={(categorias ?? []).map(c => ({ id: c.id, label: c.nombre }))}
                  seleccionados={form.categoria_ids}
                  placeholder="Buscar categoría..."
                  onToggle={id => setForm(f => ({
                    ...f,
                    categoria_ids: f.categoria_ids.includes(id as number)
                      ? f.categoria_ids.filter(c => c !== id)
                      : [...f.categoria_ids, id as number],
                  }))}
                />
              </div>
              <div>
                <AdminLabel>Productos</AdminLabel>
                <SelectorMultiple
                  items={(productos ?? []).map(p => ({ id: p.id, label: p.nombre }))}
                  seleccionados={form.producto_ids}
                  placeholder="Buscar producto..."
                  onToggle={id => setForm(f => ({
                    ...f,
                    producto_ids: f.producto_ids.includes(id as string)
                      ? f.producto_ids.filter(p => p !== id)
                      : [...f.producto_ids, id as string],
                  }))}
                />
              </div>
            </>
          )}

          {promoEditando && (
            <div className="flex items-center justify-between bg-[var(--n-50)] rounded-[var(--radius-el)] px-4 py-3 border border-[var(--line)]">
              <div>
                <div className="text-sm font-medium text-[var(--ink)]">Promoción activa</div>
                <div className="text-xs text-[var(--ink-soft)]">Una promoción inactiva no se muestra en el cartel del producto</div>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.activo ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.activo ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}

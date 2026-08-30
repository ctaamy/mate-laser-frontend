import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminSelect, AdminLabel } from '../../components/admin/ui/AdminInput';

interface Categoria {
  id: number;
  nombre: string;
}

interface Producto {
  id: string;
  nombre: string;
}

const FORM_VACIO = {
  codigo: '', tipo: 'porcentaje', valor: '',
  monto_minimo: '', max_usos: '', limite_por_usuario: '', vence_en: '', activo: true,
  aplica_a_todo: true,
  categoria_ids: [] as number[],
  producto_ids: [] as string[],
};

// Formatea el ISO del backend al formato que espera <input type="datetime-local">.
function isoADatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

// Mismo componente que usa PromocionesBancarias.tsx — input de búsqueda +
// lista de checkboxes con scroll. Copiado a propósito para no acoplar los dos
// módulos por un cambio en uno solo.
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

function textoAlcance(c: { aplica_a_todo?: boolean; cupones_productos?: unknown[]; cupones_categorias?: unknown[] }): string {
  if (c.aplica_a_todo) return 'Todo el catálogo';
  const nP = c.cupones_productos?.length ?? 0;
  const nC = c.cupones_categorias?.length ?? 0;
  return [
    nP ? `${nP} producto${nP === 1 ? '' : 's'}` : null,
    nC ? `${nC} categoría${nC === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ') || 'Sin selección';
}

export default function AdminCupones() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuponEditando, setCuponEditando] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');

  const { data: cupones, isLoading, isError } = useQuery({
    queryKey: ['admin-cupones'],
    queryFn: () => api.get('/cupones').then(r => r.data),
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
    mutationFn: (data: any) => api.post('/cupones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupones'] });
      cerrarModal();
    },
    onError: (err: any) => setErrorForm(err.response?.data?.message || 'No se pudo guardar el cupón'),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/cupones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupones'] });
      cerrarModal();
    },
    onError: (err: any) => setErrorForm(err.response?.data?.message || 'No se pudo guardar el cupón'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cupones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cupones'] }),
  });

  const abrirModal = (cupon?: any) => {
    setErrorForm('');
    if (cupon) {
      setCuponEditando(cupon);
      setForm({
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: String(cupon.valor),
        monto_minimo: cupon.monto_minimo != null ? String(cupon.monto_minimo) : '',
        max_usos: cupon.max_usos != null ? String(cupon.max_usos) : '',
        limite_por_usuario: cupon.limite_por_usuario != null ? String(cupon.limite_por_usuario) : '',
        vence_en: isoADatetimeLocal(cupon.vence_en),
        activo: cupon.activo,
        aplica_a_todo: cupon.aplica_a_todo ?? true,
        categoria_ids: (cupon.cupones_categorias ?? []).map((c: { categoria_id: number }) => c.categoria_id),
        producto_ids: (cupon.cupones_productos ?? []).map((p: { producto_id: string }) => p.producto_id),
      });
    } else {
      setCuponEditando(null);
      setForm(FORM_VACIO);
    }
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setCuponEditando(null);
    setForm(FORM_VACIO);
    setErrorForm('');
  };

  const sinSeleccion = !form.aplica_a_todo && form.categoria_ids.length === 0 && form.producto_ids.length === 0;

  const handleSubmit = () => {
    setErrorForm('');
    if (sinSeleccion) {
      setErrorForm('Elegí al menos un producto o categoría, o cambiá el cupón a "todo el catálogo".');
      return;
    }
    const data = {
      codigo: form.codigo,
      tipo: form.tipo,
      valor: parseFloat(form.valor),
      monto_minimo: form.monto_minimo ? parseFloat(form.monto_minimo) : undefined,
      max_usos: form.max_usos ? parseInt(form.max_usos) : undefined,
      limite_por_usuario: form.limite_por_usuario ? parseInt(form.limite_por_usuario) : undefined,
      vence_en: form.vence_en || undefined,
      activo: form.activo,
      aplica_a_todo: form.aplica_a_todo,
      categoria_ids: form.aplica_a_todo ? [] : form.categoria_ids,
      producto_ids: form.aplica_a_todo ? [] : form.producto_ids,
    };
    if (cuponEditando) {
      editarMutation.mutate({ id: cuponEditando.id, data });
    } else {
      crearMutation.mutate(data);
    }
  };

  const guardando = crearMutation.isPending || editarMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Cupones</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{cupones?.length || 0} cupones</p>
        </div>
        <AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => abrirModal()}>
          Nuevo cupón
        </AdminButton>
      </div>

      <AdminCard padded={false}>
        <AdminTable
          columns={['Código', 'Tipo', 'Valor', 'Alcance', 'Usos', 'Vence', 'Estado', 'Acciones']}
          isLoading={isLoading}
          isError={isError}
          isEmpty={!cupones || cupones.length === 0}
          emptyMessage="No hay cupones todavía"
        >
          {cupones?.map((c: any) => (
            <tr key={c.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
              <td className="px-5 py-3 font-mono text-sm font-medium text-[var(--ink)]">{c.codigo}</td>
              <td className="px-5 py-3 text-sm text-[var(--ink)] capitalize">{c.tipo}</td>
              <td className="px-5 py-3 text-sm text-[var(--ink)]">
                {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${Number(c.valor).toLocaleString('es-AR')}`}
              </td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">{textoAlcance(c)}</td>
              <td className="px-5 py-3 text-sm text-[var(--ink-soft)]">
                {c.usos_realizados}{c.max_usos ? `/${c.max_usos}` : ''}
                {c.limite_por_usuario != null && (
                  <div className="text-xs text-[var(--ink-soft)]">máx {c.limite_por_usuario}/cliente</div>
                )}
              </td>
              <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                {c.vence_en ? new Date(c.vence_en).toLocaleDateString('es-AR') : 'Sin vencimiento'}
              </td>
              <td className="px-5 py-3">
                <ActivoBadge activo={c.activo} />
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1">
                  <AdminButton variant="ghost" size="sm" onClick={() => abrirModal(c)} aria-label="Editar">
                    <Pencil size={13} />
                  </AdminButton>
                  <AdminButton
                    variant="danger" size="sm"
                    disabled={eliminarMutation.isPending && eliminarMutation.variables === c.id}
                    onClick={() => {
                      if (confirm(`¿Eliminar el cupón "${c.codigo}"? Esta acción no se puede deshacer.`)) eliminarMutation.mutate(c.id);
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
        title={cuponEditando ? 'Editar cupón' : 'Nuevo cupón'}
        maxWidth="lg"
        footer={<>
          <AdminButton variant="secondary" onClick={cerrarModal}>Cancelar</AdminButton>
          <AdminButton variant="primary" disabled={guardando} onClick={handleSubmit}>
            {guardando ? 'Guardando...' : cuponEditando ? 'Guardar cambios' : 'Crear cupón'}
          </AdminButton>
        </>}
      >
        <div className="flex flex-col gap-4">
          <div>
            <AdminLabel>Código *</AdminLabel>
            <AdminInput value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="MATE10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <AdminLabel>Tipo *</AdminLabel>
              <AdminSelect value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="fijo">Monto fijo ($)</option>
              </AdminSelect>
            </div>
            <div>
              <AdminLabel>Valor *</AdminLabel>
              <AdminInput type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder={form.tipo === 'porcentaje' ? '10' : '500'} />
            </div>
            <div>
              <AdminLabel>Monto mínimo</AdminLabel>
              <AdminInput type="number" value={form.monto_minimo} onChange={e => setForm(f => ({ ...f, monto_minimo: e.target.value }))} placeholder="5000" />
            </div>
            <div>
              <AdminLabel>Usos totales</AdminLabel>
              <AdminInput type="number" value={form.max_usos} onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} placeholder="Sin límite" />
              <div className="text-xs text-[var(--ink-soft)] mt-1">En todo el sitio, sumando todos los clientes.</div>
            </div>
            <div>
              <AdminLabel>Usos por cliente</AdminLabel>
              <AdminInput type="number" value={form.limite_por_usuario} onChange={e => setForm(f => ({ ...f, limite_por_usuario: e.target.value }))} placeholder="Sin límite" />
              <div className="text-xs text-[var(--ink-soft)] mt-1">Cuántas veces puede usarlo la misma persona. Exige que el cliente inicie sesión.</div>
            </div>
          </div>
          <div>
            <AdminLabel>Fecha de vencimiento</AdminLabel>
            <AdminInput type="datetime-local" value={form.vence_en} onChange={e => setForm(f => ({ ...f, vence_en: e.target.value }))} />
          </div>

          {/* ALCANCE */}
          <div className="flex items-center justify-between bg-[var(--n-50)] rounded-[var(--radius-el)] px-4 py-3 border border-[var(--line)]">
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">Aplica a todo el carrito</div>
              <div className="text-xs text-[var(--ink-soft)]">
                {form.aplica_a_todo
                  ? 'El descuento vale para cualquier producto.'
                  : 'El descuento vale solo para los productos/categorías elegidos abajo.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, aplica_a_todo: !f.aplica_a_todo }))}
              className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.aplica_a_todo ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.aplica_a_todo ? 'left-4' : 'left-0.5'}`} />
            </button>
          </div>

          {!form.aplica_a_todo && (
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
              <div className="text-xs text-[var(--ink-soft)]">
                {form.producto_ids.length + form.categoria_ids.length > 0
                  ? `Este cupón va a descontar sobre ${form.producto_ids.length} producto(s) y ${form.categoria_ids.length} categoría(s).`
                  : 'Todavía no elegiste ningún producto ni categoría.'}
              </div>
            </>
          )}

          {cuponEditando && (
            <div className="flex items-center justify-between bg-[var(--n-50)] rounded-[var(--radius-el)] px-4 py-3 border border-[var(--line)]">
              <div>
                <div className="text-sm font-medium text-[var(--ink)]">Cupón activo</div>
                <div className="text-xs text-[var(--ink-soft)]">Un cupón inactivo no se puede aplicar en el checkout</div>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.activo ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.activo ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          )}

          {errorForm && <div className="text-xs text-red-500">{errorForm}</div>}
        </div>
      </AdminModal>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard, { AdminCardHeader } from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminSelect, AdminLabel } from '../../components/admin/ui/AdminInput';

const FORM_VACIO = {
  codigo: '', tipo: 'porcentaje', valor: '',
  monto_minimo: '', max_usos: '', vence_en: '', activo: true,
};

// Formatea el ISO del backend al formato que espera <input type="datetime-local">.
function isoADatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

export default function AdminCupones() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuponEditando, setCuponEditando] = useState<any | null>(null);
  const [form, setForm] = useState(FORM_VACIO);

  const { data: cupones, isLoading, isError } = useQuery({
    queryKey: ['admin-cupones'],
    queryFn: () => api.get('/cupones').then(r => r.data),
  });

  const crearMutation = useMutation({
    mutationFn: (data: any) => api.post('/cupones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupones'] });
      cerrarModal();
    },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/cupones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cupones'] });
      cerrarModal();
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cupones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cupones'] }),
  });

  const abrirModal = (cupon?: any) => {
    if (cupon) {
      setCuponEditando(cupon);
      setForm({
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: String(cupon.valor),
        monto_minimo: cupon.monto_minimo != null ? String(cupon.monto_minimo) : '',
        max_usos: cupon.max_usos != null ? String(cupon.max_usos) : '',
        vence_en: isoADatetimeLocal(cupon.vence_en),
        activo: cupon.activo,
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
  };

  const handleSubmit = () => {
    const data = {
      ...form,
      valor: parseFloat(form.valor),
      monto_minimo: form.monto_minimo ? parseFloat(form.monto_minimo) : undefined,
      max_usos: form.max_usos ? parseInt(form.max_usos) : undefined,
      vence_en: form.vence_en || undefined,
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
          columns={['Código', 'Tipo', 'Valor', 'Usos', 'Vence', 'Estado', 'Acciones']}
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
              <td className="px-5 py-3 text-sm text-[var(--ink-soft)]">
                {c.usos_realizados}{c.max_usos ? `/${c.max_usos}` : ''}
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
              <AdminLabel>Máximo de usos</AdminLabel>
              <AdminInput type="number" value={form.max_usos} onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} placeholder="Sin límite" />
            </div>
          </div>
          <div>
            <AdminLabel>Fecha de vencimiento</AdminLabel>
            <AdminInput type="datetime-local" value={form.vence_en} onChange={e => setForm(f => ({ ...f, vence_en: e.target.value }))} />
          </div>
          {cuponEditando && (
            <div className="flex items-center justify-between bg-[var(--n-50)] rounded-[var(--radius-el)] px-4 py-3 border border-[var(--line)]">
              <div>
                <div className="text-sm font-medium text-[var(--ink)]">Cupón activo</div>
                <div className="text-xs text-[var(--ink-soft)]">Un cupón inactivo no se puede aplicar en el checkout</div>
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

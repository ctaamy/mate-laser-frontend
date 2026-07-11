import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import BotonEliminar from '../../components/ui/BotonEliminar';
import BotonNuevo from '../../components/ui/BotonNuevo';

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

  const { data: cupones } = useQuery({
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

  const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-full';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Cupones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{cupones?.length || 0} cupones</p>
        </div>
        <BotonNuevo label="Nuevo cupón" onClick={() => abrirModal()} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
              <th className="text-left px-5 py-3">Código</th>
              <th className="text-left px-5 py-3">Tipo</th>
              <th className="text-left px-5 py-3">Valor</th>
              <th className="text-left px-5 py-3">Usos</th>
              <th className="text-left px-5 py-3">Vence</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cupones?.map((c: any) => (
              <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{c.codigo}</td>
                <td className="px-5 py-3 text-sm text-gray-900 capitalize">{c.tipo}</td>
                <td className="px-5 py-3 text-sm text-gray-900">
                  {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${Number(c.valor).toLocaleString('es-AR')}`}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {c.usos_realizados}{c.max_usos ? `/${c.max_usos}` : ''}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {c.vence_en ? new Date(c.vence_en).toLocaleDateString('es-AR') : 'Sin vencimiento'}
                </td>
                <td className="px-5 py-3">
                  <ActivoBadge activo={c.activo} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirModal(c)}
                      className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <BotonEliminar
                      disabled={eliminarMutation.isPending && eliminarMutation.variables === c.id}
                      onClick={() => {
                        if (confirm(`¿Eliminar el cupón "${c.codigo}"? Esta acción no se puede deshacer.`)) eliminarMutation.mutate(c.id);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!cupones || cupones.length === 0) && (
          <div className="text-center py-16 text-sm text-gray-400">No hay cupones todavía</div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-medium text-gray-900">{cuponEditando ? 'Editar cupón' : 'Nuevo cupón'}</h2>
              <button onClick={cerrarModal} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Código *</label>
                <input className={inputClass} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="MATE10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tipo *</label>
                  <select className={inputClass} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="fijo">Monto fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Valor *</label>
                  <input className={inputClass} type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder={form.tipo === 'porcentaje' ? '10' : '500'} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Monto mínimo</label>
                  <input className={inputClass} type="number" value={form.monto_minimo} onChange={e => setForm(f => ({ ...f, monto_minimo: e.target.value }))} placeholder="5000" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Máximo de usos</label>
                  <input className={inputClass} type="number" value={form.max_usos} onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} placeholder="Sin límite" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fecha de vencimiento</label>
                <input className={inputClass} type="datetime-local" value={form.vence_en} onChange={e => setForm(f => ({ ...f, vence_en: e.target.value }))} />
              </div>
              {cuponEditando && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Cupón activo</div>
                    <div className="text-xs text-gray-400">Un cupón inactivo no se puede aplicar en el checkout</div>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.activo ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.activo ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={cerrarModal} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={guardando}
                className="bg-[#1D9E75] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : cuponEditando ? 'Guardar cambios' : 'Crear cupón'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
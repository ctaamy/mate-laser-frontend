import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import BotonEliminar from '../../components/ui/BotonEliminar';
import BotonNuevo from '../../components/ui/BotonNuevo';

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
    <div className="border border-gray-200 rounded-lg">
      <input
        className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none rounded-t-lg"
        placeholder={placeholder}
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto flex flex-col">
        {filtrados.map(item => (
          <label key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={seleccionados.includes(item.id)}
              onChange={() => onToggle(item.id)}
            />
            {item.label}
          </label>
        ))}
        {filtrados.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
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

  const { data: promos } = useQuery<PromocionBancaria[]>({
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
  const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-full';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Promociones bancarias</h1>
          <p className="text-sm text-gray-400 mt-0.5">{promos?.length || 0} promociones</p>
        </div>
        <BotonNuevo label="Nueva promoción" onClick={() => abrirModal()} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
              <th className="text-left px-5 py-3">Banco</th>
              <th className="text-left px-5 py-3">Tarjetas</th>
              <th className="text-left px-5 py-3">Cuotas</th>
              <th className="text-left px-5 py-3">Vigencia</th>
              <th className="text-left px-5 py-3">Alcance</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {promos?.map(p => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.banco}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{p.tarjetas.join(', ') || '—'}</td>
                <td className="px-5 py-3 text-sm text-gray-900">{p.cuotas} cuotas</td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {new Date(p.fecha_desde).toLocaleDateString('es-AR')} – {new Date(p.fecha_hasta).toLocaleDateString('es-AR')}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {p.aplica_a_todos
                    ? 'Todos los productos'
                    : `${p.categorias.length} categoría(s), ${p.productos.length} producto(s)`}
                </td>
                <td className="px-5 py-3">
                  <ActivoBadge activo={p.activo} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirModal(p)}
                      className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <BotonEliminar
                      disabled={eliminarMutation.isPending && eliminarMutation.variables === p.id}
                      onClick={() => {
                        if (confirm(`¿Eliminar la promoción de "${p.banco}"? Esta acción no se puede deshacer.`)) eliminarMutation.mutate(p.id);
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!promos || promos.length === 0) && (
          <div className="text-center py-16 text-sm text-gray-400">No hay promociones bancarias todavía</div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-base font-medium text-gray-900">{promoEditando ? 'Editar promoción' : 'Nueva promoción'}</h2>
              <button onClick={cerrarModal} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Banco *</label>
                  <input className={inputClass} value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Galicia" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cuotas *</label>
                  <input className={inputClass} type="number" min={1} value={form.cuotas} onChange={e => setForm(f => ({ ...f, cuotas: e.target.value }))} placeholder="6" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tarjetas (separadas por coma)</label>
                <input className={inputClass} value={form.tarjetas} onChange={e => setForm(f => ({ ...f, tarjetas: e.target.value }))} placeholder="visa, mastercard" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Descripción *</label>
                <input className={inputClass} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="6 cuotas sin interés" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Vigente desde *</label>
                  <input className={inputClass} type="date" value={form.fecha_desde} onChange={e => setForm(f => ({ ...f, fecha_desde: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Vigente hasta *</label>
                  <input className={inputClass} type="date" value={form.fecha_hasta} onChange={e => setForm(f => ({ ...f, fecha_hasta: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                <div>
                  <div className="text-sm font-medium text-gray-900">Aplica a todos los productos</div>
                  <div className="text-xs text-gray-400">Si está activo, ignora la selección de categorías/productos</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, aplica_a_todos: !f.aplica_a_todos }))}
                  className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.aplica_a_todos ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.aplica_a_todos ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>

              {!form.aplica_a_todos && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Categorías</label>
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
                    <label className="text-xs text-gray-500 mb-1 block">Productos</label>
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
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Promoción activa</div>
                    <div className="text-xs text-gray-400">Una promoción inactiva no se muestra en el cartel del producto</div>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.activo ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.activo ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={cerrarModal} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={guardando}
                className="bg-[#1D9E75] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : promoEditando ? 'Guardar cambios' : 'Crear promoción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

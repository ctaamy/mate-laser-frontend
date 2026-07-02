import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Copy, Check, Image } from 'lucide-react';
import api from '../../lib/api';
import type { Producto, Categoria, ImagenProducto } from '../../types';
import ImageUploader from '../../components/ui/ImageUploader';
import ActivoBadge from '../../components/ui/ActivoBadge';
import BotonEliminar from '../../components/ui/BotonEliminar';
import BotonNuevo from '../../components/ui/BotonNuevo';

interface SeccionHP { id: string; tipo: string; activo: boolean; orden: number; datos: Record<string, any>; }

export default function AdminProductos() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tabModal, setTabModal] = useState<'datos' | 'imagenes'>('datos');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<string[]>([]);
  const [form, setForm] = useState({
    nombre: '', slug: '', descripcion: '', categoria_id: '',
    precio_base: '', precio_tachado: '', stock: '0', stock_alerta: '5',
    sku: '', material: '', dimensiones: '', peso_kg: '',
    apto_grabado: false, costo_grabado: '0', colores_disponibles: '',
    personalizado_habilitado: false, personalizado_max_chars: '30',
    personalizado_placeholder: '', activo: true, destacado: false,
  });

  const { data: productos } = useQuery<Producto[]>({
    queryKey: ['admin-productos-lista'],
    queryFn: () => api.get('/productos/admin/todos?limit=100').then(r => r.data.data),
  });

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  // getHomepage devuelve el array directamente, no { secciones: [...] }
  const { data: todasSecciones = [] } = useQuery<SeccionHP[]>({
    queryKey: ['homepage'],
    queryFn: () => api.get('/configuracion/homepage').then(r => r.data),
  });

  const { data: imagenesProducto, refetch: refetchImagenes } = useQuery<ImagenProducto[]>({
    queryKey: ['imagenes-producto', productoEditando?.id],
    queryFn: () => api.get(`/imagenes/producto/${productoEditando!.id}`).then(r => r.data),
    enabled: !!productoEditando?.id,
  });

  // Solo secciones activas de tipo productos_destacados
  const seccionesProductos = todasSecciones.filter(
    s => s.tipo === 'productos_destacados' && s.activo !== false
  );

  const crearMutation = useMutation({
    mutationFn: (data: any) => api.post('/productos', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] }); cerrarModal(); },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/productos/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] }); cerrarModal(); },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/productos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] }),
  });

  const abrirModal = (producto?: Producto) => {
    if (producto) {
      setProductoEditando(producto);
      const enSecciones = seccionesProductos
        .filter(s => (s.datos.productos_ids ?? []).includes(producto.id))
        .map(s => s.id);
      setSeccionesSeleccionadas(enSecciones);
      setForm({
        nombre: producto.nombre,
        slug: producto.slug,
        descripcion: producto.descripcion || '',
        categoria_id: producto.categoria_id?.toString() || '',
        precio_base: producto.precio_base.toString(),
        precio_tachado: producto.precio_tachado?.toString() || '',
        stock: producto.stock.toString(),
        stock_alerta: producto.stock_alerta.toString(),
        sku: producto.sku || '',
        material: producto.material || '',
        dimensiones: producto.dimensiones || '',
        peso_kg: producto.peso_kg?.toString() || '',
        apto_grabado: producto.apto_grabado,
        costo_grabado: (producto as any).costo_grabado?.toString() || '0',
        colores_disponibles: Array.isArray(producto.colores_disponibles)
          ? producto.colores_disponibles.join(', ')
          : '',
        personalizado_habilitado: producto.personalizado_habilitado,
        personalizado_max_chars: producto.personalizado_max_chars.toString(),
        personalizado_placeholder: producto.personalizado_placeholder || '',
        activo: producto.activo,
        destacado: producto.destacado,
      });
    } else {
      setProductoEditando(null);
      setSeccionesSeleccionadas([]);
      setForm({
        nombre: '', slug: '', descripcion: '', categoria_id: '',
        precio_base: '', precio_tachado: '', stock: '0', stock_alerta: '5',
        sku: '', material: '', dimensiones: '', peso_kg: '',
        apto_grabado: false, costo_grabado: '0', colores_disponibles: '',
        personalizado_habilitado: false, personalizado_max_chars: '30',
        personalizado_placeholder: '', activo: true, destacado: false,
      });
    }
    setTabModal('datos');
    setModalAbierto(true);
  };

  const cerrarModal = () => { setModalAbierto(false); setProductoEditando(null); };

  const guardarSecciones = async (productoId: string) => {
    // Siempre fetch fresh para no sobreescribir cambios recientes con datos cacheados
    const { data: frescas } = await api.get<SeccionHP[]>('/configuracion/homepage');
    if (!frescas?.length) return;
    const actualizadas = frescas.map(s => {
      if (s.tipo !== 'productos_destacados') return s;
      const ids: string[] = s.datos.productos_ids ?? [];
      const estaSeleccionada = seccionesSeleccionadas.includes(s.id);
      const yaEstaba = ids.includes(productoId);
      if (estaSeleccionada && !yaEstaba) return { ...s, datos: { ...s.datos, productos_ids: [...ids, productoId] } };
      if (!estaSeleccionada && yaEstaba) return { ...s, datos: { ...s.datos, productos_ids: ids.filter(id => id !== productoId) } };
      return s;
    });
    await api.put('/configuracion/homepage', { secciones: actualizadas });
    queryClient.invalidateQueries({ queryKey: ['homepage'] });
  };

  const handleSubmit = async () => {
    const data = {
      ...form,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : undefined,
      precio_base: parseFloat(form.precio_base),
      precio_tachado: form.precio_tachado ? parseFloat(form.precio_tachado) : undefined,
      stock: parseInt(form.stock),
      stock_alerta: parseInt(form.stock_alerta),
      sku: form.sku.trim() || undefined,
      peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : undefined,
      costo_grabado: form.apto_grabado ? parseFloat(form.costo_grabado || '0') : 0,
      personalizado_max_chars: parseInt(form.personalizado_max_chars),
      colores_disponibles: form.colores_disponibles
        ? form.colores_disponibles.split(',').map(c => c.trim()).filter(Boolean)
        : [],
    };
    if (productoEditando) {
      await api.put(`/productos/${productoEditando.id}`, data);
      await guardarSecciones(productoEditando.id);
      queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] });
      cerrarModal();
    } else {
      const res = await api.post('/productos', data);
      await guardarSecciones(res.data.id);
      queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] });
      cerrarModal();
    }
  };

  const generarSlug = (nombre: string) =>
    nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-full';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium">Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{productos?.length || 0} productos en total</p>
        </div>
        <BotonNuevo label="Nuevo producto" onClick={() => abrirModal()} />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 font-medium">
              <th className="text-left px-5 py-3">Producto</th>
              <th className="text-left px-5 py-3">Categoría</th>
              <th className="text-left px-5 py-3">Precio</th>
              <th className="text-left px-5 py-3">Stock</th>
              <th className="text-left px-5 py-3">Láser</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos?.map((p) => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="text-sm font-medium">{p.nombre}</div>
                  <div className="text-xs text-gray-400">{p.sku || p.slug}</div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{(p as any).categorias?.nombre || '—'}</td>
                <td className="px-5 py-3">
                  <div className="text-sm font-medium">${Number(p.precio_base).toLocaleString('es-AR')}</div>
                  {p.precio_tachado && <div className="text-xs text-gray-400 line-through">${Number(p.precio_tachado).toLocaleString('es-AR')}</div>}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.stock === 0 ? 'bg-red-100 text-red-600' : p.stock <= p.stock_alerta ? 'bg-amber-100 text-amber-700' : 'bg-[#E1F5EE] text-[#0F6E56]'}`}>
                    {p.stock} u.
                  </span>
                </td>
                <td className="px-5 py-3">
                  {p.apto_grabado ? (
                    <div>
                      <span className="text-xs bg-[#E1F5EE] text-[#0F6E56] px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                        <Check size={10} /> Sí
                      </span>
                      {Number((p as any).costo_grabado) > 0 && (
                        <div className="text-xs text-gray-400 mt-1">+${Number((p as any).costo_grabado).toLocaleString('es-AR')}</div>
                      )}
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  <ActivoBadge activo={p.activo} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirModal(p)} className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
                      <Copy size={13} />
                    </button>
                    <BotonEliminar onClick={() => eliminarMutation.mutate(p.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!productos || productos.length === 0) && (
          <div className="text-center py-16 text-sm text-gray-400">
            No hay productos. <button onClick={() => abrirModal()} className="text-[#1D9E75] underline">Crear el primero</button>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-medium">{productoEditando ? 'Editar producto' : 'Nuevo producto'}</h2>
                <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              {/* Tabs Datos / Imágenes — solo cuando hay producto existente */}
              {productoEditando && (
                <div className="flex gap-1">
                  {([['datos', 'Datos'], ['imagenes', 'Imágenes']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTabModal(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tabModal === key ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                      {key === 'imagenes' && <Image size={12} />}{label}
                      {key === 'imagenes' && imagenesProducto && (
                        <span className="bg-white/30 text-[10px] rounded-full px-1.5">{imagenesProducto.length}/4</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 flex flex-col gap-4">
              {/* ── Tab IMÁGENES ── */}
              {tabModal === 'imagenes' && productoEditando && (
                <div>
                  <p className="text-xs text-gray-400 mb-3">
                    La imagen marcada como <strong>Principal</strong> es la que aparece en el listado y la card. Podés subir hasta 4 imágenes.
                  </p>
                  <ImageUploader
                    productoId={productoEditando.id}
                    imagenes={imagenesProducto ?? []}
                    onUpdate={() => {
                      refetchImagenes();
                      queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] });
                    }}
                    maxImagenes={4}
                  />
                </div>
              )}

              {/* ── Tab DATOS ── */}
              {(tabModal === 'datos' || !productoEditando) && <>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Información básica</div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input className={inputClass} value={form.nombre} onChange={e => {
                    const n = e.target.value;
                    setForm(f => ({ ...f, nombre: n, slug: generarSlug(n) }));
                  }} placeholder="Mate acero grabado personalizado" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Slug</label>
                    <input className={inputClass} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                    <input className={inputClass} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="MLS-ACE-001" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
                  <select className={inputClass} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
                  <textarea className={inputClass + ' resize-none h-16'} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
              </div>

              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Precio y stock</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Precio *</label>
                  <input className={inputClass} type="number" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Precio tachado</label>
                  <input className={inputClass} type="number" value={form.precio_tachado} onChange={e => setForm(f => ({ ...f, precio_tachado: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Stock</label>
                  <input className={inputClass} type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Alerta de stock bajo</label>
                  <input className={inputClass} type="number" value={form.stock_alerta} onChange={e => setForm(f => ({ ...f, stock_alerta: e.target.value }))} />
                </div>
              </div>

              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Características</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Material</label>
                  <input className={inputClass} value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="Acero inoxidable 304" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dimensiones</label>
                  <input className={inputClass} value={form.dimensiones} onChange={e => setForm(f => ({ ...f, dimensiones: e.target.value }))} placeholder="300 ml" />
                </div>
              </div>

              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Opciones</div>
              <div className="flex flex-col gap-2">

                {/* APTO GRABADO LÁSER — controla personalizado_habilitado automáticamente */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  <div>
                    <div className="text-sm font-medium">Apto grabado láser</div>
                    <div className="text-xs text-gray-400">Habilita la personalización y muestra el badge en la tienda</div>
                  </div>
                  <button
                    onClick={() => setForm(f => ({
                      ...f,
                      apto_grabado: !f.apto_grabado,
                      personalizado_habilitado: !f.apto_grabado,
                    }))}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.apto_grabado ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.apto_grabado ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* COSTO DEL GRABADO — solo visible si apto_grabado está activo */}
                {form.apto_grabado && (
                  <div className="bg-[#E1F5EE] rounded-lg px-4 py-3 border border-[#9FE1CB]">
                    <label className="text-xs text-[#0F6E56] font-medium mb-1 block">Costo del grabado</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0F6E56]">$</span>
                      <input
                        type="number"
                        value={form.costo_grabado}
                        onChange={e => setForm(f => ({ ...f, costo_grabado: e.target.value }))}
                        className="border border-[#9FE1CB] rounded-lg px-3 py-1.5 text-sm focus:outline-none w-28 bg-white"
                      />
                    </div>
                    <p className="text-xs text-[#0F6E56] mt-1">Se suma al precio cuando el cliente elige personalizar</p>
                  </div>
                )}

                {[
                  { key: 'activo', label: 'Producto activo', sub: 'Visible en la tienda' },
                  { key: 'destacado', label: 'Destacado en home', sub: 'Aparece en "Más vendidos"' },
                ].map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-gray-400">{sub}</div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${(form as any)[key] ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${(form as any)[key] ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>

              {form.apto_grabado && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Colores de grabado (separados por coma)</label>
                  <input className={inputClass} value={form.colores_disponibles} onChange={e => setForm(f => ({ ...f, colores_disponibles: e.target.value }))} placeholder="Natural, Negro, Dorado, Verde" />
                </div>
              )}

              <>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Aparece en secciones del inicio</div>
                {seccionesProductos.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                    No hay secciones de <strong>Productos destacados</strong> activas en el inicio.
                    Agregá una desde <strong>Configuración → Inicio</strong>.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {seccionesProductos.map(s => (
                      <label key={s.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={seccionesSeleccionadas.includes(s.id)}
                          onChange={e => {
                            setSeccionesSeleccionadas(prev =>
                              e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                            );
                          }}
                          className="accent-[#1D9E75] w-4 h-4"
                        />
                        <div>
                          <div className="text-sm font-medium">{s.datos.titulo || 'Sección sin título'}</div>
                          <div className="text-xs text-gray-400">
                            {(s.datos.productos_ids ?? []).length} producto(s) asignado(s)
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
              </> /* fin tab datos */}

            </div>
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={cerrarModal} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                {tabModal === 'imagenes' ? 'Cerrar' : 'Cancelar'}
              </button>
              {(tabModal === 'datos' || !productoEditando) && (
                <button
                  onClick={handleSubmit}
                  className="bg-[#1D9E75] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50"
                >
                  Guardar producto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Copy, Check, Image, Shapes, Layers, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import type { Producto, Categoria, ImagenProducto } from '../../types';
import ImageUploader from '../../components/ui/ImageUploader';
import VariantesTab from '../../components/admin/VariantesTab';
import CategoriasPanel from '../../components/admin/CategoriasPanel';
import ActivoBadge from '../../components/ui/ActivoBadge';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';

interface SeccionHP { id: string; tipo: string; activo: boolean; orden: number; datos: Record<string, any>; }

export default function AdminProductos() {
  const queryClient = useQueryClient();
  // Tab de página (Productos / Categorías) — no confundir con tabModal, que
  // son las tabs internas del modal de edición de un producto puntual.
  const [tabPagina, setTabPagina] = useState<'productos' | 'categorias'>('productos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tabModal, setTabModal] = useState<'datos' | 'imagenes' | 'variantes'>('datos');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  // Aviso cuando guardarSecciones tocó el homepage — el guardado queda en
  // BORRADOR (mismo mecanismo que el resto del homepage builder), no se
  // publica solo, así que sin este aviso el producto "desaparece" en
  // silencio hasta que alguien publique desde Configuración → Inicio.
  const [avisoPublicar, setAvisoPublicar] = useState(false);
  const [form, setForm] = useState({
    nombre: '', slug: '', descripcion: '', categoria_id: '',
    precio_base: '', precio_tachado: '', stock: '0', stock_alerta: '5',
    sku: '', material: '', dimensiones: '', peso_kg: '',
    apto_grabado: false, costo_grabado: '0', colores_disponibles: '',
    personalizado_habilitado: false, personalizado_max_chars: '30',
    personalizado_placeholder: '', activo: true, destacado: false,
  });
  // Evita perder lo cargado si se hace click afuera del modal por error —
  // ver bug reportado: el modal se cerraba solo con cualquier click en el
  // backdrop, sin avisar, perdiendo todo el formulario.
  const { marcarSnapshot, confirmarCierre } = useDirtyGuard<typeof form>();

  const { data: productos, isLoading: productosLoading, isError: productosError } = useQuery<Producto[]>({
    queryKey: ['admin-productos-lista'],
    queryFn: () => api.get('/productos/admin/todos?limit=100').then(r => r.data.data),
  });

  const { data: categorias } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then(r => r.data),
  });

  // Bugfix: leía /configuracion/homepage (PUBLICADO). El checkbox "Aparece en
  // secciones del inicio" debe reflejar y editar el BORRADOR — mismo estado
  // que edita el resto del homepage builder — para no pisar cambios sin
  // publicar de otras secciones al guardar, y para que el checklist muestre
  // lo que de verdad va a pasar (recién visible en el sitio tras publicar).
  // getHomepageBorrador devuelve el array directamente, no { secciones: [...] }
  const { data: todasSecciones = [] } = useQuery<SeccionHP[]>({
    queryKey: ['homepage-borrador'],
    queryFn: () => api.get('/configuracion/homepage/borrador').then(r => r.data),
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

  // Nota: alta/edición de producto NO usa mutations de React Query — pasa por
  // handleSubmit (abajo), que encadena guardarSecciones() después del
  // api.post/put. Antes había crearMutation/editarMutation acá pero quedaron
  // sin usar (huérfanas) porque handleSubmit las evade por completo.
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
      const formCargado = {
        nombre: producto.nombre,
        slug: producto.slug,
        descripcion: producto.descripcion || '',
        categoria_id: producto.categoria_id?.toString() || '',
        precio_base: producto.precio_base.toString(),
        precio_tachado: producto.precio_tachado?.toString() || '',
        stock: (producto.stock ?? 0).toString(),
        stock_alerta: (producto.stock_alerta ?? 0).toString(),
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
      };
      setForm(formCargado);
      marcarSnapshot(formCargado);
    } else {
      setProductoEditando(null);
      setSeccionesSeleccionadas([]);
      const formVacio = {
        nombre: '', slug: '', descripcion: '', categoria_id: '',
        precio_base: '', precio_tachado: '', stock: '0', stock_alerta: '5',
        sku: '', material: '', dimensiones: '', peso_kg: '',
        apto_grabado: false, costo_grabado: '0', colores_disponibles: '',
        personalizado_habilitado: false, personalizado_max_chars: '30',
        personalizado_placeholder: '', activo: true, destacado: false,
      };
      setForm(formVacio);
      marcarSnapshot(formVacio);
    }
    setTabModal('datos');
    setModalAbierto(true);
  };

  // Backdrop-click, botón × y "Cancelar" pasan los tres por acá — si hay
  // cambios sin guardar respecto al snapshot tomado al abrir, confirma antes
  // de descartar.
  const cerrarModal = () => {
    if (!confirmarCierre(form)) return;
    setModalAbierto(false);
    setProductoEditando(null);
  };

  // Para usar después de un guardado exitoso: ya no hay nada que perder, así
  // que cierra directo sin pasar por el guard de cambios sin guardar.
  const cerrarModalTrasGuardar = () => {
    setModalAbierto(false);
    setProductoEditando(null);
  };

  const guardarSecciones = async (productoId: string) => {
    // Siempre fetch fresh para no sobreescribir cambios recientes con datos
    // cacheados — pero del BORRADOR, no de lo publicado (ver comentario en
    // el useQuery de arriba): el PUT de este endpoint siempre escribe
    // borrador, así que si la base fuera lo publicado se pisarían cambios
    // pendientes de otras secciones que todavía no se publicaron.
    const { data: frescas } = await api.get<SeccionHP[]>('/configuracion/homepage/borrador');
    if (!frescas?.length) return;
    let cambio = false;
    const actualizadas = frescas.map(s => {
      if (s.tipo !== 'productos_destacados') return s;
      const ids: string[] = s.datos.productos_ids ?? [];
      const estaSeleccionada = seccionesSeleccionadas.includes(s.id);
      const yaEstaba = ids.includes(productoId);
      if (estaSeleccionada && !yaEstaba) { cambio = true; return { ...s, datos: { ...s.datos, productos_ids: [...ids, productoId] } }; }
      if (!estaSeleccionada && yaEstaba) { cambio = true; return { ...s, datos: { ...s.datos, productos_ids: ids.filter(id => id !== productoId) } }; }
      return s;
    });
    if (!cambio) return;
    await api.put('/configuracion/homepage', { secciones: actualizadas });
    queryClient.invalidateQueries({ queryKey: ['homepage-borrador'] });
    setAvisoPublicar(true);
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
    setGuardando(true);
    try {
      if (productoEditando) {
        await api.put(`/productos/${productoEditando.id}`, data);
        await guardarSecciones(productoEditando.id);
        queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] });
        cerrarModalTrasGuardar();
      } else {
        const res = await api.post('/productos', data);
        await guardarSecciones(res.data.id);
        queryClient.invalidateQueries({ queryKey: ['admin-productos-lista'] });
        cerrarModalTrasGuardar();
      }
    } finally {
      setGuardando(false);
    }
  };

  const generarSlug = (nombre: string) =>
    nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const inputClass = 'border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] w-full';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Productos</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Catálogo, precios, stock, variantes y categorías</p>
        </div>
      </div>

      {/* Tabs de página: Productos / Categorías */}
      <div className="flex gap-1 border border-[var(--line)] rounded-xl p-1 bg-[var(--panel)] w-fit mb-6">
        <button onClick={() => setTabPagina('productos')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tabPagina === 'productos' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
          <Shapes size={14} /> Productos
        </button>
        <button onClick={() => setTabPagina('categorias')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tabPagina === 'categorias' ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
          <Layers size={14} /> Categorías
        </button>
      </div>

      {tabPagina === 'categorias' ? (
        <CategoriasPanel />
      ) : (
      <>
      {avisoPublicar && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            Guardado — el cambio en <strong>secciones del inicio</strong> queda en borrador. Para que se vea en el sitio, publicá los cambios desde <strong>Configuración → Inicio</strong>.
          </p>
          <button onClick={() => setAvisoPublicar(false)} className="text-xs text-amber-700 hover:underline flex-shrink-0">Cerrar</button>
        </div>
      )}
      <div className="flex justify-end items-center mb-4">
        <AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => abrirModal()}>
          Nuevo producto
        </AdminButton>
      </div>

      <AdminCard padded={false}>
        <AdminTable
          columns={['Producto', 'Categoría', 'Precio', 'Stock', 'Láser', 'Estado', 'Acciones']}
          isLoading={productosLoading}
          isError={productosError}
          isEmpty={!productos || productos.length === 0}
          emptyMessage={<>No hay productos. <button onClick={() => abrirModal()} className="text-[var(--accent)] underline">Crear el primero</button></>}
        >
            {productos?.map((p) => (
              <tr key={p.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
                <td className="px-5 py-3">
                  <div className="text-sm font-medium text-[var(--ink)]">{p.nombre}</div>
                  <div className="text-xs text-[var(--ink-soft)]">{p.sku || p.slug}</div>
                </td>
                <td className="px-5 py-3 text-sm text-[var(--ink-soft)]">{(p as any).categorias?.nombre || '—'}</td>
                <td className="px-5 py-3">
                  <div className="text-sm font-medium text-[var(--ink)]">${Number(p.precio_base).toLocaleString('es-AR')}</div>
                  {p.precio_tachado && <div className="text-xs text-[var(--ink-soft)] line-through">${Number(p.precio_tachado).toLocaleString('es-AR')}</div>}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${(p.stock ?? 0) === 0 ? 'bg-red-100 text-red-600' : (p.stock ?? 0) <= (p.stock_alerta ?? 0) ? 'bg-amber-100 text-amber-700' : 'bg-[var(--accent-soft)] text-[var(--accent-hover)]'}`}>
                    {p.stock ?? 0} u.
                  </span>
                </td>
                <td className="px-5 py-3">
                  {p.apto_grabado ? (
                    <div>
                      <span className="text-xs bg-[var(--accent-soft)] text-[var(--accent-hover)] px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                        <Check size={10} /> Sí
                      </span>
                      {Number((p as any).costo_grabado) > 0 && (
                        <div className="text-xs text-[var(--ink-soft)] mt-1">+${Number((p as any).costo_grabado).toLocaleString('es-AR')}</div>
                      )}
                    </div>
                  ) : <span className="text-xs text-[var(--n-300)]">—</span>}
                </td>
                <td className="px-5 py-3">
                  <ActivoBadge activo={p.activo} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <AdminButton variant="ghost" size="sm" onClick={() => abrirModal(p)} aria-label="Editar">
                      <Pencil size={13} />
                    </AdminButton>
                    <AdminButton variant="ghost" size="sm" aria-label="Duplicar">
                      <Copy size={13} />
                    </AdminButton>
                    <AdminButton
                      variant="danger" size="sm"
                      disabled={eliminarMutation.isPending && eliminarMutation.variables === p.id}
                      onClick={() => {
                        if (confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) eliminarMutation.mutate(p.id);
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
      </>
      )}

      {/* MODAL */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-[var(--panel)] rounded-[var(--radius-card)] w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[var(--panel)] px-6 py-4 border-b border-[var(--line)]">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-medium text-[var(--ink)]">{productoEditando ? 'Editar producto' : 'Nuevo producto'}</h2>
                <button onClick={cerrarModal} className="text-[var(--ink-soft)] hover:text-[var(--ink-soft)] text-xl leading-none">×</button>
              </div>
              {/* Tabs Datos / Imágenes — solo cuando hay producto existente */}
              {productoEditando && (
                <div className="flex gap-1">
                  {([['datos', 'Datos'], ['imagenes', 'Imágenes'], ['variantes', 'Variantes']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTabModal(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tabModal === key ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--n-100)]'}`}>
                      {key === 'imagenes' && <Image size={12} />}
                      {key === 'variantes' && <Shapes size={12} />}
                      {label}
                      {key === 'imagenes' && imagenesProducto && (
                        <span className="bg-[var(--panel)]/30 text-[10px] rounded-full px-1.5">{imagenesProducto.length}/4</span>
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
                  <p className="text-xs text-[var(--ink-soft)] mb-3">
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

              {/* ── Tab VARIANTES ── */}
              {tabModal === 'variantes' && productoEditando && (
                <VariantesTab productoId={productoEditando.id} imagenesProducto={imagenesProducto ?? []} />
              )}

              {/* ── Tab DATOS ── */}
              {(tabModal === 'datos' || !productoEditando) && <>
              <div className="text-xs font-medium text-[var(--ink-soft)] uppercase tracking-wider">Información básica</div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Nombre *</label>
                  <input className={inputClass} value={form.nombre} onChange={e => {
                    const n = e.target.value;
                    setForm(f => ({ ...f, nombre: n, slug: generarSlug(n) }));
                  }} placeholder="Mate acero grabado personalizado" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--ink-soft)] mb-1 block">Slug</label>
                    <input className={inputClass} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--ink-soft)] mb-1 block">SKU</label>
                    <input className={inputClass} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="MLS-ACE-001" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Categoría</label>
                  <select className={inputClass} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Descripción</label>
                  <textarea className={inputClass + ' resize-none h-16'} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
              </div>

              <div className="text-xs font-medium text-[var(--ink-soft)] uppercase tracking-wider">Precio y stock</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Precio *</label>
                  <input className={inputClass} type="number" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Precio tachado</label>
                  <input className={inputClass} type="number" value={form.precio_tachado} onChange={e => setForm(f => ({ ...f, precio_tachado: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Stock</label>
                  <input className={inputClass} type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Alerta de stock bajo</label>
                  <input className={inputClass} type="number" value={form.stock_alerta} onChange={e => setForm(f => ({ ...f, stock_alerta: e.target.value }))} />
                </div>
              </div>

              <div className="text-xs font-medium text-[var(--ink-soft)] uppercase tracking-wider">Características</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Material</label>
                  <input className={inputClass} value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="Acero inoxidable 304" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Dimensiones</label>
                  <input className={inputClass} value={form.dimensiones} onChange={e => setForm(f => ({ ...f, dimensiones: e.target.value }))} placeholder="300 ml" />
                </div>
              </div>

              <div className="text-xs font-medium text-[var(--ink-soft)] uppercase tracking-wider">Opciones</div>
              <div className="flex flex-col gap-2">

                {/* APTO GRABADO LÁSER — controla personalizado_habilitado automáticamente */}
                <div className="flex items-center justify-between bg-[var(--n-50)] rounded-lg px-4 py-3 border border-[var(--line)]">
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">Apto grabado láser</div>
                    <div className="text-xs text-[var(--ink-soft)]">Habilita la personalización y muestra el badge en la tienda</div>
                  </div>
                  <button
                    onClick={() => setForm(f => ({
                      ...f,
                      apto_grabado: !f.apto_grabado,
                      personalizado_habilitado: !f.apto_grabado,
                    }))}
                    className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.apto_grabado ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}
                  >
                    <div className={`w-4 h-4 bg-[var(--panel)] rounded-full absolute top-0.5 transition-all ${form.apto_grabado ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* COSTO DEL GRABADO — solo visible si apto_grabado está activo */}
                {form.apto_grabado && (
                  <div className="bg-[var(--accent-soft)] rounded-lg px-4 py-3 border border-[var(--accent)]">
                    <label className="text-xs text-[var(--accent-hover)] font-medium mb-1 block">Costo del grabado</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--accent-hover)]">$</span>
                      <input
                        type="number"
                        value={form.costo_grabado}
                        onChange={e => setForm(f => ({ ...f, costo_grabado: e.target.value }))}
                        className="border border-[var(--accent)] rounded-lg px-3 py-1.5 text-sm focus:outline-none w-28 bg-[var(--panel)]"
                      />
                    </div>
                    <p className="text-xs text-[var(--accent-hover)] mt-1">Se suma al precio cuando el cliente elige personalizar</p>
                  </div>
                )}

                {[
                  { key: 'activo', label: 'Producto activo', sub: 'Visible en la tienda' },
                ].map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between bg-[var(--n-50)] rounded-lg px-4 py-3 border border-[var(--line)]">
                    <div>
                      <div className="text-sm font-medium text-[var(--ink)]">{label}</div>
                      <div className="text-xs text-[var(--ink-soft)]">{sub}</div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${(form as any)[key] ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}
                    >
                      <div className={`w-4 h-4 bg-[var(--panel)] rounded-full absolute top-0.5 transition-all ${(form as any)[key] ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>

              {form.apto_grabado && (
                <div>
                  <label className="text-xs text-[var(--ink-soft)] mb-1 block">Colores de grabado (separados por coma)</label>
                  <input className={inputClass} value={form.colores_disponibles} onChange={e => setForm(f => ({ ...f, colores_disponibles: e.target.value }))} placeholder="Natural, Negro, Dorado, Verde" />
                </div>
              )}

              <>
                <div className="text-xs font-medium text-[var(--ink-soft)] uppercase tracking-wider">Aparece en secciones del inicio</div>
                {seccionesProductos.length === 0 ? (
                  <p className="text-xs text-[var(--ink-soft)] bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-4 py-3">
                    No hay secciones de <strong>Productos destacados</strong> activas en el inicio.
                    Agregá una desde <strong>Configuración → Inicio</strong>.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {seccionesProductos.map(s => (
                      <label key={s.id} className="flex items-center gap-3 bg-[var(--n-50)] border border-[var(--line)] rounded-lg px-4 py-3 cursor-pointer hover:bg-[var(--n-100)] transition-colors">
                        <input
                          type="checkbox"
                          checked={seccionesSeleccionadas.includes(s.id)}
                          onChange={e => {
                            setSeccionesSeleccionadas(prev =>
                              e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                            );
                          }}
                          className="accent-[var(--accent)] w-4 h-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-[var(--ink)]">{s.datos.titulo || 'Sección sin título'}</div>
                          <div className="text-xs text-[var(--ink-soft)]">
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
            <div className="sticky bottom-0 bg-[var(--panel)] px-6 py-4 border-t border-[var(--line)] flex justify-end gap-3">
              <AdminButton variant="secondary" onClick={cerrarModal}>
                {tabModal === 'imagenes' || tabModal === 'variantes' ? 'Cerrar' : 'Cancelar'}
              </AdminButton>
              {(tabModal === 'datos' || !productoEditando) && (
                <AdminButton variant="primary" disabled={guardando} onClick={handleSubmit}>
                  {guardando ? 'Guardando...' : 'Guardar producto'}
                </AdminButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

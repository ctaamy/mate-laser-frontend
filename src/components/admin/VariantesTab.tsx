import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Shuffle } from 'lucide-react';
import api from '../../lib/api';
import type { TipoOpcion, VarianteProducto, ImagenProducto } from '../../types';

interface VariantesTabProps {
  productoId: string;
  precioBase: number;
  imagenesProducto: ImagenProducto[];
}

interface PlanSync {
  va_a_crear: number;
  va_a_completar: number;
  va_a_fusionar: number;
  va_a_purgar: number;
  no_resueltas: { id: string; motivo: string }[];
}

export default function VariantesTab({ productoId, precioBase, imagenesProducto }: VariantesTabProps) {
  const queryClient = useQueryClient();
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');
  const [nuevoTipoValores, setNuevoTipoValores] = useState('');
  const [planSync, setPlanSync] = useState<PlanSync | null>(null);
  const [nuevoValorPorTipo, setNuevoValorPorTipo] = useState<Record<string, string>>({});
  const [verInactivas, setVerInactivas] = useState(false);

  const { data: tiposOpcion } = useQuery<TipoOpcion[]>({
    queryKey: ['opciones-producto', productoId],
    queryFn: () => api.get(`/productos/${productoId}/opciones`).then(r => r.data),
  });

  const { data: variantes } = useQuery<VarianteProducto[]>({
    queryKey: ['variantes-producto', productoId],
    queryFn: () => api.get(`/productos/${productoId}/variantes`).then(r => r.data),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['opciones-producto', productoId] });
    queryClient.invalidateQueries({ queryKey: ['variantes-producto', productoId] });
  };

  const crearTipoMutation = useMutation({
    mutationFn: (data: { nombre: string; valores: string[] }) =>
      api.post(`/productos/${productoId}/opciones`, data),
    onSuccess: () => {
      setNuevoTipoNombre('');
      setNuevoTipoValores('');
      invalidar();
    },
  });

  const eliminarTipoMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/opciones/${id}`),
    onSuccess: invalidar,
  });

  // Agregar / quitar un valor de un tipo ya creado, sin borrar y rehacer el
  // tipo entero (eso dejaba variantes huérfanas). Después hay que "Sincronizar".
  const agregarValorMutation = useMutation({
    mutationFn: ({ tipoId, valor }: { tipoId: string; valor: string }) =>
      api.post(`/opciones/${tipoId}/valores`, { valor }),
    onSuccess: (_res, { tipoId }) => {
      setNuevoValorPorTipo(prev => ({ ...prev, [tipoId]: '' }));
      invalidar();
    },
  });

  const eliminarValorMutation = useMutation({
    mutationFn: (valorId: string) => api.delete(`/valores-opcion/${valorId}`),
    onSuccess: invalidar,
  });

  // Sincronizar = crear combos faltantes + completar parciales + fusionar stock
  // + purgar huérfanas. Se corre primero en dry-run para mostrar el plan, y
  // recién al confirmar se aplica.
  const sincronizarDryRunMutation = useMutation({
    mutationFn: () =>
      api.post(`/productos/${productoId}/variantes/sincronizar?dry_run=true`).then((r) => r.data as PlanSync),
    onSuccess: (plan) => setPlanSync(plan),
  });

  const aplicarSincronizacionMutation = useMutation({
    mutationFn: () => api.post(`/productos/${productoId}/variantes/sincronizar`).then((r) => r.data),
    onSuccess: (res) => {
      setPlanSync(null);
      if (res?.no_resueltas?.length) {
        alert(
          `Sincronizado. Quedaron ${res.no_resueltas.length} variante(s) sin resolver que hay que arreglar a mano (ver el detalle en el panel).`,
        );
      }
      invalidar();
    },
  });

  const planVacio =
    planSync != null &&
    planSync.va_a_crear === 0 &&
    planSync.va_a_completar === 0 &&
    planSync.va_a_fusionar === 0 &&
    planSync.va_a_purgar === 0 &&
    planSync.no_resueltas.length === 0;

  const actualizarVarianteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VarianteProducto> }) =>
      api.put(`/variantes/${id}`, data),
    onSuccess: invalidar,
  });

  // Borra de verdad una variante huérfana (sin opciones). El backend la desactiva
  // en vez de borrarla si está referenciada por ventas o por el configurador.
  const purgarVarianteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/variantes/${id}/purgar`),
    onSuccess: (res) => {
      if (res.data?.accion === 'desactivada') {
        alert(
          'No se pudo borrar: la variante está referenciada (ventas o configurador). Se desactivó en su lugar.',
        );
      }
      invalidar();
    },
  });

  const esHuerfana = (v: VarianteProducto) => (v.variante_valores ?? []).length === 0;
  const huerfanas = (variantes ?? []).filter(esHuerfana);
  const variantesActivas = (variantes ?? []).filter(v => v.activo);
  const variantesInactivas = (variantes ?? []).filter(v => !v.activo);

  const handleCrearTipo = () => {
    const valores = nuevoTipoValores.split(',').map(v => v.trim()).filter(Boolean);
    if (!nuevoTipoNombre.trim() || valores.length === 0) return;
    crearTipoMutation.mutate({ nombre: nuevoTipoNombre.trim(), valores });
  };

  const describirCombinacion = (variante: VarianteProducto) =>
    (variante.variante_valores ?? [])
      .map(vv => `${vv.valores_opcion.tipos_opcion.nombre}: ${vv.valores_opcion.valor}`)
      .join(' / ') || 'Sin opciones';

  const setImagenVariante = (id: string, imagen_id: string | undefined) =>
    actualizarVarianteMutation.mutate({ id, data: { imagen_id } });

  const renderVariante = (variante: VarianteProducto) => {
    const huerfana = esHuerfana(variante);
    return (
      <div key={variante.id} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
            {describirCombinacion(variante)}
            {huerfana && (
              <span className="text-[10px] text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">huérfana</span>
            )}
          </span>
          {!variante.activo && <span className="text-[10px] text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">Inactiva</span>}
        </div>
        <div className="flex gap-3 items-start">
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Stock</label>
            <input
              type="number"
              defaultValue={variante.stock}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:border-[#1D9E75]"
              onBlur={e => {
                const stock = parseInt(e.target.value);
                if (!isNaN(stock) && stock !== variante.stock) {
                  actualizarVarianteMutation.mutate({ id: variante.id, data: { stock } });
                }
              }}
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Precio propio</label>
            <input
              type="number"
              min={0}
              step="0.01"
              aria-label="Precio propio"
              placeholder={`= $${Number(precioBase).toLocaleString('es-AR')}`}
              defaultValue={variante.precio_override ?? ''}
              title="Vacío = usa el precio base del producto. Un valor = precio absoluto de esta variante."
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none focus:border-[#1D9E75]"
              onBlur={e => {
                const raw = e.target.value.trim();
                const nuevo = raw === '' ? null : Number(raw);
                if (nuevo !== null && (isNaN(nuevo) || nuevo < 0)) return;
                const actual = variante.precio_override ?? null;
                if (nuevo !== actual) {
                  actualizarVarianteMutation.mutate({ id: variante.id, data: { precio_override: nuevo } });
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-500 mb-1 block">Imagen de la variante</label>
            {imagenesProducto.length === 0 ? (
              <p className="text-[11px] text-gray-400 pt-1.5">Cargá imágenes en la pestaña "Imágenes" primero.</p>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setImagenVariante(variante.id, undefined)}
                  title="Sin imagen propia (usa la del producto)"
                  className={`flex-shrink-0 w-11 h-11 rounded-md border text-[9px] text-gray-400 flex items-center justify-center ${
                    !variante.imagen_id ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-200'
                  }`}
                >
                  sin<br />img
                </button>
                {imagenesProducto.map((img, i) => (
                  <button
                    type="button"
                    key={img.id}
                    onClick={() => setImagenVariante(variante.id, img.id)}
                    title={img.alt_texto || `Imagen ${i + 1}${img.es_principal ? ' (principal)' : ''}`}
                    className={`relative flex-shrink-0 w-11 h-11 rounded-md overflow-hidden border ${
                      variante.imagen_id === img.id ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-200'
                    }`}
                  >
                    <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/55 text-white text-[8px] leading-none px-1 py-0.5 rounded-tl">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {huerfana ? (
            <button
              onClick={() => {
                if (!variante.activo) {
                  purgarVarianteMutation.mutate(variante.id);
                  return;
                }
                const aviso =
                  (variante.stock ?? 0) > 0
                    ? `Esta variante tiene ${variante.stock} de stock que se van a perder. `
                    : '';
                if (confirm(`${aviso}¿Borrar esta variante sin opciones?`)) {
                  purgarVarianteMutation.mutate(variante.id);
                }
              }}
              disabled={purgarVarianteMutation.isPending}
              title={variante.activo ? 'Borrar variante huérfana' : 'Intentar borrar (si tiene ventas queda inactiva)'}
              className="text-gray-400 hover:text-red-500 pt-5 disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              onClick={() =>
                actualizarVarianteMutation.mutate({ id: variante.id, data: { activo: !variante.activo } })
              }
              title={variante.activo ? 'Desactivar variante' : 'Activar variante'}
              className="text-gray-400 hover:text-red-500 pt-5"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-gray-400 mb-3">
          Definí los tipos de opción del producto (ej: Color, Talle) y sus valores. Después
          generá las combinaciones para cargar stock, imagen y —si esa variante cuesta
          distinto— un precio propio. Sin precio propio, la variante usa el precio base.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {tiposOpcion?.map(tipo => (
            <div key={tipo.id} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{tipo.nombre}</span>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar el tipo de opción "${tipo.nombre}"? Esto también borra sus valores.`)) {
                      eliminarTipoMutation.mutate(tipo.id);
                    }
                  }}
                  title="Eliminar el tipo de opción"
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {tipo.valores.map(v => (
                  <span key={v.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-gray-700">
                    {v.valor}
                    <button
                      onClick={() => {
                        if (confirm(`¿Quitar el valor "${v.valor}"? También se quitan las variantes que lo usaban. Después "Sincronizar variantes".`)) {
                          eliminarValorMutation.mutate(v.id);
                        }
                      }}
                      disabled={eliminarValorMutation.isPending}
                      title={`Quitar "${v.valor}"`}
                      className="text-gray-300 hover:text-red-500 disabled:opacity-40"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  className="border border-gray-200 rounded-full px-2.5 py-0.5 text-xs w-28 focus:outline-none focus:border-[#1D9E75]"
                  placeholder="+ valor"
                  value={nuevoValorPorTipo[tipo.id] ?? ''}
                  onChange={e => setNuevoValorPorTipo(prev => ({ ...prev, [tipo.id]: e.target.value }))}
                  onKeyDown={e => {
                    const valor = (nuevoValorPorTipo[tipo.id] ?? '').trim();
                    if (e.key === 'Enter' && valor) agregarValorMutation.mutate({ tipoId: tipo.id, valor });
                  }}
                />
                <button
                  onClick={() => {
                    const valor = (nuevoValorPorTipo[tipo.id] ?? '').trim();
                    if (valor) agregarValorMutation.mutate({ tipoId: tipo.id, valor });
                  }}
                  disabled={agregarValorMutation.isPending || !(nuevoValorPorTipo[tipo.id] ?? '').trim()}
                  className="text-xs text-[#1D9E75] hover:text-[#0F6E56] disabled:opacity-40"
                >
                  Agregar valor
                </button>
              </div>
            </div>
          ))}
          {(!tiposOpcion || tiposOpcion.length === 0) && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              Este producto todavía no tiene opciones configuradas. Sin opciones, sigue
              funcionando con el stock general de arriba.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-32"
            placeholder="Tipo (ej: Color)"
            value={nuevoTipoNombre}
            onChange={e => setNuevoTipoNombre(e.target.value)}
          />
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] flex-1"
            placeholder="Valores separados por coma (ej: Rojo, Azul, Verde)"
            value={nuevoTipoValores}
            onChange={e => setNuevoTipoValores(e.target.value)}
          />
          <button
            onClick={handleCrearTipo}
            disabled={crearTipoMutation.isPending}
            className="bg-[#1D9E75] text-white rounded-lg px-3 py-2 text-sm hover:bg-[#0F6E56] disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>

      {tiposOpcion && tiposOpcion.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Variantes ({variantesActivas.length}
              {variantesInactivas.length > 0 && ` · ${variantesInactivas.length} inactiva${variantesInactivas.length > 1 ? 's' : ''}`})
            </div>
            <button
              onClick={() => sincronizarDryRunMutation.mutate()}
              disabled={sincronizarDryRunMutation.isPending || aplicarSincronizacionMutation.isPending}
              className="text-xs text-[#1D9E75] hover:text-[#0F6E56] flex items-center gap-1 disabled:opacity-50"
            >
              <Shuffle size={12} /> Sincronizar variantes
            </button>
          </div>

          {planSync && (
            <div className="text-[11px] border border-gray-200 rounded-lg px-3 py-2.5 mb-2 bg-white">
              {planVacio ? (
                <p className="text-gray-500">Las variantes ya están sincronizadas con las opciones actuales.</p>
              ) : (
                <>
                  <p className="font-medium text-gray-700 mb-1">Al sincronizar:</p>
                  <ul className="text-gray-600 space-y-0.5 mb-2">
                    {planSync.va_a_crear > 0 && <li>· crear {planSync.va_a_crear} combinación(es) nueva(s) con stock 0</li>}
                    {planSync.va_a_completar > 0 && <li>· completar {planSync.va_a_completar} variante(s) parcial(es) (conservan su stock)</li>}
                    {planSync.va_a_fusionar > 0 && <li>· fusionar {planSync.va_a_fusionar}: mover su stock al combo completo y borrar la parcial</li>}
                    {planSync.va_a_purgar > 0 && <li>· purgar {planSync.va_a_purgar} huérfana(s) sin opciones</li>}
                  </ul>
                  {planSync.no_resueltas.length > 0 && (
                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                      <p className="font-medium">{planSync.no_resueltas.length} sin resolver (arreglar a mano):</p>
                      <ul className="space-y-0.5">
                        {planSync.no_resueltas.map((nr) => (
                          <li key={nr.id}>· {nr.motivo}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 mt-1">
                {!planVacio && (
                  <button
                    onClick={() => aplicarSincronizacionMutation.mutate()}
                    disabled={aplicarSincronizacionMutation.isPending}
                    className="bg-[#1D9E75] text-white rounded px-3 py-1 hover:bg-[#0F6E56] disabled:opacity-50"
                  >
                    {aplicarSincronizacionMutation.isPending ? 'Aplicando…' : 'Confirmar'}
                  </button>
                )}
                <button onClick={() => setPlanSync(null)} className="text-gray-500 hover:text-gray-700 px-2 py-1">
                  {planVacio ? 'Cerrar' : 'Cancelar'}
                </button>
              </div>
            </div>
          )}

          {huerfanas.length > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              Hay {huerfanas.length} variante{huerfanas.length > 1 ? 's' : ''} sin ninguna opción
              asociada. Quedan cuando se borra un tipo o valor de opción y una variante que lo
              usaba se queda sin nada. Borralas con la papelera 🗑 — las que tienen una venta o
              están en el configurador no se pueden borrar y quedan inactivas (fuera de la tienda).
              Editá los valores de cada tipo arriba en vez de borrarlo y rehacerlo para no
              generar más.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {variantesActivas.map(renderVariante)}
            {variantesActivas.length === 0 && (
              <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                Todavía no hay variantes activas. Usá "Sincronizar variantes".
              </p>
            )}
          </div>

          {variantesInactivas.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setVerInactivas(v => !v)}
                className="text-[11px] text-gray-400 hover:text-gray-600"
              >
                {verInactivas ? 'Ocultar' : 'Mostrar'} {variantesInactivas.length} inactiva{variantesInactivas.length > 1 ? 's' : ''}
              </button>
              {verInactivas && (
                <div className="flex flex-col gap-2 mt-2 opacity-60">
                  {variantesInactivas.map(renderVariante)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

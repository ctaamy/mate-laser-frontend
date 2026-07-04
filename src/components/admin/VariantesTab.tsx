import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Shuffle } from 'lucide-react';
import api from '../../lib/api';
import type { TipoOpcion, VarianteProducto, ImagenProducto } from '../../types';

interface VariantesTabProps {
  productoId: string;
  imagenesProducto: ImagenProducto[];
}

export default function VariantesTab({ productoId, imagenesProducto }: VariantesTabProps) {
  const queryClient = useQueryClient();
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');
  const [nuevoTipoValores, setNuevoTipoValores] = useState('');

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

  const generarCombinacionesMutation = useMutation({
    mutationFn: () => api.post(`/productos/${productoId}/variantes/generar-combinaciones`),
    onSuccess: invalidar,
  });

  const actualizarVarianteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VarianteProducto> }) =>
      api.put(`/variantes/${id}`, data),
    onSuccess: invalidar,
  });

  const handleCrearTipo = () => {
    const valores = nuevoTipoValores.split(',').map(v => v.trim()).filter(Boolean);
    if (!nuevoTipoNombre.trim() || valores.length === 0) return;
    crearTipoMutation.mutate({ nombre: nuevoTipoNombre.trim(), valores });
  };

  const describirCombinacion = (variante: VarianteProducto) =>
    (variante.variante_valores ?? [])
      .map(vv => `${vv.valores_opcion.tipos_opcion.nombre}: ${vv.valores_opcion.valor}`)
      .join(' / ') || 'Sin opciones';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-gray-400 mb-3">
          Definí los tipos de opción del producto (ej: Color, Talle) y sus valores. Después
          generá las combinaciones para cargar stock e imagen por variante.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {tiposOpcion?.map(tipo => (
            <div key={tipo.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
              <div>
                <span className="text-sm font-medium text-gray-900">{tipo.nombre}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {tipo.valores.map(v => v.valor).join(', ')}
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar el tipo de opción "${tipo.nombre}"? Esto también borra sus valores.`)) {
                    eliminarTipoMutation.mutate(tipo.id);
                  }
                }}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
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
              Variantes ({variantes?.length ?? 0})
            </div>
            <button
              onClick={() => generarCombinacionesMutation.mutate()}
              disabled={generarCombinacionesMutation.isPending}
              className="text-xs text-[#1D9E75] hover:text-[#0F6E56] flex items-center gap-1 disabled:opacity-50"
            >
              <Shuffle size={12} /> Generar combinaciones faltantes
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {variantes?.map(variante => (
              <div key={variante.id} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{describirCombinacion(variante)}</span>
                  {!variante.activo && <span className="text-[10px] text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">Inactiva</span>}
                </div>
                <div className="flex gap-3 items-end">
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
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 mb-1 block">Imagen de la variante</label>
                    <select
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:border-[#1D9E75]"
                      value={variante.imagen_id ?? ''}
                      onChange={e =>
                        actualizarVarianteMutation.mutate({
                          id: variante.id,
                          data: { imagen_id: e.target.value || undefined },
                        })
                      }
                    >
                      <option value="">Sin imagen propia (usa la del producto)</option>
                      {imagenesProducto.map(img => (
                        <option key={img.id} value={img.id}>
                          {img.alt_texto || img.url.split('/').pop()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      actualizarVarianteMutation.mutate({
                        id: variante.id,
                        data: { activo: !variante.activo },
                      })
                    }
                    title={variante.activo ? 'Desactivar variante' : 'Activar variante'}
                    className="text-gray-400 hover:text-red-500 pb-1.5"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            {(!variantes || variantes.length === 0) && (
              <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                Todavía no hay variantes generadas. Usá "Generar combinaciones faltantes".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

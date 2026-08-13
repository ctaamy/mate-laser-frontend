import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import { useAuthStore } from '../../store/auth.store';

type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  rol: 'admin' | 'cliente';
  activo: boolean;
  ultimo_login: string | null;
  creado_en: string;
};

type AccionPendiente =
  | { tipo: 'rol'; usuario: Usuario; nuevoRol: 'admin' | 'cliente' }
  | { tipo: 'estado'; usuario: Usuario; nuevoActivo: boolean };

export default function AdminUsuarios() {
  const queryClient = useQueryClient();
  const usuarioActual = useAuthStore((s) => s.usuario);

  // Deep-link desde el nav del admin: /admin/usuarios?rol=admin|cliente
  // precarga el filtro. Solo se lee al montar — después el filtro lo maneja
  // el <select> como siempre, sin sincronizar de vuelta a la URL.
  const [searchParams] = useSearchParams();
  const rolInicial = searchParams.get('rol');

  const [q, setQ] = useState('');
  const [rolFiltro, setRolFiltro] = useState(
    rolInicial === 'admin' || rolInicial === 'cliente' ? rolInicial : ''
  );
  const [page, setPage] = useState(1);
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-usuarios', q, rolFiltro, page],
    queryFn: () =>
      api
        .get('/usuarios', { params: { q: q || undefined, rol: rolFiltro || undefined, page, limit } })
        .then((r) => r.data as { items: Usuario[]; total: number; page: number; limit: number }),
  });

  const cambiarRolMutation = useMutation({
    mutationFn: ({ id, rol }: { id: string; rol: string }) => api.patch(`/usuarios/${id}/rol`, { rol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] });
      setAccionPendiente(null);
    },
  });

  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => api.patch(`/usuarios/${id}/estado`, { activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-usuarios'] });
      setAccionPendiente(null);
    },
  });

  const guardando = cambiarRolMutation.isPending || cambiarEstadoMutation.isPending;
  const error = (cambiarRolMutation.error as any) || (cambiarEstadoMutation.error as any);

  const confirmarAccion = () => {
    if (!accionPendiente) return;
    if (accionPendiente.tipo === 'rol') {
      cambiarRolMutation.mutate({ id: accionPendiente.usuario.id, rol: accionPendiente.nuevoRol });
    } else {
      cambiarEstadoMutation.mutate({ id: accionPendiente.usuario.id, activo: accionPendiente.nuevoActivo });
    }
  };

  const cerrarModal = () => {
    setAccionPendiente(null);
    cambiarRolMutation.reset();
    cambiarEstadoMutation.reset();
  };

  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} usuarios</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75] w-64"
          placeholder="Buscar por email o nombre..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D9E75]"
          value={rolFiltro}
          onChange={(e) => {
            setRolFiltro(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="cliente">Cliente</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Nombre</th>
              <th className="text-left px-5 py-3">Rol</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Último login</th>
              <th className="text-left px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              const esUsuarioActual = u.id === usuarioActual?.id;
              return (
                <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-900">
                    {u.email}
                    {esUsuarioActual && <span className="ml-2 text-xs text-gray-400">(vos)</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {[u.nombre, u.apellido].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        u.rol === 'admin' ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <ActivoBadge activo={u.activo} />
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-AR') : 'Nunca'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        disabled={esUsuarioActual}
                        title={esUsuarioActual ? 'No podés cambiar tu propio rol' : undefined}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-[#1D9E75]"
                        value={u.rol}
                        onChange={(e) => {
                          const nuevoRol = e.target.value as 'admin' | 'cliente';
                          if (nuevoRol !== u.rol) {
                            setAccionPendiente({ tipo: 'rol', usuario: u, nuevoRol });
                          }
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="cliente">Cliente</option>
                      </select>
                      <button
                        disabled={esUsuarioActual && u.activo}
                        title={esUsuarioActual && u.activo ? 'No podés desactivar tu propia cuenta' : undefined}
                        onClick={() => setAccionPendiente({ tipo: 'estado', usuario: u, nuevoActivo: !u.activo })}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* isError primero: antes, cualquier request fallido (auth, red,
            lo que sea) se veía idéntico a "0 usuarios reales" porque data
            quedaba undefined y caía en el mismo mensaje de vacío — sin
            forma de distinguir un error de una lista genuinamente vacía. */}
        {isError && (
          <div className="text-center py-16 text-sm text-red-500">No se pudieron cargar los usuarios. Probá recargar la página.</div>
        )}
        {!isError && !isLoading && (!data || data.items.length === 0) && (
          <div className="text-center py-16 text-sm text-gray-400">No se encontraron usuarios</div>
        )}
      </div>

      {total > limit && (
        <div className="flex justify-center items-center gap-3 mt-4 text-sm text-gray-500">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPaginas}
          </span>
          <button
            disabled={page >= totalPaginas}
            onClick={() => setPage((p) => p + 1)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {accionPendiente && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cerrarModal}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-medium text-gray-900">
                {accionPendiente.tipo === 'rol' ? 'Cambiar rol' : accionPendiente.nuevoActivo ? 'Activar cuenta' : 'Desactivar cuenta'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6">
              {accionPendiente.tipo === 'rol' ? (
                <p className="text-sm text-gray-600">
                  Vas a cambiar el rol de <span className="font-medium text-gray-900">{accionPendiente.usuario.email}</span> de{' '}
                  <span className="font-medium">{accionPendiente.usuario.rol}</span> a{' '}
                  <span className="font-medium">{accionPendiente.nuevoRol}</span>.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Vas a {accionPendiente.nuevoActivo ? 'activar' : 'desactivar'} la cuenta de{' '}
                  <span className="font-medium text-gray-900">{accionPendiente.usuario.email}</span>.
                  {!accionPendiente.nuevoActivo && ' No va a poder iniciar sesión hasta que se reactive.'}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-3">
                  {error?.response?.data?.message || 'No se pudo completar la acción.'}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={cerrarModal} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={confirmarAccion}
                disabled={guardando}
                className="bg-[#1D9E75] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50"
              >
                {guardando ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

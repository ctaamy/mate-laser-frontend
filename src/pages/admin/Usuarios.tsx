import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import ActivoBadge from '../../components/ui/ActivoBadge';
import { useAuthStore } from '../../store/auth.store';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import AdminTable from '../../components/admin/ui/AdminTable';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminSelect } from '../../components/admin/ui/AdminInput';

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
          <h1 className="text-xl font-medium text-[var(--ink)]">Usuarios</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">{total} usuarios</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <AdminInput
          fullWidth={false}
          className="w-64"
          placeholder="Buscar por email o nombre..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <AdminSelect
          fullWidth={false}
          value={rolFiltro}
          onChange={(e) => {
            setRolFiltro(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="cliente">Cliente</option>
        </AdminSelect>
      </div>

      <AdminCard padded={false}>
        <AdminTable
          columns={['Email', 'Nombre', 'Rol', 'Estado', 'Último login', 'Acciones']}
          isLoading={isLoading}
          isError={isError}
          isEmpty={!data || data.items.length === 0}
          emptyMessage="No se encontraron usuarios"
          errorMessage="No se pudieron cargar los usuarios. Probá recargar la página."
        >
          {data?.items.map((u) => {
            const esUsuarioActual = u.id === usuarioActual?.id;
            return (
              <tr key={u.id} className="border-t border-[var(--line)] hover:bg-[var(--n-50)] transition-colors">
                <td className="px-5 py-3 text-sm text-[var(--ink)]">
                  {u.email}
                  {esUsuarioActual && <span className="ml-2 text-xs text-[var(--ink-soft)]">(vos)</span>}
                </td>
                <td className="px-5 py-3 text-sm text-[var(--ink-soft)]">
                  {[u.nombre, u.apellido].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      u.rol === 'admin' ? 'bg-[var(--accent-soft)] text-[var(--accent-hover)]' : 'bg-[var(--n-100)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {u.rol}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <ActivoBadge activo={u.activo} />
                </td>
                <td className="px-5 py-3 text-xs text-[var(--ink-soft)]">
                  {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-AR') : 'Nunca'}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <AdminSelect
                      fullWidth={false}
                      disabled={esUsuarioActual}
                      title={esUsuarioActual ? 'No podés cambiar tu propio rol' : undefined}
                      className="px-2 py-1.5 text-xs"
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
                    </AdminSelect>
                    <AdminButton
                      variant="secondary" size="sm"
                      disabled={esUsuarioActual && u.activo}
                      title={esUsuarioActual && u.activo ? 'No podés desactivar tu propia cuenta' : undefined}
                      onClick={() => setAccionPendiente({ tipo: 'estado', usuario: u, nuevoActivo: !u.activo })}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </AdminButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </AdminCard>

      {total > limit && (
        <div className="flex justify-center items-center gap-3 mt-4 text-sm text-[var(--ink-soft)]">
          <AdminButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </AdminButton>
          <span>
            Página {page} de {totalPaginas}
          </span>
          <AdminButton variant="secondary" size="sm" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </AdminButton>
        </div>
      )}

      <AdminModal
        open={!!accionPendiente}
        onClose={cerrarModal}
        title={accionPendiente ? (accionPendiente.tipo === 'rol' ? 'Cambiar rol' : accionPendiente.nuevoActivo ? 'Activar cuenta' : 'Desactivar cuenta') : ''}
        footer={<>
          <AdminButton variant="secondary" onClick={cerrarModal}>Cancelar</AdminButton>
          <AdminButton variant="primary" disabled={guardando} onClick={confirmarAccion}>
            {guardando ? 'Aplicando...' : 'Confirmar'}
          </AdminButton>
        </>}
      >
        {accionPendiente && (
          <>
            {accionPendiente.tipo === 'rol' ? (
              <p className="text-sm text-[var(--ink-soft)]">
                Vas a cambiar el rol de <span className="font-medium text-[var(--ink)]">{accionPendiente.usuario.email}</span> de{' '}
                <span className="font-medium">{accionPendiente.usuario.rol}</span> a{' '}
                <span className="font-medium">{accionPendiente.nuevoRol}</span>.
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">
                Vas a {accionPendiente.nuevoActivo ? 'activar' : 'desactivar'} la cuenta de{' '}
                <span className="font-medium text-[var(--ink)]">{accionPendiente.usuario.email}</span>.
                {!accionPendiente.nuevoActivo && ' No va a poder iniciar sesión hasta que se reactive.'}
              </p>
            )}
            {error && (
              <p className="text-sm text-[var(--error)] mt-3">
                {error?.response?.data?.message || 'No se pudo completar la acción.'}
              </p>
            )}
          </>
        )}
      </AdminModal>
    </div>
  );
}

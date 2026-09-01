import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, ChevronRight, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import type { Orden, OrdenResumen } from '../types';
import EstadoBadge from '../components/ui/EstadoBadge';
import BannerVerificacion from '../components/ui/BannerVerificacion';
import OrdenItems from '../components/orden/OrdenItems';
import OrdenEnvioResumen from '../components/orden/OrdenEnvioResumen';
import OrdenTimeline from '../components/orden/OrdenTimeline';

function formatFechaAR(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function DatosPersonales() {
  const { usuario, actualizarUsuario } = useAuthStore();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [apellido, setApellido] = useState(usuario?.apellido ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState('');

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setGuardado(false);
    setError('');
    try {
      const { data } = await api.put('/usuarios/perfil', { nombre, apellido, telefono });
      actualizarUsuario(data);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch {
      setError('No pudimos guardar los cambios. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleGuardar} data-testid="form-datos-personales" className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input value={usuario?.email ?? ''} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Apellido</label>
          <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={guardando} className="bg-[#1D9E75] text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-[#0F6E56] transition-colors disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardado && <span className="text-xs text-[#0F6E56] font-medium">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}

function ListaPedidos() {
  const { data: ordenes, isLoading } = useQuery<OrdenResumen[]>({
    queryKey: ['mis-ordenes'],
    queryFn: () => api.get('/ordenes/mis-ordenes').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-10 text-center">Cargando pedidos...</div>;
  }

  if (!ordenes || ordenes.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl py-16 flex flex-col items-center gap-3 text-center px-6">
        <Package size={32} className="text-gray-300" />
        <p className="text-sm text-gray-500">Todavía no hiciste ningún pedido.</p>
        <Link to="/productos" className="mt-2 bg-[#1D9E75] text-white rounded-lg py-2 px-5 text-sm font-medium hover:bg-[#0F6E56] transition-colors">
          Seguir comprando
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {ordenes.map((orden) => (
        <Link
          key={orden.id}
          to={`/mi-cuenta/pedidos/${orden.id}`}
          className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-gray-200 transition-colors"
        >
          <div>
            <div className="text-sm font-medium">Pedido #{orden.id.slice(0, 8).toUpperCase()}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {formatFechaAR(orden.creado_en)} · {orden.items_orden?.length ?? 0} {(orden.items_orden?.length ?? 0) === 1 ? 'producto' : 'productos'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <EstadoBadge estado={orden.estado} />
            <span className="text-sm font-medium">${Number(orden.total).toLocaleString('es-AR')}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function DetallePedido({ id }: { id: string }) {
  const navigate = useNavigate();
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  const { data: orden, isLoading } = useQuery<Orden>({
    queryKey: ['orden', id],
    queryFn: () => api.get(`/ordenes/${id}`).then((r) => r.data),
  });

  if (isLoading) return <div className="text-sm text-gray-400 py-10 text-center">Cargando...</div>;
  if (!orden) return <div className="text-sm text-gray-400 py-10 text-center">Pedido no encontrado</div>;

  const pago = (orden as any).pagos?.[0];
  const isAprobado = orden.estado === 'pagado' || pago?.estado === 'aprobado';
  const isPendiente = orden.estado === 'pendiente' || orden.estado === 'reservado' || orden.estado === 'esperando_confirmacion';
  // Solo se puede retomar el pago de una orden 'pendiente' de Mercado Pago
  // (nunca hubo intento de pago → no hay boleto vivo). El backend valida igual.
  const puedeRetomarPago = orden.estado === 'pendiente' && orden.metodo_pago === 'mercadopago';

  const retomarPago = async () => {
    setPagando(true);
    setErrorPago('');
    try {
      const { data } = await api.post(`/pagos/${orden.id}/preferencia-mp`);
      window.location.href = data.init_point;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorPago(e?.response?.data?.message ?? 'No pudimos generar el pago. Probá de nuevo en un rato.');
      setPagando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/mi-cuenta?tab=pedidos')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
        <ArrowLeft size={14} /> Volver a mis pedidos
      </button>

      <div className="flex items-center gap-3">
        <h2 className="text-lg font-medium">Pedido #{orden.id.slice(0, 8).toUpperCase()}</h2>
        <EstadoBadge estado={orden.estado} />
      </div>

      {puedeRetomarPago && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-amber-900">Este pedido está esperando tu pago.</span>
            <button
              onClick={retomarPago}
              disabled={pagando}
              className="bg-[#1D9E75] text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-[#0F6E56] transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {pagando ? 'Redirigiendo…' : 'Pagar ahora'}
            </button>
          </div>
          {errorPago && <span className="text-xs text-red-600">{errorPago}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex flex-col gap-4">
          <OrdenItems orden={orden} />
          <OrdenEnvioResumen orden={orden} />
        </div>
        <div>
          <OrdenTimeline isAprobado={isAprobado} isPendiente={isPendiente} />
        </div>
      </div>
    </div>
  );
}

export default function MiCuenta() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'datos' | 'pedidos'>('datos');
  const queryClient = useQueryClient();

  // Sub-ruta de detalle: /mi-cuenta/pedidos/:id
  if (id) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <BannerVerificacion />
        <DetallePedido id={id} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-medium mb-6">Mi cuenta</h1>

      <BannerVerificacion />

      <div className="flex gap-1 border-b border-gray-100 mb-6">
        <button
          onClick={() => setTab('datos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'datos' ? 'border-[#1D9E75] text-[#0F6E56]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Datos personales
        </button>
        <button
          onClick={() => {
            setTab('pedidos');
            queryClient.invalidateQueries({ queryKey: ['mis-ordenes'] });
          }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'pedidos' ? 'border-[#1D9E75] text-[#0F6E56]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Mis pedidos
        </button>
      </div>

      {tab === 'datos' ? <DatosPersonales /> : <ListaPedidos />}
    </div>
  );
}

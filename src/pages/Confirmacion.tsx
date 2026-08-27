import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, XCircle, Mail } from 'lucide-react';
import api from '../lib/api';
import type { Orden } from '../types';
import { useConfiguracion } from '../hooks/useConfiguracion';
import CheckoutSteps from '../components/ui/CheckoutSteps';
import OrdenItems from '../components/orden/OrdenItems';
import OrdenEnvioResumen from '../components/orden/OrdenEnvioResumen';
import OrdenTimeline from '../components/orden/OrdenTimeline';

function formatFechaAR(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function Confirmacion() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mpStatus = searchParams.get('mp'); // 'success' | 'failure' | 'pending' | null

  const { data: orden, isLoading } = useQuery<Orden>({
    queryKey: ['orden', id],
    queryFn: () => api.get(`/ordenes/${id}`).then((r) => r.data),
    enabled: !!id,
    // Refetch cada 3s mientras el webhook de MP no haya llegado aún
    refetchInterval: (query) => {
      const o = query.state.data as Orden | undefined;
      if (!o) return false;
      const sigue_pendiente = o.estado === 'pendiente' && mpStatus === 'success';
      return sigue_pendiente ? 3000 : false;
    },
  });

  const { data: config } = useConfiguracion();

  if (isLoading) return (
    <div className="flujo-compra flex items-center justify-center min-h-64 text-gray-400 text-sm">
      Cargando...
    </div>
  );

  if (!orden) return (
    <div className="flujo-compra flex items-center justify-center min-h-64 text-gray-400 text-sm">
      Orden no encontrada
    </div>
  );

  const telefonoWhatsapp = (config?.telefono_contacto || '').replace(/\D/g, '');
  const ordenCorta = orden.id.slice(0, 8).toUpperCase();
  const waHref = (mensaje: string) =>
    telefonoWhatsapp ? `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(mensaje)}` : undefined;

  const pago = (orden as any).pagos?.[0];
  const estadoPago = pago?.estado;

  const isAprobado = orden.estado === 'pagado' || estadoPago === 'aprobado';
  // MP devuelve "success" pero el webhook puede demorar — mostrar como pendiente hasta que llegue
  const isMPPending = mpStatus === 'success' && orden.estado === 'pendiente';
  // MP devuelve "pending"/"in_process" (ticket, transferencia, revisión antifraude) — no hay webhook de aprobación en curso, puede tardar días
  const isMPEnRevision = mpStatus === 'pending' && !isAprobado;
  const isPendiente = orden.estado === 'reservado' || orden.estado === 'esperando_confirmacion' || isMPPending || isMPEnRevision;
  const isRechazado = (orden.estado === 'rechazado' || estadoPago === 'rechazado') && mpStatus !== 'success';
  const isMPFailure = mpStatus === 'failure';

  return (
    <div className="flujo-compra max-w-4xl mx-auto px-4 sm:px-6 py-10">

      <CheckoutSteps current={3} variant="success" />

      {/* BANNER MP FAILURE */}
      {isMPFailure && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6 text-center">
          El pago en Mercado Pago no se completó. Tu orden sigue reservada — podés reintentar o elegir otro método.
        </div>
      )}

      {/* BANNER MP PENDING → polling */}
      {isMPPending && (
        <div className="border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/60 mb-6 text-center flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-black/30 border-t-black/70 rounded-full animate-spin" />
          Confirmando pago con Mercado Pago…
        </div>
      )}

      {/* HERO ESTADO */}
      <div className="text-center mb-8">
        {isAprobado && (
          <>
            <div className="w-16 h-16 bg-[#E1F5EE] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-[#1D9E75]" />
            </div>
            <h1 className="text-2xl font-medium mb-2">¡Tu pedido está confirmado!</h1>
            <p className="text-sm text-gray-500">
              Recibiste un email de confirmación. Te avisamos cuando tu pedido esté en camino.
            </p>
          </>
        )}
        {isPendiente && (
          <>
            <div className="w-16 h-16 bg-[#FAEEDA] rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-[#BA7517]" />
            </div>
            {isMPEnRevision ? (
              <>
                <h1 className="text-2xl font-medium mb-2">Tu pago está en revisión</h1>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Mercado Pago está procesando tu pago. Si elegiste efectivo o transferencia, puede tardar hasta 3 días en acreditarse; si fue con tarjeta, la confirmación suele llegar en minutos. Te avisamos por email en cuanto se confirme — no hace falta que hagas nada más.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-medium mb-2">Pedido reservado, esperando pago</h1>
                <p className="text-sm text-gray-500">
                  Tu orden está reservada. Completá el pago para que comencemos a prepararla.
                </p>
              </>
            )}
          </>
        )}
        {isRechazado && (
          <>
            <div className="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-[#E24B4A]" />
            </div>
            <h1 className="text-2xl font-medium mb-2">El pago no pudo procesarse</h1>
            <p className="text-sm text-gray-500">
              No se realizó ningún cobro. Podés intentar con otro método de pago.
            </p>
          </>
        )}
        <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-medium ${isAprobado ? 'bg-[#E1F5EE] text-[#0F6E56]' : isPendiente ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#FCEBEB] text-[#A32D2D]'}`}>
          Orden #{orden.id.slice(0, 8).toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DETALLE */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* ITEMS */}
          <OrdenItems orden={orden} />

          {/* ENVÍO */}
          <OrdenEnvioResumen orden={orden} />

          {/* INSTRUCCIONES PAGO PENDIENTE — TRANSFERENCIA */}
          {isPendiente && pago?.proveedor === 'transferencia' && (
            <div className="bg-[#FAEEDA] border border-[#C8A96E] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[#854F0B] mb-3">Datos para transferencia</h3>
              <div className="flex flex-col gap-2 text-sm text-[#633806]">
                {config?.transferencia_banco && (
                  <div className="flex justify-between"><span>Banco</span><strong>{config.transferencia_banco}</strong></div>
                )}
                {config?.transferencia_titular && (
                  <div className="flex justify-between"><span>Titular</span><strong>{config.transferencia_titular}</strong></div>
                )}
                {config?.transferencia_alias && (
                  <div className="flex justify-between"><span>Alias</span><strong>{config.transferencia_alias}</strong></div>
                )}
                {config?.transferencia_cbu && (
                  <div className="flex justify-between"><span>CBU</span><strong>{config.transferencia_cbu}</strong></div>
                )}
                <div className="flex justify-between"><span>Monto exacto</span><strong>${Number(orden.total).toLocaleString('es-AR')}</strong></div>
              </div>
              {pago?.reserva_vence_en && (
                <div className="mt-3 bg-[#FCEBEB] rounded-lg p-3 text-xs text-[#A32D2D]">
                  ⚠ Tenés hasta el {formatFechaAR(pago.reserva_vence_en)} (hora Argentina) para completar el pago — después se libera el stock reservado.
                </div>
              )}
              {telefonoWhatsapp && (
                <a
                  href={waHref(`¡Hola! Te mando el comprobante de transferencia de mi pedido #${ordenCorta} por $${Number(orden.total).toLocaleString('es-AR')}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#1da851] transition-colors"
                >
                  Enviar comprobante por WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">
          {/* TIMELINE */}
          <OrdenTimeline isAprobado={isAprobado} isPendiente={isPendiente} />

          <div className="flex flex-col gap-2">
            {isRechazado ? (
              <>
                <Link to="/checkout" className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#0F6E56] transition-colors">
                  Reintentar pago
                </Link>
                {telefonoWhatsapp && (
                  <a
                    href={waHref(`¡Hola! Tuve un problema con el pago de mi pedido #${ordenCorta}, ¿me ayudan?`)}
                    target="_blank" rel="noreferrer"
                    className="bg-[#25D366] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#1da851] transition-colors"
                  >
                    WhatsApp
                  </a>
                )}
              </>
            ) : (
              <>
                <Link to="/productos" className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#0F6E56] transition-colors">
                  Seguir comprando
                </Link>
                {telefonoWhatsapp && (
                  <a
                    href={waHref(`¡Hola! Quería consultar sobre mi pedido #${ordenCorta}.`)}
                    target="_blank" rel="noreferrer"
                    className="border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm text-center hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    Consultar por WhatsApp
                  </a>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
            <Mail size={12} className="text-[#1D9E75]" />
            Te enviamos el resumen a tu email
          </div>
        </div>
      </div>
    </div>
  );
}
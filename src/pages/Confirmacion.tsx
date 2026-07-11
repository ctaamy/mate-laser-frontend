import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, XCircle, Truck, Mail } from 'lucide-react';
import api from '../lib/api';
import type { Orden } from '../types';

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

  const pago = (orden as any).pagos?.[0];
  const estadoPago = pago?.estado;

  const isAprobado = orden.estado === 'pagado' || estadoPago === 'aprobado';
  // MP devuelve "success" pero el webhook puede demorar — mostrar como pendiente hasta que llegue
  const isMPPending = mpStatus === 'success' && orden.estado === 'pendiente';
  const isPendiente = orden.estado === 'reservado' || orden.estado === 'esperando_confirmacion' || isMPPending;
  const isRechazado = (orden.estado === 'rechazado' || estadoPago === 'rechazado') && mpStatus !== 'success';
  const isMPFailure = mpStatus === 'failure';

  return (
    <div className="flujo-compra max-w-4xl mx-auto px-6 py-10">

      {/* STEPS */}
      <div className="flex items-center justify-center gap-2 mb-8 text-xs">
        {['Carrito', 'Datos de envío', 'Pago', 'Confirmación'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 3 ? 'text-[#0F6E56] font-medium' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${i <= 3 ? 'bg-[#1D9E75] text-white' : 'border border-gray-200 text-gray-300'}`}>
                ✓
              </div>
              {step}
            </div>
            {i < 3 && <div className="w-8 h-px bg-[#1D9E75]" />}
          </div>
        ))}
      </div>

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
            <h1 className="text-2xl font-medium mb-2">Pedido reservado, esperando pago</h1>
            <p className="text-sm text-gray-500">
              Tu orden está reservada. Completá el pago para que comencemos a prepararla.
            </p>
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

      <div className="grid grid-cols-3 gap-6">
        {/* DETALLE */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* ITEMS */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Productos</h3>
            <div className="flex flex-col gap-3">
              {orden.items_orden?.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E1F5EE] rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                    ☕
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.nombre_producto}</div>
                    <div className="text-xs text-gray-400">
                      {item.color && `Color: ${item.color} · `}
                      {item.texto_grabado && `"${item.texto_grabado}" · `}
                      x{item.cantidad}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    ${Number(item.subtotal).toLocaleString('es-AR')}
                  </div>
                </div>
              ))}
            </div>
            <hr className="border-gray-100 my-4" />
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span>${Number(orden.subtotal).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Envío</span>
                <span>{Number(orden.costo_envio) === 0 ? 'Gratis' : `$${Number(orden.costo_envio).toLocaleString('es-AR')}`}</span>
              </div>
              <div className="flex justify-between font-medium text-base mt-1">
                <span>Total</span>
                <span className="text-[#0F6E56]">${Number(orden.total).toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          {/* INSTRUCCIONES PAGO PENDIENTE */}
          {isPendiente && pago?.proveedor === 'transferencia' && (
            <div className="bg-[#FAEEDA] border border-[#C8A96E] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[#854F0B] mb-3">Datos para transferencia</h3>
              <div className="flex flex-col gap-2 text-sm text-[#633806]">
                <div className="flex justify-between"><span>Banco</span><strong>Banco Galicia</strong></div>
                <div className="flex justify-between"><span>Titular</span><strong>Mate Laser Studio</strong></div>
                <div className="flex justify-between"><span>Alias</span><strong>MATE.LASER.STUDIO</strong></div>
                <div className="flex justify-between"><span>Monto exacto</span><strong>${Number(orden.total).toLocaleString('es-AR')}</strong></div>
              </div>
              {pago?.reserva_vence_en && (
                <div className="mt-3 bg-[#FCEBEB] rounded-lg p-3 text-xs text-[#A32D2D]">
                  ⚠ Reserva válida hasta el {new Date(pago.reserva_vence_en).toLocaleDateString('es-AR')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4">
          {/* TIMELINE */}
          {(isAprobado || isPendiente) && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-sm font-medium mb-4">Estado del pedido</h3>
              <div className="flex flex-col gap-0">
                {[
                  { label: isAprobado ? 'Pedido confirmado' : 'Pedido reservado', done: true },
                  { label: isAprobado ? 'En preparación' : 'Esperando pago', active: true },
                  { label: 'Enviado', done: false },
                  { label: 'Entregado', done: false },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${step.done ? 'bg-[#1D9E75]' : step.active ? 'border-2 border-[#1D9E75] bg-[#E1F5EE]' : 'border-2 border-gray-200 bg-white'}`} />
                      {i < arr.length - 1 && <div className={`w-0.5 flex-1 my-1 ${step.done ? 'bg-[#1D9E75]' : 'bg-gray-200'}`} style={{ minHeight: 16 }} />}
                    </div>
                    <div className="pb-3">
                      <div className={`text-sm ${step.done || step.active ? 'font-medium' : 'text-gray-400'}`}>{step.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isRechazado ? (
              <>
                <Link to="/checkout" className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#0F6E56] transition-colors">
                  Reintentar pago
                </Link>
                <a href="https://wa.me/5491100000000" target="_blank" rel="noreferrer" className="bg-[#25D366] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#1da851] transition-colors">
                  WhatsApp
                </a>
              </>
            ) : (
              <>
                <Link to="/productos" className="bg-[#1D9E75] text-white rounded-lg py-2.5 text-sm font-medium text-center hover:bg-[#0F6E56] transition-colors">
                  Seguir comprando
                </Link>
                <a href="https://wa.me/5491100000000" target="_blank" rel="noreferrer" className="border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm text-center hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  Consultar por WhatsApp
                </a>
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
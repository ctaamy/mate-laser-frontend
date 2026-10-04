import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft, CheckCircle, Info } from 'lucide-react';
import api from '../lib/api';
import { track } from '../lib/analytics';
import { datosParaMedirErrorDelBrick, esTarjetaEnSeccionEquivocada } from '../lib/mpBrickErrors';
import { useConfiguracion } from '../hooks/useConfiguracion';
import { useCarritoStore } from '../store/carrito.store';
import type { Orden } from '../types';
import CheckoutSteps from '../components/ui/CheckoutSteps';

// Estados desde los que todavía tiene sentido mostrar el formulario de pago.
const ESTADOS_PAGABLES = ['pendiente', 'reservado', 'esperando_confirmacion'];

// Tipos del SDK de Mercado Pago
declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale: string }) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: object) => Promise<{ unmount: () => void }>;
      };
    };
    // Device ID que genera el SDK de MP (MercadoPago.js V2) al instanciarse.
    MP_DEVICE_SESSION_ID?: string;
  }
}

export default function Pago() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const limpiar = useCarritoStore(s => s.limpiar);
  const items = useCarritoStore(s => s.items);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const brickWrapperRef = useRef<HTMLDivElement>(null);
  const brickCreatedRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickMounted, setBrickMounted] = useState(false);
  const [error, setError] = useState('');
  // Tarjeta de un tipo que no corresponde a la sección abierta del Brick (p. ej.
  // débito escrita en "Tarjeta de crédito"). Estado propio, NO `error`: ese es
  // fatal. Tampoco va en las deps del efecto de montaje: remontaría el Brick y
  // el usuario perdería lo que tipeó.
  const [tarjetaEquivocada, setTarjetaEquivocada] = useState(false);
  const avisoRef = useRef<HTMLDivElement>(null);

  const { data: orden, isLoading } = useQuery<Orden>({
    queryKey: ['orden-pago', id],
    queryFn: () => api.get(`/ordenes/${id}`).then(r => r.data),
    enabled: !!id,
  });

  // Misma config y misma lógica de link que WhatsAppButton.tsx (telefono_contacto).
  const { data: config } = useConfiguracion();
  const telefonoWa = (config?.telefono_contacto || '').replace(/\D/g, '');
  const numeroPedido = id ? ` #${id.slice(0, 8).toUpperCase()}` : '';
  const hrefWhatsapp = telefonoWa
    ? `https://wa.me/${telefonoWa}?text=${encodeURIComponent(`¡Hola! Tengo un problema para pagar mi pedido${numeroPedido} 🧉`)}`
    : null;

  const esPagable = !!orden && ESTADOS_PAGABLES.includes(orden.estado);
  const yaPago = !!orden && (orden.estado === 'pagado' || orden.pagos?.[0]?.estado === 'aprobado');

  // Cargar SDK de MP
  useEffect(() => {
    if (document.getElementById('mp-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, []);

  // Al pasar al estado de error del aviso: medirlo y llevarlo a la vista. El
  // efecto solo corre en el cambio false → true, así que el scroll es uno por
  // episodio aunque el Brick repita el error. 'nearest' no mueve nada si ya se
  // ve; el foco no se toca (en mobile cerraría el teclado).
  useEffect(() => {
    if (!tarjetaEquivocada) return;
    track('pago_aviso_tarjeta');
    const sinAnimacion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    avisoRef.current?.scrollIntoView({ block: 'nearest', behavior: sinAnimacion ? 'auto' : 'smooth' });
  }, [tarjetaEquivocada]);

  // Montar el Brick cuando SDK y preference estén listos
  useEffect(() => {
    if (!sdkReady || brickCreatedRef.current || !orden || !esPagable) return;
    brickCreatedRef.current = true;

    const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY as string;
    if (!publicKey || publicKey.startsWith('TEST-XXX')) {
      setError('MP_PUBLIC_KEY no configurada. Agregá VITE_MP_PUBLIC_KEY al .env del frontend.');
      return;
    }

    let cancelled = false;
    const containerEl = document.createElement('div');
    containerEl.id = `mp-brick-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    brickWrapperRef.current?.appendChild(containerEl);

    const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' });
    const bricksBuilder = mp.bricks();

    bricksBuilder.create('payment', containerEl.id, {
      initialization: {
        amount: Number(orden.total),
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          // Desde la actualización de MP de marzo 2025 el Brick trata las
          // prepagas como método aparte de crédito — sin esto, esas
          // tarjetas se rechazan con "No pudimos obtener la información
          // de pago" aunque las credenciales estén bien.
          prepaidCard: 'all',
          ticket: 'all',
        },
        visual: {
          style: {
            theme: 'default',
            customVariables: {
              baseColor: '#000000',
              baseColorFirstVariant: '#333333',
              baseColorSecondVariant: '#555555',
            },
          },
        },
      },
      callbacks: {
        onReady: () => {
          setBrickMounted(true);
          setTarjetaEquivocada(false);
        },
        // Número de tarjeta nuevo (llega ~300 ms ANTES que el onError del mismo
        // número): el aviso del número anterior ya no aplica. Se ignora el BIN
        // a propósito — no se guarda ni se mide.
        onBinChange: () => setTarjetaEquivocada(false),
        onError: (err: any) => {
          console.error('Brick error:', err);
          if (err?.type === 'critical') {
            setError('Error en el procesador de pagos.');
          }
          // Corre dentro del store de MP: una excepción nuestra podría cortar su
          // cadena de suscriptores, así que nada de lo que sigue puede tirar.
          try {
            const datos = datosParaMedirErrorDelBrick(err);
            if (datos) track('mp_brick_error', datos);
            if (esTarjetaEnSeccionEquivocada(err)) setTarjetaEquivocada(true);
          } catch {
            /* el aviso y la medición nunca rompen el callback del Brick */
          }
        },
        onSubmit: ({ formData }: { formData: any }) => {
          setTarjetaEquivocada(false);
          // El Brick llama esto cuando el usuario confirma el pago.
          // Device ID: lo genera el SDK de MP de forma asíncrona (por eso se lee
          // ahora y no al montar el Brick). El backend se lo pasa a MP como
          // header X-Meli-Session-Id para su motor antifraude. Es opcional: si
          // el SDK no lo generó, el pago sigue igual.
          const deviceId = window.MP_DEVICE_SESSION_ID;
          return api.post('/pagos/procesar-mp', {
            ...formData,
            external_reference: id,
            ...(typeof deviceId === 'string' && deviceId ? { device_id: deviceId } : {}),
          }).then(res => {
            const { status } = res.data;
            if (status === 'approved') {
              limpiar();
              navigate(`/confirmacion/${id}?mp=success`);
            } else if (status === 'rejected') {
              navigate(`/confirmacion/${id}?mp=failure`);
            } else {
              limpiar();
              navigate(`/confirmacion/${id}?mp=pending`);
            }
          }).catch((err: any) => {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Error desconocido';
            console.error('Error procesando pago:', msg);
            setError(`Error al procesar el pago: ${msg}`);
          });
        },
      },
    }).then(controller => {
      if (cancelled) {
        controller.unmount();
        return;
      }
      brickRef.current = controller;
    });

    return () => {
      cancelled = true;
      brickCreatedRef.current = false;
      brickRef.current?.unmount();
      brickRef.current = null;
      containerEl.remove();
    };
  }, [sdkReady, orden, id, navigate, esPagable]);

  // Orden que ya no admite pago (retomada desde el mail o MiCuenta cuando ya
  // se pagó / se canceló / avanzó): no montamos el Brick, mostramos el estado.
  if (orden && !esPagable) {
    return (
      <div className="flujo-compra max-w-2xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center gap-4 text-center">
        {yaPago ? (
          <>
            <CheckCircle size={36} className="text-[#1D9E75]" />
            <h2 className="text-base font-medium">Este pedido ya está pago</h2>
            <Link to={`/confirmacion/${id}`} className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors">
              Ver mi pedido
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-base font-medium text-black/60">Este pedido ya no se puede pagar</h2>
            <p className="text-sm text-black/40 max-w-sm">
              Puede que se haya cancelado o que ya esté en preparación. Escribinos por WhatsApp si tenés dudas.
            </p>
            <Link to="/" className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors">
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    );
  }

  if (!isLoading && !orden) {
    return (
      <div className="flujo-compra max-w-2xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center gap-4 text-center">
        <h2 className="text-base font-medium text-black/60">No encontramos este pedido</h2>
        <Link to="/" className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-black/80 transition-colors">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flujo-compra max-w-2xl mx-auto px-4 sm:px-6 py-10">

      <CheckoutSteps current={2} />

      {/* VOLVER — "cambiar método" solo tiene sentido si venís del checkout
          (carrito con ítems); retomando desde el mail, el carrito está vacío. */}
      {items.length > 0 ? (
        <button
          onClick={() => navigate('/checkout')}
          className="flex items-center gap-2 text-xs text-black/35 hover:text-black transition-colors mb-6"
        >
          <ArrowLeft size={12} /> Volver y cambiar método de pago
        </button>
      ) : (
        <Link
          to="/"
          className="flex items-center gap-2 text-xs text-black/35 hover:text-black transition-colors mb-6 w-fit"
        >
          <ArrowLeft size={12} /> Volver al inicio
        </Link>
      )}

      {/* RESUMEN ORDEN */}
      {orden && (
        <div className="border border-black/[0.07] p-4 mb-6 flex justify-between items-center text-sm">
          <span className="text-black/40">Total a pagar</span>
          <span className="text-xl font-semibold">${Number(orden.total).toLocaleString('es-AR')}</span>
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-6">
          {error}
        </div>
      )}

      {/* BRICK CONTAINER */}
      {!sdkReady || (!brickMounted && !error) ? (
        <div className="border border-black/[0.07] p-10 text-center">
          <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-black/40">Cargando formulario de pago…</p>
        </div>
      ) : null}

      {/* AVISO DE TARJETA — un solo cartel con dos estados, siempre en el DOM
          para que los lectores de pantalla anuncien el cambio (aria-live).
          Neutro a propósito: el campo del Brick ya se pinta en rojo. Va afuera
          del Brick porque no se puede inyectar texto ni reemplazar su mensaje. */}
      <div ref={avisoRef} data-testid="aviso-tarjeta" role="status" aria-live="polite" className="scroll-mt-20">
        {brickMounted && (tarjetaEquivocada ? (
          <div className="flex items-start gap-2.5 border-l-2 border-black bg-black/[0.04] px-3.5 py-3 mb-4 text-sm text-black/80">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <strong className="font-semibold">Esa tarjeta no va en esta opción.</strong>{' '}
              Elegí “Tarjeta de débito” o “Tarjeta de crédito”, la que corresponda.
            </p>
          </div>
        ) : (
          <p className="flex items-start gap-2 mb-3 text-xs text-black/70">
            <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
            Con tarjeta, elegí si es de crédito o de débito.
          </p>
        ))}
      </div>

      <div ref={brickWrapperRef} />

      <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-black/30">
        <Shield size={11} /> Pago 100% seguro — procesado por Mercado Pago
      </div>

      {hrefWhatsapp && (
        <p className="mt-3 text-center text-xs text-black/60">
          ¿Algo no funciona?{' '}
          <a href={hrefWhatsapp} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black">
            Escribinos por WhatsApp
          </a>
        </p>
      )}
    </div>
  );
}

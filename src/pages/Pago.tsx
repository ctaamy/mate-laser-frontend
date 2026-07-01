import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import type { Orden } from '../types';

// Tipos del SDK de Mercado Pago
declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale: string }) => {
      bricks: () => {
        create: (type: string, containerId: string, settings: object) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

export default function Pago() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const limpiar = useCarritoStore(s => s.limpiar);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickMounted, setBrickMounted] = useState(false);
  const [error, setError] = useState('');


  const { data: orden } = useQuery<Orden>({
    queryKey: ['orden-pago', id],
    queryFn: () => api.get(`/ordenes/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const [preferenceId, setPreferenceId] = useState<string | null>(null);

  // Obtener preference_id del backend
  useEffect(() => {
    if (!id || preferenceId) return;
    api.post(`/pagos/${id}/preferencia-mp`)
      .then(r => setPreferenceId(r.data.preference_id))
      .catch(() => setError('No se pudo iniciar el pago. Intentá de nuevo.'));
  }, [id, preferenceId]);

  // Cargar SDK de MP
  useEffect(() => {
    if (document.getElementById('mp-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, []);

  // Montar el Brick cuando SDK y preference estén listos
  useEffect(() => {
    if (!sdkReady || brickMounted || !orden) return;

    const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY as string;
    if (!publicKey || publicKey.startsWith('TEST-XXX')) {
      setError('MP_PUBLIC_KEY no configurada. Agregá VITE_MP_PUBLIC_KEY al .env del frontend.');
      return;
    }

    const mp = new window.MercadoPago(publicKey, { locale: 'es-AR' });
    const bricksBuilder = mp.bricks();

    bricksBuilder.create('payment', 'mp-brick-container', {
      initialization: {
        amount: Number(orden.total),
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          ticket: 'all',
          bankTransfer: 'all',
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
        onReady: () => setBrickMounted(true),
        onError: (err: any) => {
          console.error('Brick error:', err);
          if (err?.type === 'critical') {
            setError('Error en el procesador de pagos.');
          }
        },
        onSubmit: ({ formData }: { formData: any }) => {
          // El Brick llama esto cuando el usuario confirma el pago
          return api.post('/pagos/procesar-mp', {
            ...formData,
            external_reference: id,
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
      brickRef.current = controller;
    });

    setBrickMounted(true);
    return () => { brickRef.current?.unmount(); };
  }, [sdkReady, preferenceId, brickMounted, orden, id, navigate]);

  const STEPS = ['Carrito', 'Datos de envío', 'Pago', 'Confirmación'];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* STEPS */}
      <div className="flex items-center justify-center gap-2 mb-10 text-xs">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 2 ? 'text-black font-medium' : i < 2 ? 'text-black/40' : 'text-black/20'}`}>
              <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-medium ${
                i === 2 ? 'bg-black text-white'
                : i < 2 ? 'bg-black/10 text-black/50'
                : 'border border-black/15 text-black/20'
              }`}>
                {i < 2 ? '✓' : i + 1}
              </div>
              {step}
            </div>
            {i < 3 && <div className={`w-8 h-px ${i < 2 ? 'bg-black/30' : 'bg-black/10'}`} />}
          </div>
        ))}
      </div>

      {/* VOLVER */}
      <button
        onClick={() => navigate('/checkout')}
        className="flex items-center gap-2 text-xs text-black/35 hover:text-black transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Volver y cambiar método de pago
      </button>

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

      <div id="mp-brick-container" />

      <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-black/30">
        <Shield size={11} /> Pago 100% seguro — procesado por Mercado Pago
      </div>
    </div>
  );
}

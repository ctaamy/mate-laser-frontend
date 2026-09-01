import { useEffect, useRef, useState } from 'react';
import { Mail, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

const COOLDOWN_S = 60;
// Se descarta por sesión (vuelve a aparecer en la próxima), no para siempre:
// la cuenta sigue sin verificar y el aviso no es urgente pero tampoco trivial.
const DISMISS_KEY = 'banner-verificacion-descartado';

/**
 * Aviso "verificá tu email" para el usuario logueado no verificado. Se monta a
 * nivel de página en MiCuenta (visible en ambas tabs). Verificar no bloquea
 * nada, así que el tono es neutro (ámbar, no rojo) y es descartable.
 */
export default function BannerVerificacion() {
  const { usuario } = useAuthStore();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [restante, setRestante] = useState(0);
  const [descartado, setDescartado] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restante <= 0) return;
    timerRef.current = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [restante]);

  if (descartado || !usuario || usuario.email_verificado !== false) return null;

  const reenviar = async () => {
    if (!usuario.email || enviando || restante > 0) return;
    setEnviando(true);
    setError('');
    try {
      await api.post('/auth/enviar-verificacion', { email: usuario.email });
      setEnviado(true);
      setRestante(COOLDOWN_S);
    } catch {
      setError('No pudimos reenviar el mail. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  };

  const descartar = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sessionStorage no disponible — igual lo ocultamos en memoria */
    }
    setDescartado(true);
  };

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 mb-5 flex items-start justify-between gap-3 text-sm">
      <div className="flex items-start gap-2 text-amber-800 min-w-0">
        <Mail size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span>
            Te falta verificar tu email. Así asociamos tus compras anteriores y podés recuperar tu cuenta.
          </span>
          {enviado && restante > 0 && (
            <span className="text-amber-700 text-xs">
              Te reenviamos el mail a <strong>{usuario.email}</strong>. Revisá spam o la pestaña Promociones.
            </span>
          )}
          {error && <span className="text-red-600 text-xs">{error}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          onClick={reenviar}
          disabled={enviando || restante > 0}
          className="text-xs font-medium text-amber-800 underline hover:no-underline disabled:opacity-50 disabled:no-underline"
        >
          {enviando
            ? 'Enviando…'
            : restante > 0
              ? `Reenviar en 0:${String(restante).padStart(2, '0')}`
              : enviado
                ? 'Reenviar'
                : 'Reenviar mail'}
        </button>
        <button onClick={descartar} aria-label="Descartar aviso" className="text-amber-700/60 hover:text-amber-900">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

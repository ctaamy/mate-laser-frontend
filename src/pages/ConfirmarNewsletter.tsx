import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

type Estado = 'verificando' | 'ok' | 'error';

interface CuponBienvenida {
  codigo: string;
  tipo: string;
  valor: number;
  monto_minimo: number | null;
  vence_en: string | null;
}

function condicionesCupon(c: CuponBienvenida): string {
  const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
  const partes = [
    c.tipo === 'porcentaje' ? `${c.valor}% de descuento` : `${money(c.valor)} de descuento`,
    c.monto_minimo ? `en compras desde ${money(c.monto_minimo)}` : null,
    c.vence_en ? `vence el ${new Date(c.vence_en).toLocaleDateString('es-AR', { timeZone: 'UTC' })}` : null,
  ].filter(Boolean);
  return partes.join(' · ');
}

export default function ConfirmarNewsletter() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [cupon, setCupon] = useState<CuponBienvenida | null>(null);
  const [copiado, setCopiado] = useState(false);
  // StrictMode monta dos veces en dev y los escáneres de mail prefetchean el
  // link: evitamos llamar al backend dos veces desde el mismo render.
  const yaLlamado = useRef(false);

  useEffect(() => {
    if (yaLlamado.current) return;
    yaLlamado.current = true;

    if (!token) {
      setEstado('error');
      setMensaje('Este link no es válido. Suscribite de nuevo desde la tienda.');
      return;
    }

    api
      .post('/newsletter/confirmar', { token })
      .then((res) => {
        setEstado('ok');
        setCupon(res.data?.cupon ?? null);
        setMensaje(
          res.data?.estado === 'ya_confirmado'
            ? 'Tu suscripción ya estaba confirmada.'
            : '¡Listo! Ya estás en la comunidad de Mate Laser Studio.',
        );
      })
      .catch((err) => {
        setEstado('error');
        setMensaje(
          err.response?.data?.message ||
            'No pudimos confirmar tu suscripción. El link puede haber vencido o ya haber sido usado.',
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9] px-4">
      <div className="bg-white border border-black/[0.07] p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">
            mate<span className="font-light">laser</span> studio
          </Link>
          <p className="text-xs text-black/40 mt-1.5 uppercase tracking-[0.12em]">Confirmá tu suscripción</p>
        </div>

        {estado === 'verificando' && <p className="text-sm text-black/70">Estamos confirmando tu suscripción…</p>}

        {estado === 'ok' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70">{mensaje}</p>

            {cupon && (
              <div className="border border-black/[0.12] bg-black/[0.02] p-4 flex flex-col gap-2">
                <p className="text-xs text-black/50 uppercase tracking-[0.12em]">Tu cupón de bienvenida</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-base font-bold tracking-[0.08em]">{cupon.codigo}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(cupon.codigo);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2000);
                    }}
                    className="text-xs border border-black/15 px-2 py-1 hover:border-black transition-colors"
                  >
                    {copiado ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
                <p className="text-xs text-black/50">{condicionesCupon(cupon)}. Un solo uso.</p>
                <p className="text-xs text-black/40">Te lo mandamos también por mail así no lo perdés.</p>
              </div>
            )}

            <Link
              to={cupon ? `/productos?cupon=${encodeURIComponent(cupon.codigo)}` : '/productos'}
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors"
            >
              {cupon ? 'Usar mi cupón' : 'Ver productos'}
            </Link>
          </div>
        )}

        {estado === 'error' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-black/70">{mensaje}</p>
            <Link
              to="/"
              className="bg-black text-white py-2.5 text-sm font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors"
            >
              Volver a la tienda
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

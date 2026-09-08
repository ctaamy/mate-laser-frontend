import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, MessageCircle } from 'lucide-react';
import api from '../../lib/api';
import { obtenerProvincias, obtenerLocalidadesPorProvincia, type Provincia, type Localidad } from '../../lib/georef';
import type { MetodoEnvio } from '../../types/index';

// F4 — caja "Envío y retiro" en la PDP. Muestra, calculado igual que el
// checkout (POST /envios/calcular), solo el "Envío Express" (proveedor `oca`,
// 24–72 hs CABA/GBA) y los puntos de retiro. Correo/Andreani NO se muestran
// acá: hoy van con tarifa fija plana y el costo real se ve en el checkout.
//
// Decisiones firmadas con arquitecto / ux-reviewer / cm-marketing:
//  - título neutro "Envío y retiro" (no "Envío Express", que es una opción)
//  - input por provincia+ciudad (Georef), no por CP: no hay dataset CP→partido
//    libre para AR; la ubicación resuelta se persiste para no re-pedirla
//  - fuera de la zona Express → NO decir "no disponible": "llega a todo el
//    país, el costo lo ves en el checkout"
//  - no se renderiza en la línea B2B de cartelería LED (flete a cotizar)

const DESTINO_KEY = 'mls_envio_destino_v1';

// Slugs de categoría donde NO va la calculadora (cartelería LED / B2B: el
// flete se coordina por pedido). Mismo criterio que CATEGORIAS_SIN_RECOMENDADOS
// en ProductosRecomendados — cargar el slug real cuando se confirme.
const CATEGORIAS_SIN_CALCULADORA: string[] = [];

interface Destino {
  provincia: string;
  ciudad: string;
  partido?: string;
}

function leerDestino(): Destino | null {
  try {
    const raw = localStorage.getItem(DESTINO_KEY);
    return raw ? (JSON.parse(raw) as Destino) : null;
  } catch {
    return null;
  }
}

function guardarDestino(d: Destino) {
  try {
    localStorage.setItem(DESTINO_KEY, JSON.stringify(d));
  } catch {
    // no crítico
  }
}

const selectCls = 'border border-black/15 px-3 py-2 text-sm bg-white text-black focus:outline-none focus:border-black/40';

interface Props {
  /** precio unitario final × cantidad — para el cálculo de envío gratis por monto. */
  subtotal: number;
  categoriaSlug?: string;
  /** monto mínimo de envío gratis, o null si no está activo. */
  envioGratisMonto?: number | null;
  /** href de WhatsApp (solo se usa en la variante B2B). */
  whatsappHref?: string;
}

export default function CalculadoraEnvioPDP({ subtotal, categoriaSlug, envioGratisMonto, whatsappHref }: Props) {
  const oculta = !!categoriaSlug && CATEGORIAS_SIN_CALCULADORA.includes(categoriaSlug);

  const [destino, setDestino] = useState<Destino | null>(() => leerDestino());
  const [editando, setEditando] = useState(false);
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [provinciasFallo, setProvinciasFallo] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[] | null>(null);
  const [provSel, setProvSel] = useState('');

  const mostrandoForm = !destino || editando;

  useEffect(() => {
    if (oculta || !mostrandoForm || provincias || provinciasFallo) return;
    obtenerProvincias().then((d) => (d ? setProvincias(d) : setProvinciasFallo(true)));
  }, [oculta, mostrandoForm, provincias, provinciasFallo]);

  useEffect(() => {
    if (!provSel) return;
    let vivo = true;
    obtenerLocalidadesPorProvincia(provSel).then((d) => {
      if (vivo) setLocalidades(d);
    });
    return () => {
      vivo = false;
    };
  }, [provSel]);

  const { data: envios, isFetching } = useQuery<MetodoEnvio[]>({
    queryKey: ['envio-pdp', destino?.partido, subtotal],
    queryFn: () =>
      api
        .post('/envios/calcular', { partido: destino?.partido, localidad: destino?.ciudad, subtotal })
        .then((r) => r.data),
    enabled: !oculta && !!destino?.partido,
    staleTime: 5 * 60 * 1000,
  });

  if (oculta) {
    return (
      <div className="border border-black/[0.07] px-4 py-3.5 text-sm text-black/60 flex items-start gap-3">
        <MessageCircle size={15} className="text-black/30 flex-shrink-0 mt-0.5" />
        <span>
          Para pedidos de cartelería coordinamos el envío o el retiro según el proyecto
          {whatsappHref ? (
            <>
              .{' '}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                Escribinos por WhatsApp
              </a>
            </>
          ) : (
            ' — escribinos por WhatsApp'
          )}
          .
        </span>
      </div>
    );
  }

  const seleccionarCiudad = (nombre: string) => {
    const loc = localidades?.find((l) => l.nombre === nombre);
    const d: Destino = { provincia: provSel, ciudad: nombre, partido: loc?.partido };
    setDestino(d);
    guardarDestino(d);
    setEditando(false);
    setProvSel('');
    setLocalidades(null);
  };

  // Solo Envío Express (cualquier proveedor que no sea retiro/correo/andreani)
  // y retiros. El recomendado va primero entre los retiros.
  const express = envios?.find((e) => !['retiro', 'correo', 'andreani'].includes(e.proveedor) && e.disponible !== false);
  const retiros = (envios ?? [])
    .filter((e) => e.proveedor === 'retiro')
    .sort((a, b) => Number(!!b.recomendado) - Number(!!a.recomendado));

  const faltaParaGratis =
    envioGratisMonto && subtotal < envioGratisMonto ? envioGratisMonto - subtotal : 0;

  return (
    <div className="border border-black/[0.07]" data-testid="calculadora-envio">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.07]">
        <Truck size={14} className="text-black/40" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">Envío y retiro</span>
        {destino && !editando && (
          <button
            onClick={() => setEditando(true)}
            className="ml-auto text-[11px] text-black/40 hover:text-black underline"
          >
            Cambiar
          </button>
        )}
      </div>

      <div className="px-4 py-3.5 flex flex-col gap-2.5 text-sm">
        {!destino && (
          <p className="text-black/60">Enviamos a todo el país y podés retirar gratis en el local.</p>
        )}
        {faltaParaGratis > 0 && (
          <p className="text-xs text-black/50">
            Sumá ${faltaParaGratis.toLocaleString('es-AR')} y tenés envío gratis.
          </p>
        )}

        {mostrandoForm &&
          (provinciasFallo ? (
            <p className="text-xs text-black/50">
              No pudimos cargar las zonas ahora. Vas a ver el costo exacto en el checkout, antes de pagar.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={provSel}
                onChange={(e) => {
                  setProvSel(e.target.value);
                  setLocalidades(null);
                }}
                className={selectCls}
              >
                <option value="">¿A qué provincia?</option>
                {provincias?.map((p) => (
                  <option key={p.id} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {provSel && (
                <select
                  value=""
                  onChange={(e) => e.target.value && seleccionarCiudad(e.target.value)}
                  className={selectCls}
                >
                  <option value="">{localidades ? 'Ciudad / localidad' : 'Cargando…'}</option>
                  {localidades?.map((l) => (
                    <option key={l.id} value={l.nombre}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

        {destino && !editando &&
          (isFetching && !envios ? (
            <p className="text-xs text-black/40">Calculando…</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {express ? (
                <Fila
                  titulo={express.nombre}
                  detalle={express.descripcion}
                  gratis={!!express.envio_gratis || express.costo === 0}
                  monto={express.costo ?? 0}
                  costoOriginal={express.costo_original ?? undefined}
                />
              ) : (
                <p className="text-xs text-black/50">
                  Llega a {destino.ciudad}. El costo del envío a domicilio lo ves en el checkout, antes de pagar.
                </p>
              )}

              {retiros.map((r) => (
                <Fila
                  key={r.id}
                  titulo={r.nombre}
                  detalle={
                    r.ubicacion
                      ? [r.ubicacion.direccion, r.ubicacion.localidad].filter(Boolean).join(', ')
                      : r.descripcion
                  }
                  gratis
                  monto={0}
                  badge={r.recomendado ? 'Más cerca tuyo' : undefined}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function Fila({
  titulo,
  detalle,
  gratis,
  monto,
  costoOriginal,
  badge,
}: {
  titulo: string;
  detalle?: string;
  gratis?: boolean;
  monto: number;
  costoOriginal?: number;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-black">{titulo}</span>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {detalle && <div className="text-xs text-black/40 mt-0.5">{detalle}</div>}
      </div>
      <div className="text-right flex-shrink-0">
        {gratis ? (
          <>
            {costoOriginal ? (
              <div className="text-xs text-black/30 line-through">
                ${Number(costoOriginal).toLocaleString('es-AR')}
              </div>
            ) : null}
            <div className="text-sm font-bold text-black">Gratis</div>
          </>
        ) : (
          <div className="text-sm font-semibold text-black">${monto.toLocaleString('es-AR')}</div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ArrowLeft, CreditCard, Banknote, Building2 } from 'lucide-react';
import api from '../lib/api';
import { useCarritoStore } from '../store/carrito.store';
import { useAuthStore } from '../store/auth.store';
import { obtenerProvincias, obtenerLocalidadesPorProvincia, type Provincia, type Localidad } from '../lib/georef';
import type { MetodoEnvio } from '../types';
import CheckoutSteps from '../components/ui/CheckoutSteps';

const METODOS_PAGO = [
  { id: 'mercadopago', label: 'Mercado Pago', descripcion: 'Tarjeta de crédito, débito, cuotas, QR y más', Icon: CreditCard },
  { id: 'transferencia', label: 'Transferencia bancaria', descripcion: 'Te mostramos los datos bancarios al confirmar el pedido', Icon: Building2 },
  { id: 'efectivo', label: 'Efectivo', descripcion: 'Coordinamos entrega y pago por WhatsApp', Icon: Banknote },
];

const ICONO_ENVIO: Record<string, string> = {
  retiro: '🏠',
  andreani: '📦',
  correo: '✉️',
};

// Teléfono argentino: código de área (2-4 dígitos) + número (6-8 dígitos), con o sin +54 9 / espacios / guiones.
const TELEFONO_AR_REGEX = /^(\+?54)?\s?(9\s?)?(\(?\d{2,4}\)?[\s-]?)\d{6,8}$/;
const CP_AR_REGEX = /^\d{4}$/;
const CALLE_REGEX = /^[a-zA-ZÀ-ÿ0-9°.\s]+\s\d+[a-zA-Z]?$/;
const DNI_AR_REGEX = /^\d{7,8}$/;

// Códigos de error del backend que el checkout necesita distinguir de un error
// genérico (ver http-exception.filter.ts) — no se parsea el texto del mensaje
// porque puede cambiar de wording sin que se note acá.
const ERROR_TARIFA_NO_DISPONIBLE = 'SHIPPING_RATE_UNAVAILABLE';

export default function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, subtotal, limpiar, cupon, aplicarCupon, quitarCupon } = useCarritoStore();
  const { usuario } = useAuthStore();

  const [step, setStep] = useState(2);

  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [apellido, setApellido] = useState(usuario?.apellido || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefono, setTelefono] = useState('');
  const [calle, setCalle] = useState('');
  const [piso, setPiso] = useState('');
  const [cp, setCp] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  // Partido resuelto vía Georef (departamento) a partir de la localidad elegida —
  // determina si "Logística privada" está disponible y a qué precio.
  const [partido, setPartido] = useState<string | undefined>(undefined);
  const [metodoEnvioId, setMetodoEnvioId] = useState<number | null>(null);
  const [recibeComprador, setRecibeComprador] = useState<boolean | null>(null);
  const [quienRecibe, setQuienRecibe] = useState('');
  const [especificaciones, setEspecificaciones] = useState('');
  const [dniReceptor, setDniReceptor] = useState('');
  const [entreCalles, setEntreCalles] = useState('');
  const [metodoPago, setMetodoPago] = useState('mercadopago');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Caso puntual: el backend no pudo revalidar la tarifa en vivo de Andreani/Correo
  // (proveedor caído tras reintentar). Se maneja aparte del banner genérico de
  // `errors.general` porque necesita su propia acción ("volver a elegir método"),
  // no un simple reintento que fallaría de nuevo si el proveedor sigue caído.
  const [errorTarifaEnvio, setErrorTarifaEnvio] = useState<string | null>(null);

  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [provinciasFallback, setProvinciasFallback] = useState(false);
  const [localidades, setLocalidades] = useState<Localidad[] | null>(null);
  const [localidadesLoading, setLocalidadesLoading] = useState(false);
  const [ciudadFallback, setCiudadFallback] = useState(false);

  useEffect(() => {
    obtenerProvincias().then(data => {
      if (data) setProvincias(data);
      else setProvinciasFallback(true);
    });
  }, []);

  useEffect(() => {
    if (!provincia) { setLocalidades(null); return; }
    setLocalidadesLoading(true);
    setCiudadFallback(false);
    obtenerLocalidadesPorProvincia(provincia).then(data => {
      setLocalidadesLoading(false);
      if (data) setLocalidades(data);
      else { setLocalidades(null); setCiudadFallback(true); }
    });
  }, [provincia]);

  const handleSeleccionarCiudad = (nombreCiudad: string) => {
    setCiudad(nombreCiudad);
    const localidad = localidades?.find(l => l.nombre === nombreCiudad);
    setPartido(localidad?.partido);
  };

  const sub = subtotal();

  // Se dispara con Provincia+Ciudad (ya no con el CP, que ahora se pide más
  // abajo en "Dirección de envío"). El partido resuelve si Logística privada
  // está disponible; Correo/Andreani muestran su costo_fijo configurado acá
  // (sin cotización en vivo, porque el CP todavía no existe en este paso).
  const { data: envios } = useQuery<MetodoEnvio[]>({
    queryKey: ['envios', provincia, ciudad, partido, sub],
    queryFn: () => api.post('/envios/calcular', { partido, subtotal: sub }).then(r => r.data),
    enabled: !!provincia && !!ciudad,
  });

  const envioSeleccionado = envios?.find(e => e.id === metodoEnvioId && e.disponible !== false);
  const isRetiro = envioSeleccionado?.proveedor === 'retiro';
  const isPrivada = !!envioSeleccionado && !['retiro', 'andreani', 'correo'].includes(envioSeleccionado.proveedor);
  const costoEnvio = envioSeleccionado?.costo ?? 0;
  const descuento = cupon?.descuento ?? 0;
  const total = Math.max(0, sub + costoEnvio - descuento);

  // Re-chequeo autoritativo del cupón al entrar al checkout: el descuento se
  // guardó en el carrito y pudo quedar viejo (precio/stock cambiaron, cupón
  // venció). Si ya no valida, se quita y se avisa; si el monto cambió, se
  // ajusta en silencio (el usuario todavía no confirmó nada).
  useEffect(() => {
    if (!cupon || items.length === 0) return;
    api.post('/cupones/validar', {
      codigo: cupon.codigo,
      items: items.map(i => ({
        producto_id: i.producto_id,
        precio_unitario: i.precio_unitario,
        cantidad: i.cantidad,
      })),
    })
      .then(({ data }) => {
        if (data.descuento !== cupon.descuento) {
          aplicarCupon({ codigo: data.codigo, cuponId: data.cupon_id, descuento: data.descuento });
        }
      })
      .catch(() => {
        quitarCupon();
        setErrors(prev => ({ ...prev, general: `El cupón ${cupon.codigo} ya no es válido, lo quitamos del pedido.` }));
      });
    // Solo al montar: es un chequeo de entrada, no queremos re-disparar en cada
    // cambio del carrito (que además ya limpia el cupón desde el store).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el método elegido deja de estar disponible (ej. el usuario cambia de
  // localidad después de elegir logística privada), se deselecciona en vez de
  // quedar "elegido" con un método que ya no aplica.
  useEffect(() => {
    if (metodoEnvioId === null || !envios) return;
    const metodo = envios.find(e => e.id === metodoEnvioId);
    if (!metodo || metodo.disponible === false) setMetodoEnvioId(null);
  }, [envios, metodoEnvioId]);

  const inputClass = (field: string) =>
    `border px-3 py-2.5 text-sm focus:outline-none w-full transition-colors bg-white ${
      errors[field]
        ? 'border-red-300 bg-red-50'
        : 'border-black/15 focus:border-black placeholder-black/25'
    }`;

  // Revalida un campo en vivo si ya tenía un error marcado (de un submit previo),
  // para que corregir el valor lo refleje sin esperar al próximo submit.
  const revalidarSiTeniaError = (campo: string, mensaje: string | null) => {
    setErrors(prev => {
      if (!(campo in prev)) return prev;
      const next = { ...prev };
      if (mensaje) next[campo] = mensaje;
      else delete next[campo];
      return next;
    });
  };

  const validarTelefono = (valor: string) =>
    !valor ? 'Requerido' : !TELEFONO_AR_REGEX.test(valor.trim()) ? 'Teléfono inválido (ej: 11 4444-5555)' : null;

  const handleRecibeComprador = (valor: boolean) => {
    setRecibeComprador(valor);
    setQuienRecibe(valor ? `${nombre} ${apellido}`.trim() : '');
  };

  const validateDatos = () => {
    const e: Record<string, string> = {};
    if (!nombre) e.nombre = 'Requerido';
    if (!apellido) e.apellido = 'Requerido';
    if (!email) e.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
    const errorTelefono = validarTelefono(telefono);
    if (errorTelefono) e.telefono = errorTelefono;
    if (metodoEnvioId === null) e.envio = 'Seleccioná un método de envío';
    if (!isRetiro) {
      if (!calle) e.calle = 'Requerido';
      else if (!CALLE_REGEX.test(calle.trim())) e.calle = 'Formato inválido (ej: Av. Corrientes 1234)';
      if (!cp) e.cp = 'Requerido';
      else if (!CP_AR_REGEX.test(cp.trim())) e.cp = 'Código postal inválido (4 dígitos)';
      if (!ciudad) e.ciudad = 'Requerido';
      if (!provincia) e.provincia = 'Requerido';
    }
    if (isPrivada) {
      if (recibeComprador === null) e.recibeComprador = 'Seleccioná una opción';
      if (!quienRecibe) e.quienRecibe = 'Requerido';
      if (!dniReceptor) e.dniReceptor = 'Requerido';
      else if (!DNI_AR_REGEX.test(dniReceptor.trim())) e.dniReceptor = 'DNI inválido (7 u 8 dígitos)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinuar = () => {
    if (validateDatos()) { setErrors({}); setStep(3); }
  };

  // Vuelve al paso de método de envío tras el rechazo por tarifa no verificada:
  // deselecciona el método elegido (ya no se puede confiar en ese precio) y
  // fuerza un refetch de /envios/calcular para traer opciones frescas. El resto
  // de los datos del checkout (contacto, dirección, carrito) queda intacto.
  const handleVolverAElegirEnvio = () => {
    setErrorTarifaEnvio(null);
    setMetodoEnvioId(null);
    setStep(2);
    queryClient.invalidateQueries({ queryKey: ['envios'] });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorTarifaEnvio(null);
    try {
      const direccionEnvio = isRetiro
        ? { tipo: 'retiro' }
        : {
            calle, piso, cp, ciudad, provincia, partido, pais: 'Argentina',
            ...(isPrivada && {
              recibe_comprador: recibeComprador ?? undefined,
              quien_recibe: quienRecibe,
              especificaciones: especificaciones || undefined,
              dni_receptor: dniReceptor,
            }),
            entre_calles: entreCalles || undefined,
          };

      const { data } = await api.post('/ordenes', {
        direccion_envio: direccionEnvio,
        metodo_envio_id: metodoEnvioId,
        metodo_envio_nombre: envioSeleccionado?.nombre,
        subtotal: sub,
        costo_envio: costoEnvio,
        descuento,
        cupon_id: cupon?.cuponId,
        total,
        metodo_pago: metodoPago,
        nombre_cliente: nombre,
        apellido_cliente: apellido,
        email_cliente: email,
        telefono_cliente: telefono,
        items: items.map(item => ({
          producto_id: item.producto_id,
          variante_id: item.variante_id,
          nombre_producto: item.nombre_producto,
          color: item.color,
          texto_grabado: item.texto_grabado,
          precio_unitario: item.precio_unitario,
          cantidad: item.cantidad,
          subtotal: item.precio_unitario * item.cantidad,
          atributos: item.selecciones_configurador
            ? { selecciones_configurador: item.selecciones_configurador }
            : undefined,
          combo_id: item.combo_id,
        })),
      });

      if (metodoPago === 'mercadopago') {
        navigate(`/pago/${data.id}`);
      } else {
        limpiar();
        navigate(`/confirmacion/${data.id}`);
      }
    } catch (err: any) {
      if (err.response?.data?.error_code === ERROR_TARIFA_NO_DISPONIBLE) {
        setErrorTarifaEnvio(err.response.data.message);
      } else {
        setErrors({ general: err.response?.data?.message || 'Error al procesar la orden' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flujo-compra max-w-5xl mx-auto px-4 sm:px-6 py-10">

      <CheckoutSteps current={step === 3 ? 2 : 1} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-5">

          {errorTarifaEnvio ? (
            <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex flex-col gap-2.5">
              <span>{errorTarifaEnvio}</span>
              <button
                onClick={handleVolverAElegirEnvio}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-amber-300 hover:border-amber-500 hover:bg-amber-100 transition-colors text-amber-900"
              >
                <ArrowLeft size={12} /> Elegir otro método de envío
              </button>
            </div>
          ) : errors.general && (
            <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errors.general}
            </div>
          )}

          {/* ── PASO 2: DATOS + ENVÍO ── */}
          {step === 2 && (
            <>
              {/* Datos personales */}
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Datos personales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Nombre *</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass('nombre')} placeholder="María" />
                    {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Apellido *</label>
                    <input value={apellido} onChange={e => setApellido(e.target.value)} className={inputClass('apellido')} placeholder="González" />
                    {errors.apellido && <p className="text-xs text-red-500 mt-1">{errors.apellido}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Email *</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} className={inputClass('email')} placeholder="tu@email.com" type="email" />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Teléfono *</label>
                    <input
                      value={telefono}
                      onChange={e => {
                        setTelefono(e.target.value);
                        revalidarSiTeniaError('telefono', validarTelefono(e.target.value));
                      }}
                      className={inputClass('telefono')}
                      placeholder="+54 11 XXXX-XXXX"
                    />
                    {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
                  </div>
                </div>
              </div>

              {/* Método de envío */}
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Método de envío</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label htmlFor="metodo-envio-provincia" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Provincia *</label>
                    {provinciasFallback || !provincias ? (
                      <input
                        id="metodo-envio-provincia"
                        value={provincia}
                        onChange={e => { setProvincia(e.target.value); setCiudad(''); setPartido(undefined); }}
                        className={inputClass('provincia')}
                        placeholder="Buenos Aires"
                      />
                    ) : (
                      <select
                        id="metodo-envio-provincia"
                        value={provincia}
                        onChange={e => { setProvincia(e.target.value); setCiudad(''); setPartido(undefined); }}
                        className={inputClass('provincia')}
                      >
                        <option value="">Seleccioná</option>
                        {provincias.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                      </select>
                    )}
                    {errors.provincia && <p className="text-xs text-red-500 mt-1">{errors.provincia}</p>}
                  </div>
                  <div>
                    <label htmlFor="metodo-envio-ciudad" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Ciudad / Localidad *</label>
                    {ciudadFallback || !provincia || !localidades ? (
                      <input
                        id="metodo-envio-ciudad"
                        value={ciudad}
                        onChange={e => handleSeleccionarCiudad(e.target.value)}
                        className={inputClass('ciudad')}
                        placeholder={localidadesLoading ? 'Cargando…' : 'Buenos Aires'}
                        disabled={localidadesLoading}
                      />
                    ) : (
                      <select id="metodo-envio-ciudad" value={ciudad} onChange={e => handleSeleccionarCiudad(e.target.value)} className={inputClass('ciudad')}>
                        <option value="">Seleccioná</option>
                        {localidades.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
                      </select>
                    )}
                    {errors.ciudad && <p className="text-xs text-red-500 mt-1">{errors.ciudad}</p>}
                  </div>
                </div>

                {!envios && !(provincia && ciudad) && (
                  <p className="text-sm text-black/30 py-2">Elegí tu provincia y ciudad para ver las opciones disponibles.</p>
                )}
                {!envios && provincia && ciudad && (
                  <div className="text-sm text-black/30 py-4 text-center">Cargando opciones…</div>
                )}
                {envios?.length === 0 && (
                  <div className="text-sm text-black/30 py-4 text-center">No hay métodos disponibles para tu zona.</div>
                )}
                {envios && envios.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {envios.map((envio) => {
                      const disponible = envio.disponible !== false;
                      const activo = disponible && metodoEnvioId === envio.id;
                      const icono = ICONO_ENVIO[envio.proveedor] ?? '🚚';
                      return (
                        <div
                          key={envio.id}
                          onClick={() => disponible && setMetodoEnvioId(envio.id)}
                          className={`flex items-center gap-3 border px-4 py-3.5 transition-colors ${
                            !disponible
                              ? 'opacity-50 cursor-not-allowed border-black/[0.07]'
                              : activo
                                ? 'border-black bg-black/[0.02] cursor-pointer'
                                : 'border-black/[0.07] hover:border-black/20 cursor-pointer'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? 'border-black' : 'border-black/20'}`}>
                            {activo && <div className="w-2 h-2 bg-black rounded-full" />}
                          </div>
                          <span className="text-base flex-shrink-0">{icono}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-black">{envio.nombre}</div>
                            <div className="text-xs text-black/40 mt-0.5">
                              {disponible ? envio.descripcion : 'No disponible para la localidad elegida'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {!disponible ? null : (envio as any).envio_gratis && envio.proveedor !== 'retiro' ? (
                              <div>
                                <div className="text-xs text-black/30 line-through">${Number((envio as any).costo_original || 0).toLocaleString('es-AR')}</div>
                                <div className="text-sm font-bold text-black">Gratis</div>
                              </div>
                            ) : envio.costo === 0 ? (
                              <div className="text-sm font-bold text-black">Gratis</div>
                            ) : (
                              <div className="text-sm font-semibold text-black">${(envio.costo ?? 0).toLocaleString('es-AR')}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {errors.envio && <p className="text-xs text-red-500 mt-2">{errors.envio}</p>}

                {isRetiro && (
                  <div className="mt-3 border border-black/[0.07] bg-black/[0.02] px-4 py-3 text-xs text-black/60">
                    📍 Te contactaremos por WhatsApp para coordinar el retiro.
                  </div>
                )}
              </div>

              {/* Dirección (oculta si es retiro) */}
              {!isRetiro && (
                <div className="border border-black/[0.07] p-5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Dirección de envío</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Calle y número *</label>
                      <input value={calle} onChange={e => setCalle(e.target.value)} className={inputClass('calle')} placeholder="Av. Corrientes 1234" />
                      {errors.calle && <p className="text-xs text-red-500 mt-1">{errors.calle}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Código postal *</label>
                      <input value={cp} onChange={e => setCp(e.target.value)} className={inputClass('cp')} placeholder="1043" />
                      {errors.cp && <p className="text-xs text-red-500 mt-1">{errors.cp}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Piso / Depto</label>
                      <input value={piso} onChange={e => setPiso(e.target.value)} className={inputClass('piso')} placeholder="3° B" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Provincia</label>
                      <input value={provincia} disabled className={`${inputClass('provincia')} disabled:opacity-60 disabled:cursor-not-allowed`} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Ciudad / Localidad</label>
                      <input value={ciudad} disabled className={`${inputClass('ciudad')} disabled:opacity-60 disabled:cursor-not-allowed`} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Entre calles</label>
                      <input
                        value={entreCalles}
                        onChange={e => setEntreCalles(e.target.value)}
                        className={inputClass('entreCalles')}
                        placeholder="Entre Rivadavia y Mitre"
                      />
                    </div>

                    {/* Campos extra para logística privada */}
                    {isPrivada && (
                      <>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">¿Recibís vos el pedido? *</label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleRecibeComprador(true)}
                              className={`flex-1 min-w-[140px] border px-3 py-2 text-xs font-medium transition-colors ${
                                recibeComprador === true
                                  ? 'border-black bg-black text-white'
                                  : 'border-black/15 text-black/50 hover:border-black/40'
                              }`}
                            >
                              Sí, soy yo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecibeComprador(false)}
                              className={`flex-1 min-w-[140px] border px-3 py-2 text-xs font-medium transition-colors ${
                                recibeComprador === false
                                  ? 'border-black bg-black text-white'
                                  : 'border-black/15 text-black/50 hover:border-black/40'
                              }`}
                            >
                              No, otra persona
                            </button>
                          </div>
                          {errors.recibeComprador && <p className="text-xs text-red-500 mt-1">{errors.recibeComprador}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Nombre de quien recibe *</label>
                          <input
                            value={quienRecibe}
                            onChange={e => setQuienRecibe(e.target.value)}
                            className={`${inputClass('quienRecibe')} truncate`}
                            placeholder="Nombre completo de quien recibe el paquete"
                            disabled={recibeComprador === true}
                            title={recibeComprador === true ? quienRecibe : undefined}
                          />
                          {errors.quienRecibe && <p className="text-xs text-red-500 mt-1">{errors.quienRecibe}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">DNI de quien recibe *</label>
                          <input
                            value={dniReceptor}
                            onChange={e => setDniReceptor(e.target.value)}
                            className={inputClass('dniReceptor')}
                            placeholder="30123456"
                          />
                          {errors.dniReceptor && <p className="text-xs text-red-500 mt-1">{errors.dniReceptor}</p>}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-1.5 block">Especificaciones de entrega</label>
                          <textarea
                            value={especificaciones}
                            onChange={e => setEspecificaciones(e.target.value)}
                            className={`${inputClass('especificaciones')} resize-none`}
                            rows={3}
                            placeholder="Ej: no tiene timbre, llamar al portero, dejar con el vecino del 2B…"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/carrito')}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium border border-black/15 hover:border-black/40 transition-colors text-black/60"
                >
                  <ArrowLeft size={13} /> Volver al carrito
                </button>
                <button
                  onClick={handleContinuar}
                  className="flex-1 bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors"
                >
                  Continuar al pago →
                </button>
              </div>
            </>
          )}

          {/* ── PASO 3: PAGO ── */}
          {step === 3 && (
            <>
              <div className="border border-black/[0.07] p-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Método de pago</h3>
                <div className="flex flex-col gap-2">
                  {METODOS_PAGO.map(({ id, label, descripcion, Icon }) => {
                    const activo = metodoPago === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setMetodoPago(id)}
                        className={`flex items-center gap-4 border px-4 py-4 cursor-pointer transition-colors ${
                          activo ? 'border-black bg-black/[0.02]' : 'border-black/[0.07] hover:border-black/20'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? 'border-black' : 'border-black/20'}`}>
                          {activo && <div className="w-2 h-2 bg-black rounded-full" />}
                        </div>
                        <Icon size={16} className={activo ? 'text-black' : 'text-black/30'} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-black">{label}</div>
                          <div className="text-xs text-black/40 mt-0.5">{descripcion}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {metodoPago === 'mercadopago' && (
                  <div className="mt-4 bg-black/[0.02] border border-black/[0.06] px-4 py-3 text-sm text-black/50">
                    Al confirmar se abre el formulario de pago de <strong className="text-black/70">Mercado Pago</strong> directamente en esta página. Podés pagar con tarjeta de crédito, débito o en cuotas.
                  </div>
                )}
                {metodoPago === 'transferencia' && (
                  <div className="mt-4 bg-black/[0.02] border border-black/[0.06] px-4 py-3 text-sm text-black/50">
                    Al confirmar te mostramos los <strong className="text-black/70">datos bancarios</strong> en la pantalla de confirmación. Tu pedido queda reservado por <strong>3 días</strong> mientras realizás la transferencia.
                  </div>
                )}
                {metodoPago === 'efectivo' && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    Al confirmar te contactamos por <strong>WhatsApp</strong> para coordinar la entrega y el pago. El pedido queda reservado por <strong>3 días hábiles</strong>.
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(2); setErrors({}); setErrorTarifaEnvio(null); }}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium border border-black/15 hover:border-black/40 transition-colors text-black/60"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-black text-white py-3 text-sm font-semibold tracking-[0.04em] hover:bg-black/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Shield size={13} />
                  {loading ? 'Procesando...' : 'Confirmar y pagar'}
                </button>
              </div>
            </>
          )}

        </div>

        {/* RESUMEN */}
        <div className="flex flex-col gap-4">
          <div className="border border-black/[0.07] p-5 sticky top-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Resumen</h3>
            <div className="flex flex-col gap-3 mb-4">
              {items.map((item) => (
                <div key={item.producto_id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/[0.04] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imagen_url
                      ? <img src={item.imagen_url} alt="" className="w-full h-full object-cover" />
                      : <span className="opacity-20 text-lg">☕</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-black truncate">{item.nombre_producto}</div>
                    {item.variante_descripcion && <div className="text-[10px] text-black/40 truncate">{item.variante_descripcion}</div>}
                    {item.texto_grabado && <div className="text-xs text-black/40 truncate italic">"{item.texto_grabado}"</div>}
                    <div className="text-[10px] text-black/30">x{item.cantidad}</div>
                  </div>
                  <div className="text-xs font-semibold text-black">${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</div>
                </div>
              ))}
            </div>
            <div className="h-px bg-black/[0.07] mb-3" />
            <div className="flex flex-col gap-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-black/40">Subtotal</span>
                <span>${sub.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/40">Envío</span>
                <span className={metodoEnvioId !== null ? 'font-medium text-black' : 'text-black/30 text-xs'}>
                  {metodoEnvioId === null
                    ? 'A calcular'
                    : costoEnvio === 0 ? 'Gratis'
                    : `$${costoEnvio.toLocaleString('es-AR')}`}
                </span>
              </div>
              {descuento > 0 && cupon && (
                <div className="flex justify-between text-black">
                  <span className="text-black/40">Descuento ({cupon.codigo})</span>
                  <span className="font-medium">−${descuento.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
            <div className="h-px bg-black/[0.07] mb-3" />
            <div className="flex justify-between font-semibold text-black">
              <span>Total</span>
              <span className="text-lg">${total.toLocaleString('es-AR')}</span>
            </div>

            {/* Repaso de envío — visible en el paso de pago para que el usuario pueda revisar antes de confirmar */}
            {step === 3 && metodoEnvioId !== null && (
              <>
                <div className="h-px bg-black/[0.07] my-3" />
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-2">Envío a</div>
                <div className="text-xs text-black/60 flex flex-col gap-0.5">
                  <div>{nombre} {apellido} · {telefono}</div>
                  {isRetiro ? (
                    <div>Retiro en local</div>
                  ) : (
                    <>
                      <div>{calle}{piso && `, ${piso}`}</div>
                      <div>{ciudad}, {provincia} (CP {cp})</div>
                      {isPrivada && (
                        <div>Recibe: {quienRecibe}{recibeComprador === false && ' (tercero)'} · DNI {dniReceptor}</div>
                      )}
                      {entreCalles && <div>Entre calles: {entreCalles}</div>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

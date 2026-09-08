import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plug, PlugZap, ChevronDown, ChevronUp, Plus, MapPin } from 'lucide-react';
import api from '../../lib/api';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminCard from '../../components/admin/ui/AdminCard';
import { AdminInput, AdminLabel, AdminSelect } from '../../components/admin/ui/AdminInput';

interface UbicacionRetiro {
  direccion: string;
  localidad: string;
  partido: string;
  horarios?: string;
  google_maps_url?: string;
  lat?: number;
  lng?: number;
}

interface MetodoEnvio {
  id: number;
  nombre: string;
  proveedor: string;
  descripcion: string;
  costo_fijo: number;
  activo: boolean;
  api_conectada: boolean;
  orden: number;
  ubicacion?: UbicacionRetiro | null;
}

// Espeja PROVEEDORES_ENVIO del backend (create-metodo-envio.dto.ts). El
// backend valida contra esta lista blanca — un valor fuera de acá da 400.
const PROVEEDORES: { value: string; label: string }[] = [
  { value: 'retiro', label: 'Retiro en un local' },
  { value: 'oca', label: 'Logística privada (precio por zona)' },
  { value: 'correo', label: 'Correo Argentino' },
  { value: 'andreani', label: 'Andreani' },
];

const USA_COSTO_FIJO = (proveedor: string) => proveedor === 'correo' || proveedor === 'andreani';

// Mensaje de error del backend (axios), con fallback.
const msgError = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

interface PrecioZona {
  id: number;
  zona: string;
  precio: number;
  activo: boolean;
}

const ZONA_LABEL: Record<string, string> = {
  CABA: 'CABA',
  GBA_1: 'GBA 1',
  GBA_2: 'GBA 2',
  GBA_3: 'GBA 3',
};

const PROVEEDOR_INFO: Record<string, {
  icono: string;
  descripcionApi?: string;
  campos?: { key: string; label: string; placeholder: string; type?: string; ayuda?: string }[];
}> = {
  andreani: {
    icono: '📦',
    descripcionApi: 'Cotización en tiempo real y generación de órdenes de envío vía API de Andreani Empresas.',
    campos: [
      { key: 'contrato', label: 'Número de contrato', placeholder: 'Ej: 12345', ayuda: 'Lo obtés en tu cuenta de Andreani Empresas' },
      { key: 'usuario', label: 'Usuario', placeholder: 'usuario@empresa.com' },
      { key: 'password', label: 'Contraseña', placeholder: '••••••••', type: 'password' },
      { key: 'sender_nombre', label: 'Nombre del remitente', placeholder: 'Mate Laser Studio', ayuda: 'Aparece en la etiqueta de envío' },
      { key: 'sender_email', label: 'Email del remitente', placeholder: 'envios@tutienda.com' },
      { key: 'sender_telefono', label: 'Teléfono del remitente', placeholder: 'Ej: 1122334455' },
      { key: 'sender_calle', label: 'Calle (remitente)', placeholder: 'Av. Corrientes' },
      { key: 'sender_numero', label: 'Número (remitente)', placeholder: '1234' },
      { key: 'sender_ciudad', label: 'Ciudad (remitente)', placeholder: 'CABA' },
      { key: 'sender_cp', label: 'CP origen (tu local)', placeholder: 'Ej: 1043', ayuda: 'Código postal desde donde despachás' },
    ],
  },
  correo: {
    icono: '✉️',
    descripcionApi: 'API PaqAr v2 — generación de órdenes, etiquetas y seguimiento en tiempo real. Requiere acuerdo comercial con Correo Argentino.',
    campos: [
      { key: 'agreement', label: 'ID de acuerdo (agreement)', placeholder: 'Ej: 18017', ayuda: 'Código de acuerdo comercial que te da el área Comercial de Correo Argentino' },
      { key: 'api_key', label: 'API Key', placeholder: 'Tu API Key de PaqAr', type: 'password', ayuda: 'Gestionado junto al agreement. Para testing usá "test_..." y apuntará a apitest.correoargentino.com.ar' },
      { key: 'service_type', label: 'Tipo de servicio', placeholder: 'Ej: CP', ayuda: 'CP = Puerta a puerta. Consultá con Correo cuál aplica a tu acuerdo.' },
      { key: 'sender_zip', label: 'CP origen (tu local)', placeholder: 'Ej: 1043', ayuda: 'Código postal desde donde despachás' },
    ],
  },
  oca: { icono: '🚚' },
  retiro: { icono: '🏠' },
};

// Toggle compartido de esta pantalla (no está en components/admin/ui — es un
// switch simple sin label propio, se usa suelto al lado de otros elementos).
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}

// Campos de la ubicación de un punto de retiro. Se reusa en el alta de método
// (AgregarMetodoCard) y en la edición de una fila de retiro (MetodoCard).
function UbicacionRetiroFields({
  value,
  onChange,
}: {
  value: Partial<UbicacionRetiro>;
  onChange: (u: Partial<UbicacionRetiro>) => void;
}) {
  const set = (k: keyof UbicacionRetiro, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <AdminLabel>Dirección *</AdminLabel>
        <AdminInput value={value.direccion ?? ''} onChange={e => set('direccion', e.target.value)} placeholder="Ej: Larrea 324" />
      </div>
      <div>
        <AdminLabel>Localidad / barrio *</AdminLabel>
        <AdminInput value={value.localidad ?? ''} onChange={e => set('localidad', e.target.value)} placeholder="Ej: Once" />
      </div>
      <div>
        <AdminLabel>Partido *</AdminLabel>
        <AdminInput value={value.partido ?? ''} onChange={e => set('partido', e.target.value)} placeholder="Ej: CABA" />
        <p className="text-[10px] text-[var(--ink-soft)] mt-1">
          Tal cual figura en el checkout (partido/departamento). Para Capital: CABA. Sirve para recomendar este local al comprador que está cerca.
        </p>
      </div>
      <div className="col-span-2">
        <AdminLabel>Horario de atención</AdminLabel>
        <AdminInput value={value.horarios ?? ''} onChange={e => set('horarios', e.target.value)} placeholder="Ej: Lun a Vie de 9 a 18 h" />
      </div>
      <div className="col-span-2">
        <AdminLabel>Link de Google Maps (opcional)</AdminLabel>
        <AdminInput value={value.google_maps_url ?? ''} onChange={e => set('google_maps_url', e.target.value)} placeholder="https://maps.app.goo.gl/..." />
      </div>
    </div>
  );
}

// direccion + localidad + partido son los 3 campos que el backend exige para
// activar un punto de retiro.
const ubicacionCompleta = (u: Partial<UbicacionRetiro>) =>
  !!u.direccion?.trim() && !!u.localidad?.trim() && !!u.partido?.trim();

// Deja solo los campos con valor, con las claves que espera el backend.
function ubicacionPayload(u: Partial<UbicacionRetiro>) {
  return {
    direccion: u.direccion?.trim() ?? '',
    localidad: u.localidad?.trim() ?? '',
    partido: u.partido?.trim() ?? '',
    ...(u.horarios?.trim() && { horarios: u.horarios.trim() }),
    ...(u.google_maps_url?.trim() && { google_maps_url: u.google_maps_url.trim() }),
  };
}

function MetodoCard({ metodo }: { metodo: MetodoEnvio }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: metodo.nombre,
    descripcion: metodo.descripcion || '',
    costo_fijo: String(metodo.costo_fijo),
    activo: metodo.activo,
  });
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [showApi, setShowApi] = useState(false);
  const [saved, setSaved] = useState(false);

  const info = PROVEEDOR_INFO[metodo.proveedor] ?? { icono: '🚚' };

  const updateMut = useMutation({
    mutationFn: () => api.put(`/envios/${metodo.id}`, {
      nombre: form.nombre,
      descripcion: form.descripcion,
      costo_fijo: parseFloat(form.costo_fijo) || 0,
      activo: form.activo,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['envios-admin'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const conectarMut = useMutation({
    mutationFn: () => api.post(`/envios/${metodo.id}/credenciales`, creds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['envios-admin'] });
      setShowApi(false);
      setCreds({});
    },
  });

  const desconectarMut = useMutation({
    mutationFn: () => api.delete(`/envios/${metodo.id}/credenciales`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['envios-admin'] }),
  });

  // ── Ubicación (solo filas de retiro) ──
  const esRetiro = metodo.proveedor === 'retiro';
  const [showUbic, setShowUbic] = useState(false);
  const [ubic, setUbic] = useState<Partial<UbicacionRetiro>>(metodo.ubicacion ?? {});
  const [ubicError, setUbicError] = useState<string | null>(null);
  const [ubicSaved, setUbicSaved] = useState(false);
  const guardarUbicacionMut = useMutation({
    mutationFn: () => api.put(`/envios/${metodo.id}`, { ubicacion: ubicacionPayload(ubic) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['envios-admin'] });
      setUbicError(null);
      setUbicSaved(true);
      setTimeout(() => setUbicSaved(false), 2000);
    },
    onError: (e: unknown) => setUbicError(msgError(e, 'No se pudo guardar la ubicación.')),
  });

  const [verificando, setVerificando] = useState(false);
  const [verificacionResult, setVerificacionResult] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const verificarConexion = async () => {
    setVerificando(true);
    setVerificacionResult(null);
    const ruta = metodo.proveedor === 'correo'
      ? `/envios/${metodo.id}/correo/validar`
      : `/envios/${metodo.id}/andreani/validar`;
    try {
      const r = await api.get(ruta);
      setVerificacionResult(r.data);
    } catch {
      setVerificacionResult({ ok: false, mensaje: 'Error de conexión' });
    } finally {
      setVerificando(false);
    }
  };

  return (
    <AdminCard padded={false} className={!form.activo ? 'opacity-60' : ''}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--line)]">
        <span className="text-xl">{info.icono}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-[var(--ink)]">{metodo.nombre}</div>
          <div className="text-[11px] text-[var(--ink-soft)] uppercase tracking-[0.1em]">{metodo.proveedor}</div>
        </div>
        <div className="flex items-center gap-3">
          {esRetiro && !metodo.ubicacion && (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--error)] bg-[var(--error-soft)] px-2 py-1 rounded">
              Sin ubicación
            </span>
          )}
          {metodo.api_conectada && (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink)] bg-[var(--n-100)] px-2 py-1 rounded">
              <PlugZap size={10} /> API activa
            </span>
          )}
          <Toggle on={form.activo} onClick={() => setForm(f => ({ ...f, activo: !f.activo }))} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <AdminLabel>Nombre visible</AdminLabel>
            <AdminInput value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <AdminLabel>
              Costo fijo ($) {metodo.proveedor === 'retiro' ? '— siempre gratis' : metodo.proveedor === 'oca' ? '— usa precio por zona, ver abajo' : info.campos ? '— fallback si API falla' : ''}
            </AdminLabel>
            <AdminInput
              type="number"
              value={form.costo_fijo}
              onChange={e => setForm(f => ({ ...f, costo_fijo: e.target.value }))}
              disabled={metodo.proveedor === 'retiro' || metodo.proveedor === 'oca'}
            />
          </div>
          <div className="col-span-2">
            <AdminLabel>Descripción</AdminLabel>
            <AdminInput
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Entrega en domicilio en 3–5 días hábiles"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <AdminButton variant="primary" icon={<Save size={12} />} disabled={updateMut.isPending} onClick={() => updateMut.mutate()}>
            {saved ? '¡Guardado!' : updateMut.isPending ? 'Guardando...' : 'Guardar cambios'}
          </AdminButton>

          {/* API section toggle — solo para andreani y correo */}
          {info.campos && (
            <button
              onClick={() => setShowApi(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <Plug size={12} />
              {metodo.api_conectada ? 'Gestionar API' : 'Conectar API'}
              {showApi ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* Ubicación — solo para filas de retiro */}
          {esRetiro && (
            <button
              onClick={() => setShowUbic(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <MapPin size={12} />
              {metodo.ubicacion ? 'Editar ubicación' : 'Agregar ubicación'}
              {showUbic ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Panel de credenciales API */}
        <AnimatePresence initial={false}>
        {showApi && info.campos && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
          <div className="border border-[var(--line)] bg-[var(--n-50)] rounded-[var(--radius-el)] p-4 flex flex-col gap-3">
            {info.descripcionApi && (
              <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">{info.descripcionApi}</p>
            )}
            <p className="text-[11px] text-[var(--ink-soft)]">
              {metodo.api_conectada
                ? 'API activa. Para actualizar las credenciales ingresalas de nuevo.'
                : 'Sin credenciales se usa el costo fijo como precio de envío.'}
            </p>
            {info.campos.map(campo => (
              <div key={campo.key}>
                <AdminLabel>{campo.label}</AdminLabel>
                <AdminInput
                  type={campo.type ?? 'text'}
                  value={creds[campo.key] ?? ''}
                  onChange={e => setCreds(c => ({ ...c, [campo.key]: e.target.value }))}
                  placeholder={campo.placeholder}
                />
                {campo.ayuda && <p className="text-[10px] text-[var(--ink-soft)] mt-1">{campo.ayuda}</p>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 mt-1">
              <AdminButton variant="primary" size="sm" icon={<PlugZap size={11} />} disabled={conectarMut.isPending} onClick={() => conectarMut.mutate()}>
                {conectarMut.isPending ? 'Guardando...' : 'Guardar credenciales'}
              </AdminButton>
              {metodo.api_conectada && (metodo.proveedor === 'correo' || metodo.proveedor === 'andreani') && (
                <AdminButton variant="secondary" size="sm" disabled={verificando} onClick={verificarConexion}>
                  {verificando ? 'Verificando...' : 'Verificar conexión'}
                </AdminButton>
              )}
              {metodo.api_conectada && (
                <AdminButton
                  variant="danger" size="sm"
                  disabled={desconectarMut.isPending}
                  onClick={() => {
                    if (confirm(`¿Desconectar la API de ${metodo.nombre}? El cálculo de envío en tiempo real deja de funcionar y se usa el costo fijo configurado.`)) desconectarMut.mutate();
                  }}
                >
                  Desconectar
                </AdminButton>
              )}
            </div>
            {verificacionResult && (
              <div className={`text-xs px-3 py-2 border rounded-[var(--radius-el)] ${verificacionResult.ok ? 'border-[var(--line)] bg-[var(--n-50)] text-[var(--ink-soft)]' : 'border-[var(--error)]/30 bg-[var(--error-soft)] text-[var(--error)]'}`}>
                {verificacionResult.ok ? '✓ ' : '✗ '}{verificacionResult.mensaje}
              </div>
            )}
          </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Panel de ubicación — filas de retiro */}
        <AnimatePresence initial={false}>
        {showUbic && esRetiro && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
          <div className="border border-[var(--line)] bg-[var(--n-50)] rounded-[var(--radius-el)] p-4 flex flex-col gap-3">
            <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
              Se muestra en el checkout y en el mail "listo para retirar" para que el cliente sepa a qué local ir. Un punto de retiro activo necesita dirección, localidad y partido.
            </p>
            <UbicacionRetiroFields value={ubic} onChange={setUbic} />
            <div className="flex items-center gap-2 mt-1">
              <AdminButton
                variant="primary" size="sm" icon={<Save size={11} />}
                disabled={guardarUbicacionMut.isPending || !ubicacionCompleta(ubic)}
                onClick={() => guardarUbicacionMut.mutate()}
              >
                {ubicSaved ? '¡Guardado!' : guardarUbicacionMut.isPending ? 'Guardando...' : 'Guardar ubicación'}
              </AdminButton>
            </div>
            {ubicError && (
              <div className="text-xs px-3 py-2 border border-[var(--error)]/30 bg-[var(--error-soft)] text-[var(--error)] rounded-[var(--radius-el)]">
                {ubicError}
              </div>
            )}
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </AdminCard>
  );
}

function PrecioZonaRow({ zona }: { zona: PrecioZona }) {
  const qc = useQueryClient();
  const [precio, setPrecio] = useState(String(zona.precio));
  const [activo, setActivo] = useState(zona.activo);
  const [saved, setSaved] = useState(false);

  const updateMut = useMutation({
    mutationFn: () => api.put(`/envios/precios-zona/${zona.id}`, {
      precio: parseFloat(precio) || 0,
      activo,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['precios-zona-admin'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--line)] last:border-b-0">
      <span className="text-sm font-medium text-[var(--ink)] w-16 flex-shrink-0">{ZONA_LABEL[zona.zona] ?? zona.zona}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-[var(--ink-soft)]">$</span>
        <AdminInput type="number" value={precio} onChange={e => setPrecio(e.target.value)} fullWidth={false} className="w-28" />
      </div>
      <Toggle on={activo} onClick={() => setActivo(v => !v)} />
      <span className="text-xs text-[var(--ink-soft)] w-14">{activo ? 'Activa' : 'Inactiva'}</span>
      <AdminButton variant="primary" size="sm" icon={<Save size={11} />} disabled={updateMut.isPending} onClick={() => updateMut.mutate()} className="ml-auto">
        {saved ? '¡Guardado!' : updateMut.isPending ? 'Guardando...' : 'Guardar'}
      </AdminButton>
    </div>
  );
}

// Alta de un método de envío nuevo (POST /envios). Card colapsada por default
// que se despliega en un form. `proveedor` es un select con la lista blanca
// del backend; para retiro se pide la ubicación del local.
function AgregarMetodoCard() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', proveedor: 'retiro', descripcion: '', costo_fijo: '', activo: false });
  const [ubic, setUbic] = useState<Partial<UbicacionRetiro>>({});
  const [error, setError] = useState<string | null>(null);

  const esRetiro = form.proveedor === 'retiro';
  const usaCostoFijo = USA_COSTO_FIJO(form.proveedor);

  const reset = () => {
    setForm({ nombre: '', proveedor: 'retiro', descripcion: '', costo_fijo: '', activo: false });
    setUbic({});
    setError(null);
  };

  const crearMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        proveedor: form.proveedor,
        activo: form.activo,
      };
      const desc = form.descripcion.trim();
      if (desc) body.descripcion = desc;
      if (usaCostoFijo) body.costo_fijo = parseFloat(form.costo_fijo) || 0;
      // La ubicación se manda si está completa (obligatoria para activar el
      // retiro; opcional si nace inactivo y se completa después).
      if (esRetiro && ubicacionCompleta(ubic)) body.ubicacion = ubicacionPayload(ubic);
      return api.post('/envios', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['envios-admin'] });
      setAbierto(false);
      reset();
    },
    onError: (e: unknown) => setError(msgError(e, 'No se pudo crear el método.')),
  });

  const faltaUbicParaActivar = esRetiro && form.activo && !ubicacionCompleta(ubic);
  const puedeCrear = form.nombre.trim().length >= 2 && !faltaUbicParaActivar;

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-[var(--line)] rounded-[var(--radius-el)] text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink-soft)] transition-colors"
      >
        <Plus size={14} /> Agregar método de envío
      </button>
    );
  }

  return (
    <AdminCard padded={false}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--line)]">
        <span className="text-xl">{PROVEEDOR_INFO[form.proveedor]?.icono ?? '🚚'}</span>
        <div className="flex-1 font-semibold text-sm text-[var(--ink)]">Nuevo método de envío</div>
        <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
          Activo
          <Toggle on={form.activo} onClick={() => setForm(f => ({ ...f, activo: !f.activo }))} />
        </label>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <AdminLabel>Nombre visible *</AdminLabel>
            <AdminInput
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder={esRetiro ? 'Ej: Retiro en Villa Crespo' : 'Ej: BENI Express'}
            />
          </div>
          <div>
            <AdminLabel>Tipo</AdminLabel>
            <AdminSelect value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}>
              {PROVEEDORES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </AdminSelect>
          </div>
          <div>
            <AdminLabel>
              Costo fijo ($) {esRetiro ? '— siempre gratis' : form.proveedor === 'oca' ? '— usa precio por zona' : '— fallback si no hay API'}
            </AdminLabel>
            <AdminInput
              type="number"
              value={usaCostoFijo ? form.costo_fijo : ''}
              onChange={e => setForm(f => ({ ...f, costo_fijo: e.target.value }))}
              disabled={!usaCostoFijo}
              placeholder={usaCostoFijo ? '0' : '—'}
            />
          </div>
          <div className="col-span-2">
            <AdminLabel>Descripción</AdminLabel>
            <AdminInput
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder={esRetiro ? 'Ej: Coordinamos por WhatsApp cuándo pasás a buscarlo' : 'Ej: Llega en 24 a 72 hs. Solo CABA y GBA.'}
            />
          </div>
        </div>

        {esRetiro && (
          <div className="border border-[var(--line)] bg-[var(--n-50)] rounded-[var(--radius-el)] p-4 flex flex-col gap-3">
            <p className="text-[11px] text-[var(--ink-soft)]">Ubicación del punto de retiro (obligatoria para activarlo).</p>
            <UbicacionRetiroFields value={ubic} onChange={setUbic} />
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 border border-[var(--error)]/30 bg-[var(--error-soft)] text-[var(--error)] rounded-[var(--radius-el)]">
            {error}
          </div>
        )}
        {faltaUbicParaActivar && !error && (
          <p className="text-[11px] text-[var(--ink-soft)]">Completá dirección, localidad y partido, o desactivá el método para crearlo y cargar la ubicación después.</p>
        )}

        <div className="flex items-center gap-2">
          <AdminButton
            variant="primary" icon={<Plus size={12} />}
            disabled={crearMut.isPending || !puedeCrear}
            onClick={() => crearMut.mutate()}
          >
            {crearMut.isPending ? 'Creando...' : 'Crear método'}
          </AdminButton>
          <AdminButton variant="secondary" onClick={() => { setAbierto(false); reset(); }}>Cancelar</AdminButton>
        </div>
      </div>
    </AdminCard>
  );
}

export default function AdminEnvios() {
  const { data: metodos, isLoading } = useQuery<MetodoEnvio[]>({
    queryKey: ['envios-admin'],
    queryFn: () => api.get('/envios/admin/todos').then(r => r.data),
  });

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
  });

  const { data: preciosZona, isLoading: preciosZonaLoading } = useQuery<PrecioZona[]>({
    queryKey: ['precios-zona-admin'],
    queryFn: () => api.get('/envios/precios-zona').then(r => r.data),
  });

  const qc = useQueryClient();
  const [envioGratis, setEnvioGratis] = useState<string | null>(null);
  const [monto, setMonto] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState(false);

  const envioGratisVal = envioGratis ?? config?.envio_gratis_activo ?? 'false';
  const montoVal = monto ?? config?.envio_gratis_monto ?? '15000';

  const saveConfigMut = useMutation({
    // Endpoint dedicado — escribe directo en 'publicado', no en borrador:
    // esta pantalla no tiene paso de "Publicar" propio, así que no puede
    // depender del publish compartido con el Page Builder (ver
    // ConfiguracionService.updateEnvioGratis).
    mutationFn: () => api.put('/configuracion/envio-gratis', {
      activo: envioGratisVal === 'true',
      monto: Number(montoVal),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion'] });
      setSavedConfig(true);
      setTimeout(() => setSavedConfig(false), 2000);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] mb-1">Métodos de envío</h1>
      <p className="text-sm text-[var(--ink-soft)] mb-8">Configurá los costos, descripciones y APIs de cada proveedor.</p>

      {/* Envío gratis */}
      <AdminCard className="mb-6">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)] mb-4">Envío gratis automático</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Toggle on={envioGratisVal === 'true'} onClick={() => setEnvioGratis(envioGratisVal === 'true' ? 'false' : 'true')} />
            <span className="text-sm text-[var(--ink)]">Activar envío gratis por monto mínimo</span>
          </label>
          {envioGratisVal === 'true' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--ink-soft)]">Monto mínimo $</span>
              <AdminInput type="number" value={montoVal} onChange={e => setMonto(e.target.value)} fullWidth={false} className="w-28" />
            </div>
          )}
          <AdminButton variant="primary" icon={<Save size={12} />} disabled={saveConfigMut.isPending} onClick={() => saveConfigMut.mutate()}>
            {savedConfig ? '¡Guardado!' : 'Guardar'}
          </AdminButton>
        </div>
      </AdminCard>

      {/* Precios por zona — Logística privada */}
      <AdminCard padded={false} className="mb-6">
        <div className="px-5 py-4 border-b border-[var(--line)]">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Precios por zona — Logística privada</h2>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            La disponibilidad de "Logística privada" en el checkout depende del partido del comprador (tabla de cobertura,
            no editable acá). El precio de cada zona sí se edita y se aplica al instante (cache de ~5 min).
          </p>
        </div>
        {preciosZonaLoading ? (
          <div className="text-sm text-[var(--ink-soft)] py-6 text-center">Cargando...</div>
        ) : (
          <div>
            {preciosZona?.map(z => <PrecioZonaRow key={z.id} zona={z} />)}
            {(!preciosZona || preciosZona.length === 0) && (
              <div className="text-sm text-[var(--ink-soft)] py-6 text-center">Sin zonas cargadas.</div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Métodos */}
      {isLoading ? (
        <div className="text-sm text-[var(--ink-soft)] py-8 text-center">Cargando...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {metodos?.map(m => <MetodoCard key={m.id} metodo={m} />)}
          <AgregarMetodoCard />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plug, PlugZap, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';

interface MetodoEnvio {
  id: number;
  nombre: string;
  proveedor: string;
  descripcion: string;
  costo_fijo: number;
  activo: boolean;
  api_conectada: boolean;
  orden: number;
}

const PROVEEDOR_INFO: Record<string, {
  icono: string;
  descripcionApi?: string;
  campos?: { key: string; label: string; placeholder: string; type?: string; ayuda?: string }[];
}> = {
  andreani: {
    icono: '📦',
    descripcionApi: 'Cotización de precios en tiempo real vía API de Andreani.',
    campos: [
      { key: 'contrato', label: 'Número de contrato', placeholder: 'Ej: 12345', ayuda: 'Lo obtés en tu cuenta de Andreani Empresas' },
      { key: 'usuario', label: 'Usuario', placeholder: 'usuario@empresa.com' },
      { key: 'password', label: 'Contraseña', placeholder: '••••••••', type: 'password' },
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

  const [verificando, setVerificando] = useState(false);
  const [verificacionResult, setVerificacionResult] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const verificarCorreo = async () => {
    setVerificando(true);
    setVerificacionResult(null);
    try {
      const r = await api.get(`/envios/${metodo.id}/correo/validar`);
      setVerificacionResult(r.data);
    } catch {
      setVerificacionResult({ ok: false, mensaje: 'Error de conexión' });
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className={`border ${form.activo ? 'border-black/[0.07]' : 'border-black/[0.04] opacity-60'} bg-white`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.05]">
        <span className="text-xl">{info.icono}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-black">{metodo.nombre}</div>
          <div className="text-[11px] text-black/35 uppercase tracking-[0.1em]">{metodo.proveedor}</div>
        </div>
        <div className="flex items-center gap-3">
          {metodo.api_conectada && (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-black bg-black/[0.06] px-2 py-1">
              <PlugZap size={10} /> API activa
            </span>
          )}
          {/* Toggle activo */}
          <button
            onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
            className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${form.activo ? 'bg-black' : 'bg-black/15'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.activo ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">Nombre visible</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
              Costo fijo ($) {metodo.proveedor === 'retiro' ? '— siempre gratis' : info.campos ? '— fallback si API falla' : ''}
            </label>
            <input
              type="number"
              value={form.costo_fijo}
              onChange={e => setForm(f => ({ ...f, costo_fijo: e.target.value }))}
              disabled={metodo.proveedor === 'retiro'}
              className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">Descripción</label>
            <input
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
              placeholder="Ej: Entrega en domicilio en 3–5 días hábiles"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs font-semibold tracking-[0.06em] hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {saved ? '¡Guardado!' : updateMut.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>

          {/* API section toggle — solo para andreani y correo */}
          {info.campos && (
            <button
              onClick={() => setShowApi(v => !v)}
              className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors"
            >
              <Plug size={12} />
              {metodo.api_conectada ? 'Gestionar API' : 'Conectar API'}
              {showApi ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Panel de credenciales API */}
        {showApi && info.campos && (
          <div className="border border-black/[0.07] bg-black/[0.02] p-4 flex flex-col gap-3">
            {info.descripcionApi && (
              <p className="text-[11px] text-black/50 leading-relaxed">{info.descripcionApi}</p>
            )}
            <p className="text-[11px] text-black/40">
              {metodo.api_conectada
                ? 'API activa. Para actualizar las credenciales ingresalas de nuevo.'
                : 'Sin credenciales se usa el costo fijo como precio de envío.'}
            </p>
            {info.campos.map(campo => (
              <div key={campo.key} className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35">{campo.label}</label>
                <input
                  type={campo.type ?? 'text'}
                  value={creds[campo.key] ?? ''}
                  onChange={e => setCreds(c => ({ ...c, [campo.key]: e.target.value }))}
                  placeholder={campo.placeholder}
                  className="border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors bg-white placeholder-black/20"
                />
                {campo.ayuda && <p className="text-[10px] text-black/30">{campo.ayuda}</p>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                onClick={() => conectarMut.mutate()}
                disabled={conectarMut.isPending}
                className="flex items-center gap-1.5 bg-black text-white px-4 py-2 text-xs font-semibold hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                <PlugZap size={11} />
                {conectarMut.isPending ? 'Guardando...' : 'Guardar credenciales'}
              </button>
              {metodo.api_conectada && metodo.proveedor === 'correo' && (
                <button
                  onClick={verificarCorreo}
                  disabled={verificando}
                  className="px-4 py-2 text-xs border border-black/15 hover:border-black text-black/60 hover:text-black transition-colors disabled:opacity-50"
                >
                  {verificando ? 'Verificando...' : 'Verificar conexión'}
                </button>
              )}
              {metodo.api_conectada && (
                <button
                  onClick={() => desconectarMut.mutate()}
                  disabled={desconectarMut.isPending}
                  className="px-4 py-2 text-xs text-black/30 border border-black/10 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  Desconectar
                </button>
              )}
            </div>
            {verificacionResult && (
              <div className={`text-xs px-3 py-2 border ${verificacionResult.ok ? 'border-black/10 bg-black/[0.02] text-black/60' : 'border-red-200 bg-red-50 text-red-600'}`}>
                {verificacionResult.ok ? '✓ ' : '✗ '}{verificacionResult.mensaje}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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

  const qc = useQueryClient();
  const [envioGratis, setEnvioGratis] = useState<string | null>(null);
  const [monto, setMonto] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState(false);

  const envioGratisVal = envioGratis ?? config?.envio_gratis_activo ?? 'false';
  const montoVal = monto ?? config?.envio_gratis_monto ?? '15000';

  const saveConfigMut = useMutation({
    mutationFn: () => api.put('/configuracion', {
      envio_gratis_activo: envioGratisVal,
      envio_gratis_monto: montoVal,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion'] });
      setSavedConfig(true);
      setTimeout(() => setSavedConfig(false), 2000);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight text-black mb-1">Métodos de envío</h1>
      <p className="text-sm text-black/40 mb-8">Configurá los costos, descripciones y APIs de cada proveedor.</p>

      {/* Envío gratis */}
      <div className="border border-black/[0.07] p-5 mb-6">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/35 mb-4">Envío gratis automático</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              onClick={() => setEnvioGratis(envioGratisVal === 'true' ? 'false' : 'true')}
              className={`w-9 h-5 rounded-full relative transition-colors ${envioGratisVal === 'true' ? 'bg-black' : 'bg-black/15'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${envioGratisVal === 'true' ? 'left-4' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-black/70">Activar envío gratis por monto mínimo</span>
          </label>
          {envioGratisVal === 'true' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-black/50">Monto mínimo $</span>
              <input
                type="number"
                value={montoVal}
                onChange={e => setMonto(e.target.value)}
                className="border border-black/15 px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-black transition-colors"
              />
            </div>
          )}
          <button
            onClick={() => saveConfigMut.mutate()}
            disabled={saveConfigMut.isPending}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 text-xs font-semibold hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {savedConfig ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Métodos */}
      {isLoading ? (
        <div className="text-sm text-black/30 py-8 text-center">Cargando...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {metodos?.map(m => <MetodoCard key={m.id} metodo={m} />)}
        </div>
      )}
    </div>
  );
}

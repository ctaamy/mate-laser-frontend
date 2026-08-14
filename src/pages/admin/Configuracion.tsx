import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Check, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { useTemaGlobalData, type TemaGlobal } from '../../hooks/useThemeGlobal';
import { HomeSecciones } from '../../components/home/HomeSecciones';
import ScaledPreview from '../../components/admin/ScaledPreview';

import { labelCls, inputCls } from '../../components/admin/homepage-builder/constantes';
import {
  TIPO_LABELS, TIPO_DEFAULTS, NAV_LINKS_DEFAULT,
  FOOTER_TAGLINE_DEFAULT, FOOTER_GRUPO_TIENDA_DEFAULT, FOOTER_GRUPO_AYUDA_DEFAULT, FOOTER_GRUPO_LEGAL_DEFAULT,
  FOOTER_REDES_DEFAULT, FOOTER_COPYRIGHT_DEFAULT, limpiarDatosSeccion,
} from '../../components/admin/homepage-builder/defaults';
import { FeedbackToast } from '../../components/admin/homepage-builder/campos-comunes';
import { SeccionCard } from '../../components/admin/homepage-builder/SeccionCard';
import { SortableList } from '../../components/admin/homepage-builder/dnd-utils';
import { TemaEditor } from '../../components/admin/homepage-builder/TemaEditor';
import { NavbarCard, NavbarPreviewBar } from '../../components/admin/homepage-builder/NavbarBuilder';
import { FooterCard } from '../../components/admin/homepage-builder/FooterBuilder';
import type { Seccion, TipoSeccion } from '../../components/admin/homepage-builder/types';

// ── Página principal ──────────────────────────────────────────────────────────
// El nav del admin linkea acá con ?tab=inicio|tema|tienda|paginas — "inicio"
// es el label visible del tab interno "homepage" (el resto coincide 1 a 1).
function tabDesdeQueryParam(valor: string | null): 'homepage' | 'tema' | 'tienda' | 'paginas' {
  if (valor === 'inicio') return 'homepage';
  if (valor === 'tema' || valor === 'tienda' || valor === 'paginas') return valor;
  return 'homepage';
}

export default function AdminConfiguracion() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'homepage' | 'tema' | 'tienda' | 'paginas'>(
    tabDesdeQueryParam(searchParams.get('tab'))
  );
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargado, setCargado] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoSeccion>('hero');
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  // Snapshot de la última versión guardada de configForm — se actualiza al
  // cargar del borrador y al guardar con éxito. Comparado contra configForm
  // en cada render, permite avisar "cambios sin guardar" en las tabs Tema y
  // Tienda (comparten este mismo formulario) antes de que el admin navegue
  // a otra sección del sidebar y los pierda en silencio.
  const [configFormGuardado, setConfigFormGuardado] = useState<Record<string, string>>({});
  const [configOk, setConfigOk] = useState(false);

  // ── Autosave del borrador de secciones (Fase 4) ─────────────────────────────
  // Debounce de 2.5s: cualquier cambio en `secciones` (editar contenido/estilo,
  // reordenar, duplicar, eliminar, agregar) programa un guardado automático.
  // El botón "Guardar inicio" sigue existiendo en paralelo — fuerza el guardado
  // ya mismo y cancela el debounce pendiente (lo usan ~13 specs de Playwright
  // para persistir de forma determinística, ver CLAUDE.md de esta fase).
  const AUTOSAVE_DEBOUNCE_MS = 2500;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seccionesCargadasRef = useRef(false); // evita disparar autosave con la carga inicial (migración incluida)
  const skipProximoAutosaveRef = useRef(false); // usado por acciones que ya guardan de forma inmediata (ej. "Aplicar tema")
  const [autosavePendiente, setAutosavePendiente] = useState(false);
  const [autosaveGuardadoAlgunaVez, setAutosaveGuardadoAlgunaVez] = useState(false);

  // Baseline de detección de conflicto multi-pestaña: el `actualizado` de la
  // fila homepage_sections/borrador tal cual se cargó la primera vez. A
  // propósito NO es un valor de React Query (que se podría refetchear solo) —
  // necesitamos "lo que vi cuando abrí este tab", no "lo último que hay".
  const metaBaselineRef = useRef<string | null>(null);
  const metaBaselineCargadaRef = useRef(false);
  const [conflictoDetectado, setConflictoDetectado] = useState(false);

  // El editor siempre lee/escribe el BORRADOR — nunca lo publicado
  // directamente. Lo que ve el admin acá es su propia vista previa real:
  // no hay ningún modo "simulación" aparte.
  const { data: seccionesRemote } = useQuery<Seccion[]>({
    queryKey: ['homepage', 'borrador'],
    queryFn: () => api.get('/configuracion/homepage/borrador').then(r => r.data),
  });

  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion', 'borrador'],
    queryFn: () => api.get('/configuracion/borrador').then(r => r.data),
  });

  const { data: estadoPublicacion } = useQuery<{ hayCambios: boolean }>({
    queryKey: ['configuracion', 'estado-publicacion'],
    queryFn: () => api.get('/configuracion/estado-publicacion').then(r => r.data),
  });

  const tema = useTemaGlobalData('borrador');

  useEffect(() => {
    if (!seccionesRemote || !config || cargado) return;
    // Migración: si todavía no existe una sección tipo 'navbar' (instalación
    // previa a esta fase), se sintetiza una a partir de las claves sueltas
    // legacy (navbar_*) para que el navbar pase a vivir en homepage_sections
    // como cualquier otro bloque. No pisa nada remoto hasta el próximo guardado.
    const yaTieneNavbar = seccionesRemote.some(s => s.tipo === 'navbar');
    const navbarMigrada: Seccion = {
      id: crypto.randomUUID(),
      tipo: 'navbar',
      activo: true,
      // El backend valida orden >= 0 (@Min(0) en HomepageSeccionDto) — un
      // valor negativo acá hacía fallar CUALQUIER guardado de /homepage
      // (incluida una simple eliminación de sección) con 400 Bad Request,
      // sin feedback visible para el admin. El valor en sí no importa
      // funcionalmente: el navbar se excluye de la lista reordenable por
      // tipo, no por orden — se usa un sentinel alto para que no choque con
      // el índice de ninguna sección real.
      orden: 999999,
      datos: {
        bg_color: config.navbar_bg_color || '',
        texto_color: config.navbar_texto_color || '',
        border_color: config.navbar_border_color || '',
        logo_url: config.navbar_logo_url || '',
        logo_alto: config.navbar_logo_alto || '32',
        mostrar_buscar: (config.navbar_mostrar_buscar ?? 'true') !== 'false',
        mostrar_usuario: (config.navbar_mostrar_usuario ?? 'true') !== 'false',
        mostrar_carrito: (config.navbar_mostrar_carrito ?? 'true') !== 'false',
        tipo_menu: 'tradicional',
        // Migración de nav_links (clave suelta legacy, JSON string) a
        // datos.links (array, editable con agregar/quitar/reordenar).
        links: (() => {
          if (!config.nav_links) return NAV_LINKS_DEFAULT;
          try {
            const parsed = typeof config.nav_links === 'string' ? JSON.parse(config.nav_links) : config.nav_links;
            return Array.isArray(parsed) ? parsed : NAV_LINKS_DEFAULT;
          } catch { return NAV_LINKS_DEFAULT; }
        })(),
      },
    };
    const conNavbar = yaTieneNavbar ? seccionesRemote : [...seccionesRemote, navbarMigrada];

    // Migración del footer: no tenía ninguna clave suelta previa (estaba
    // 100% hardcodeado en Footer.tsx) — se sintetiza con esos mismos
    // valores fijos para que el sitio se vea igual hasta el próximo guardado.
    const yaTieneFooter = conNavbar.some(s => s.tipo === 'footer');
    const footerMigrado: Seccion = {
      id: crypto.randomUUID(),
      tipo: 'footer',
      activo: true,
      orden: 999999,
      datos: {
        bg_color: '#0a0a0a',
        texto_color: '#ffffff',
        tagline: FOOTER_TAGLINE_DEFAULT,
        grupo_tienda: FOOTER_GRUPO_TIENDA_DEFAULT,
        grupo_ayuda: FOOTER_GRUPO_AYUDA_DEFAULT,
        grupo_legal: FOOTER_GRUPO_LEGAL_DEFAULT,
        redes: FOOTER_REDES_DEFAULT,
        copyright: FOOTER_COPYRIGHT_DEFAULT,
      },
    };
    setSecciones(yaTieneFooter ? conNavbar : [...conNavbar, footerMigrado]);
    setCargado(true);
  }, [seccionesRemote, config, cargado]);

  // Baseline de conflicto multi-pestaña: se pide una sola vez, apenas
  // termina de cargar el tab "Inicio" (ver comentario junto al useRef).
  useEffect(() => {
    if (!cargado || metaBaselineCargadaRef.current) return;
    metaBaselineCargadaRef.current = true;
    // Timeout corto y fail-open a propósito: si este endpoint tarda o no
    // responde (red lenta, algún proxy/mock de test que no lo contempla),
    // preferimos arrancar sin baseline de conflicto antes que colgar la
    // carga del editor — el chequeo de conflicto es una mejora de UX, no
    // algo que deba bloquear el uso normal del builder.
    api.get('/configuracion/homepage/borrador/meta', { timeout: 4000, skipAuthRedirect: true } as any)
      .then(({ data }) => { metaBaselineRef.current = data?.actualizado ?? null; })
      .catch(() => { metaBaselineRef.current = null; });
  }, [cargado]);

  // Programa el autosave debounced apenas cambia `secciones` — salvo la
  // carga inicial (incluida la migración de navbar/footer) y las acciones
  // que ya se guardan de forma inmediata (ver skipProximoAutosaveRef).
  useEffect(() => {
    if (!cargado) return;
    if (!seccionesCargadasRef.current) {
      seccionesCargadasRef.current = true;
      return;
    }
    if (skipProximoAutosaveRef.current) {
      skipProximoAutosaveRef.current = false;
      return;
    }
    if (conflictoDetectado) return; // no reintentar en loop tras un conflicto

    setAutosavePendiente(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      setAutosavePendiente(false);
      guardarHomepageMutation.mutate(secciones);
    }, AUTOSAVE_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secciones, cargado, conflictoDetectado]);

  useEffect(() => {
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, []);

  useEffect(() => {
    if (config && Object.keys(configForm).length === 0) {
      const form: Record<string, string> = {};
      for (const [k, v] of Object.entries(config)) {
        if (k !== 'homepage_sections') form[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      setConfigForm(form);
      setConfigFormGuardado(form);
    }
  }, [config]);

  const guardarHomepageMutation = useMutation({
    mutationFn: async (secs: Seccion[]) => {
      // Detección de conflicto multi-pestaña: antes de cada guardado (auto o
      // manual) se compara el `actualizado` remoto contra el baseline con el
      // que se cargó este tab. Si no hay baseline todavía (fila recién creada
      // o el chequeo inicial falló) no hay nada contra qué comparar — se
      // guarda igual. Si el chequeo en sí falla (red caída, etc.) se prioriza
      // no perder el trabajo del admin: fail-open, se guarda igual.
      if (metaBaselineRef.current !== null) {
        let metaActual: string | null = metaBaselineRef.current;
        try {
          const { data } = await api.get('/configuracion/homepage/borrador/meta', { timeout: 4000, skipAuthRedirect: true } as any);
          metaActual = data?.actualizado ?? null;
        } catch {
          // fail-open (incluye timeout) — ver comentario arriba
        }
        if (metaActual !== metaBaselineRef.current) {
          const conflicto: any = new Error('CONFLICTO_MULTIPESTANA');
          conflicto.esConflictoAutosave = true;
          throw conflicto;
        }
      }
      const res = await api.put('/configuracion/homepage', { secciones: secs });
      return res.data;
    },
    onSuccess: (data) => {
      metaBaselineRef.current = data?.actualizado ?? metaBaselineRef.current;
      queryClient.invalidateQueries({ queryKey: ['homepage'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setGuardadoOk(true);
      setAutosaveGuardadoAlgunaVez(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    },
    onError: (err: any) => {
      if (err?.esConflictoAutosave) {
        setConflictoDetectado(true);
        if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
        setAutosavePendiente(false);
      }
    },
  });

  // Drag & drop de secciones (primer nivel): persiste el nuevo orden apenas
  // se suelta, sin esperar al botón "Guardar inicio" — PATCH liviano
  // (ReordenarSeccionesDto, solo ids) en vez del PUT completo con todo
  // `datos`. No pisa la respuesta sobre el estado local: si el admin tiene
  // ediciones de contenido sin guardar en algún bloque, este PATCH no debe
  // hacerlas desaparecer (el backend solo devuelve lo que ya tenía persistido).
  const [ordenOk, setOrdenOk] = useState(false);
  const reordenarMutation = useMutation({
    mutationFn: (ids: string[]) => api.patch('/configuracion/homepage/orden', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setOrdenOk(true);
      setTimeout(() => setOrdenOk(false), 2000);
      // Este PATCH también actualiza `actualizado` en el borrador, por su
      // propio camino (no pasa por guardarHomepageMutation) — sin esto, el
      // baseline de conflicto multi-pestaña queda desactualizado apenas se
      // arrastra una sección, y el siguiente autosave se compara contra un
      // valor viejo y dispara el banner de "conflicto" por error, aunque
      // haya sido la misma pestaña. El endpoint no devuelve `actualizado`
      // en su respuesta, así que se refresca con un GET liviano aparte.
      api.get('/configuracion/homepage/borrador/meta', { timeout: 4000, skipAuthRedirect: true } as any)
        .then(({ data }) => { metaBaselineRef.current = data?.actualizado ?? metaBaselineRef.current; })
        .catch(() => {});
    },
  });

  const guardarConfigMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/configuracion', data),
    onSuccess: (_res, data) => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setConfigFormGuardado(data);
      setConfigOk(true);
      setTimeout(() => setConfigOk(false), 3000);
    },
  });

  const [publicando, setPublicando] = useState(false);
  const [descartando, setDescartando] = useState(false);

  const publicarMutation = useMutation({
    mutationFn: () => api.post('/configuracion/publicar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setPublicando(true);
      setTimeout(() => setPublicando(false), 3000);
    },
  });

  const descartarMutation = useMutation({
    mutationFn: () => api.post('/configuracion/descartar'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage', 'borrador'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'borrador'] });
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'estado-publicacion'] });
      setDescartando(true);
      setTimeout(() => setDescartando(false), 3000);
    },
  });

  const publicarCambios = () => {
    const ok = window.confirm('Vas a hacer visibles estos cambios a todos los clientes. ¿Confirmás?');
    if (!ok) return;
    publicarMutation.mutate();
  };

  const descartarCambios = () => {
    const ok = window.confirm('Se va a descartar todo lo que editaste desde la última publicación. ¿Confirmás?');
    if (!ok) return;
    descartarMutation.mutate();
  };

  // El navbar y el footer comparten el mismo array/endpoint que el resto de
  // las secciones, pero no aparecen en la lista reordenable de "Inicio" ni
  // en el selector de "Agregar sección" — cada uno tiene su propia card fija.
  const seccionesHomepage = secciones.filter(s => s.tipo !== 'navbar' && s.tipo !== 'footer');
  const navbarSec = secciones.find(s => s.tipo === 'navbar');
  const footerSec = secciones.find(s => s.tipo === 'footer');

  const agregarSeccion = () => {
    const nueva: Seccion = {
      id: crypto.randomUUID(),
      tipo: nuevoTipo,
      activo: true,
      orden: seccionesHomepage.length,
      datos: { ...TIPO_DEFAULTS[nuevoTipo] },
    };
    setSecciones(prev => [...prev, nueva]);
  };

  const actualizarSeccion = (id: string, sec: Seccion) =>
    setSecciones(prev => prev.map(s => s.id === id ? sec : s));

  const eliminarSeccion = (id: string) => {
    const sec = secciones.find(s => s.id === id);
    const nombre = sec ? (TIPO_LABELS[sec.tipo as TipoSeccion] ?? 'esta sección') : 'esta sección';
    if (!confirm(`¿Eliminar el bloque "${nombre}"? Se pierde su título, imágenes, botones y estilos propios — no se puede deshacer.`)) return;
    setSecciones(prev => prev.filter(s => s.id !== id));
  };

  // Clona la sección completa (datos incluidos, sin compartir referencias con
  // el original) y la inserta inmediatamente después — misma sección activa,
  // nuevo id. Reasigna `orden` secuencial solo a las reordenables (navbar y
  // footer no participan del orden numérico, ver reordenarSecciones).
  const duplicarSeccion = (id: string) => {
    setSecciones(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const datosClon = typeof structuredClone === 'function'
        ? structuredClone(original.datos)
        : JSON.parse(JSON.stringify(original.datos));
      const clon: Seccion = { ...original, id: crypto.randomUUID(), datos: datosClon };
      const conClon = [...prev.slice(0, idx + 1), clon, ...prev.slice(idx + 1)];
      let i = 0;
      return conClon.map(s => (s.tipo === 'navbar' || s.tipo === 'footer') ? s : { ...s, orden: i++ });
    });
  };

  // Botón "Guardar inicio": fuerza el guardado ya mismo y cancela/resetea el
  // debounce del autosave (que corre en paralelo, no lo reemplaza).
  const guardarInicioManual = () => {
    if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
    setAutosavePendiente(false);
    guardarHomepageMutation.mutate(secciones);
  };

  // Reorden por drag & drop (reemplaza los antiguos botones ↑/↓ — ver
  // SeccionCard/dnd-utils). `next` ya viene en el nuevo orden deseado, solo
  // para las secciones reordenables (navbar/footer quedan afuera de este
  // DndContext, ver SortableList más abajo). Navbar y footer se preservan
  // en su posición relativa dentro del array completo — su `orden` en sí no
  // importa funcionalmente (se filtran por `tipo`, no por `orden`).
  const reordenarSecciones = (next: Seccion[]) => {
    const otras = secciones.filter(s => s.tipo === 'navbar' || s.tipo === 'footer');
    const nuevas = [...next.map((s, i) => ({ ...s, orden: i })), ...otras];
    setSecciones(nuevas);
    reordenarMutation.mutate(nuevas.map(s => s.id));
  };

  const actualizarNavbarDatos = (k: string, v: any) => {
    if (!navbarSec) return;
    actualizarSeccion(navbarSec.id, { ...navbarSec, datos: { ...navbarSec.datos, [k]: v } });
  };

  const actualizarFooterDatos = (k: string, v: any) => {
    if (!footerSec) return;
    actualizarSeccion(footerSec.id, { ...footerSec, datos: { ...footerSec.datos, [k]: v } });
  };

  // "Aplicar" / "Aplicar a todo" del tab Tema — ver limpiarDatosSeccion.
  const aplicarTema = (modo: 'todo' | 'solo_vacios') => {
    if (modo === 'todo') {
      const ok = window.confirm('Esto va a borrar la personalización de todos los bloques, títulos y botones. ¿Confirmás?');
      if (!ok) return;
    }
    const nuevas = secciones.map(sec => ({ ...sec, datos: limpiarDatosSeccion(sec.datos, modo) }));
    skipProximoAutosaveRef.current = true; // ya se guarda de forma inmediata acá abajo
    setSecciones(nuevas);
    if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null; }
    setAutosavePendiente(false);
    guardarHomepageMutation.mutate(nuevas);
  };

  const hayCambiosSinPublicar = estadoPublicacion?.hayCambios ?? false;

  // Tema y Tienda comparten este mismo formulario (claves sueltas de
  // configuración) — si el admin edita acá y navega a otra sección del
  // sidebar sin guardar, lo pierde en silencio. Este flag alimenta el aviso
  // visual en ambas tabs (ver JSX de "tema" y "tienda" más abajo).
  const hayCambiosConfigSinGuardar = JSON.stringify(configForm) !== JSON.stringify(configFormGuardado);

  // Aviso del navegador al cerrar/recargar la pestaña con cambios sin
  // guardar en Tema/Tienda. No cubre la navegación interna del sidebar
  // (SPA) — para eso está el indicador visual en cada tab.
  useEffect(() => {
    if (!hayCambiosConfigSinGuardar) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hayCambiosConfigSinGuardar]);

  // Tema "en vivo": se calcula directo de configForm (el estado editable en
  // memoria), no del borrador ya guardado en el backend — así el preview
  // refleja cada tecla, no solo lo que ya se guardó con "Guardar tema".
  const temaEnVivo: TemaGlobal = {
    bg_color: configForm.tema_bg_color || '#ffffff',
    texto_color: configForm.tema_texto_color || '#111111',
    texto_secundario_color: configForm.tema_texto_secundario_color || '#6b7280',
    font_family: configForm.tema_font_family || '',
    accent_color: configForm.tema_accent_color || '#1D9E75',
    badge_color: configForm.tema_badge_color || '#111111',
  };
  const seccionesPreview = secciones.filter(s => s.activo && s.tipo !== 'navbar' && s.tipo !== 'footer');
  const mostrarPreview = tab === 'homepage' || tab === 'tema';

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Banner bloqueante de conflicto multi-pestaña — a propósito no tiene
          botón de cerrar ni overlay click-afuera: la única salida es recargar,
          no hay merge automático (spec de UX ya aprobada). */}
      {conflictoDetectado && (
        <div data-testid="conflicto-multipestana-banner"
          className="sticky top-0 z-50 -mx-6 -mt-6 mb-0 px-6 py-3 bg-red-600 text-white flex items-center justify-center gap-4 text-sm font-medium">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>Este borrador se editó en otra pestaña. Recargá para ver los cambios más recientes.</span>
          <button onClick={() => window.location.reload()}
            className="bg-white text-red-600 rounded-lg px-3 py-1 text-xs font-semibold flex-shrink-0">
            Recargar
          </button>
        </div>
      )}
      <div className="flex items-start justify-between gap-4 max-w-6xl">
        <div>
          <h1 className="text-xl font-medium text-[var(--ink)]">Configuración</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">Personalizá la tienda y el inicio</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {hayCambiosSinPublicar && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              Tenés cambios sin publicar
            </span>
          )}
          <FeedbackToast show={publicando} className="text-xs text-[var(--accent)]">¡Publicado correctamente!</FeedbackToast>
          <FeedbackToast show={descartando} className="text-xs text-[var(--ink-soft)]">Cambios descartados</FeedbackToast>
          <div className="flex gap-2">
            <button onClick={descartarCambios}
              disabled={descartarMutation.isPending || !hayCambiosSinPublicar}
              className="border border-[var(--line)] text-[var(--ink-soft)] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--n-50)] disabled:opacity-50">
              Descartar cambios del borrador
            </button>
            <motion.button onClick={publicarCambios} whileTap={{ scale: 0.97 }}
              disabled={publicarMutation.isPending || !hayCambiosSinPublicar}
              className="bg-[var(--ink)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[var(--n-700)] disabled:opacity-50">
              {publicarMutation.isPending ? 'Publicando...' : 'Publicar cambios'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Dos columnas desde lg (1024px): editor con ancho FIJO (no max-width
          que compita por espacio) + preview con flex-1 min-w-0, que se
          banca cualquier ancho restante porque ScaledPreview escala su
          contenido (zoom "ajustar al ancho") y tiene su propio scroll
          interno — así nunca hace falta un min-width rígido acá que fuerce
          overflow de la página entera. Por debajo de lg se apila (mobile /
          ventana muy angosta) para no aplastar ninguna de las dos. */}
      <div className={`flex flex-col ${mostrarPreview ? 'lg:flex-row' : ''} gap-6 items-start min-w-0`}>
      <div className="flex flex-col gap-6 w-full max-w-3xl lg:w-[560px] lg:max-w-none flex-shrink-0 min-w-0">

      <div className="flex gap-1 border border-[var(--line)] rounded-xl p-1 bg-white w-fit">
        {(['homepage', 'tema', 'tienda', 'paginas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
            {t === 'homepage' ? 'Inicio' : t === 'tema' ? 'Tema' : t === 'tienda' ? 'Tienda' : 'Páginas'}
            {/* Tema, Tienda y Páginas comparten el mismo formulario — el
                punto avisa que hay cambios sin guardar aunque no estés
                parado en esa tab. */}
            {(t === 'tema' || t === 'tienda' || t === 'paginas') && hayCambiosConfigSinGuardar && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" title="Cambios sin guardar" />
            )}
          </button>
        ))}
      </div>

      {tab === 'homepage' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-soft)]">
            Cada sección tiene dos tabs: <strong>Contenido</strong> (textos, links) y <strong>Estilo</strong> (colores, tipografía, layout).
          </p>

          {navbarSec && (
            <NavbarCard datos={navbarSec.datos} set={actualizarNavbarDatos}
              nombreTienda={configForm.nombre_tienda ?? ''} tema={tema} />
          )}

          <div className="flex flex-col gap-2">
            {seccionesHomepage.length === 0 && (
              <div className="text-center py-10 text-sm text-[var(--ink-soft)] bg-white border border-dashed border-[var(--line)] rounded-xl">
                {cargado ? 'No hay secciones. Agregá una abajo.' : 'Cargando...'}
              </div>
            )}
            <SortableList items={seccionesHomepage} getId={s => s.id} onReorder={reordenarSecciones}>
              {seccionesHomepage.map(sec => (
                <SeccionCard key={sec.id} sec={sec}
                  onChange={s => actualizarSeccion(sec.id, s)}
                  onRemove={() => eliminarSeccion(sec.id)}
                  onDuplicate={() => duplicarSeccion(sec.id)} />
              ))}
            </SortableList>
            <FeedbackToast show={ordenOk} className="text-xs text-[var(--ink-soft)] self-end">Orden actualizado</FeedbackToast>
          </div>

          <div className="bg-white border border-[var(--line)] rounded-xl p-4 flex items-center gap-3">
            <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as TipoSeccion)}
              className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-[var(--accent)]">
              {(Object.keys(TIPO_LABELS) as TipoSeccion[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
            <button onClick={agregarSeccion}
              className="bg-[var(--n-100)] hover:bg-[var(--n-200)] text-[var(--ink)] rounded-lg px-3 py-2 text-sm flex items-center gap-2 font-medium transition-colors flex-shrink-0">
              <Plus size={14} /> Agregar sección
            </button>
          </div>

          {footerSec && (
            <FooterCard datos={footerSec.datos} set={actualizarFooterDatos} tema={tema} />
          )}

          <div className="flex items-center justify-end gap-3">
            {/* Indicador persistente de autosave — a diferencia de FeedbackToast
                (efímero, 3s), este queda fijo hasta el próximo cambio. Corre en
                paralelo al botón manual, no lo reemplaza. */}
            {!conflictoDetectado && (
              <span data-testid="autosave-estado"
                data-estado={guardarHomepageMutation.isPending ? 'guardando' : autosavePendiente ? 'editando' : autosaveGuardadoAlgunaVez ? 'guardado' : 'sin-cambios'}
                className="text-xs flex items-center gap-1.5 text-[var(--ink-soft)]">
                {guardarHomepageMutation.isPending ? (
                  <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                ) : autosavePendiente ? (
                  <>Editando...</>
                ) : autosaveGuardadoAlgunaVez ? (
                  <><Check size={13} className="text-[var(--accent)]" /> Guardado hace un momento</>
                ) : null}
              </span>
            )}
            <FeedbackToast show={guardadoOk} className="text-xs text-[var(--accent)]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={guardarInicioManual} whileTap={{ scale: 0.97 }}
              disabled={guardarHomepageMutation.isPending || conflictoDetectado}
              className="bg-[var(--accent)] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarHomepageMutation.isPending ? 'Guardando...' : 'Guardar inicio'}
            </motion.button>
          </div>
        </div>
      )}

      {tab === 'tema' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-soft)]">
            Color de fondo, color de letra y tipografía por defecto de todo el sitio.
          </p>
          <TemaEditor form={configForm} setForm={setConfigForm}
            onAplicar={() => aplicarTema('solo_vacios')}
            onAplicarATodo={() => aplicarTema('todo')}
            aplicando={guardarHomepageMutation.isPending}
            aplicadoOk={guardadoOk} />
          <div className="flex items-center justify-end gap-3">
            {hayCambiosConfigSinGuardar && !configOk && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Tenés cambios sin guardar
              </span>
            )}
            <FeedbackToast show={configOk} className="text-xs text-[var(--accent)]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarConfigMutation.mutate(configForm)} whileTap={{ scale: 0.97 }}
              disabled={guardarConfigMutation.isPending}
              className="bg-[var(--accent)] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar tema'}
            </motion.button>
          </div>
        </div>
      )}

      {tab === 'tienda' && (
        <div className="flex flex-col gap-4">

          {/* Datos generales */}
          <div className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-4">
            <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Datos generales</div>
            {[
              { key: 'nombre_tienda', label: 'Nombre de la tienda', placeholder: 'Mate Laser Studio' },
              { key: 'email_contacto', label: 'Email de contacto', placeholder: 'hola@matelaser.com' },
              { key: 'telefono_contacto', label: 'Teléfono / WhatsApp (con código de país)', placeholder: '+5491112345678' },
              { key: 'whatsapp_mensaje', label: 'Mensaje pre-cargado de WhatsApp', placeholder: '¡Hola! Quiero hacer un pedido personalizado 🧉' },
              { key: 'moneda', label: 'Moneda', placeholder: 'ARS' },
              { key: 'envio_gratis_monto', label: 'Monto mínimo para envío gratis ($)', placeholder: '15000' },
              { key: 'transferencia_banco', label: 'Transferencia — Banco', placeholder: 'Banco Galicia' },
              { key: 'transferencia_titular', label: 'Transferencia — Titular de la cuenta', placeholder: 'Mate Laser Studio' },
              { key: 'transferencia_alias', label: 'Transferencia — Alias', placeholder: 'MATE.LASER.STUDIO' },
              { key: 'transferencia_cbu', label: 'Transferencia — CBU', placeholder: '0000003100000000000000' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} value={configForm[key] ?? ''} placeholder={placeholder}
                  onChange={e => setConfigForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex items-center justify-between bg-[var(--n-50)] rounded-lg px-4 py-3 border border-[var(--line)]">
              <div>
                <div className="text-sm font-medium">Envío gratis activo</div>
                <div className="text-xs text-[var(--ink-soft)]">Cuando el subtotal supera el monto mínimo</div>
              </div>
              <button
                onClick={() => setConfigForm(f => ({ ...f, envio_gratis_activo: f.envio_gratis_activo === 'true' ? 'false' : 'true' }))}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${configForm.envio_gratis_activo === 'true' ? 'bg-[var(--accent)]' : 'bg-[var(--n-300)]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${configForm.envio_gratis_activo === 'true' ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {hayCambiosConfigSinGuardar && !configOk && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Tenés cambios sin guardar
              </span>
            )}
            <FeedbackToast show={configOk} className="text-xs text-[var(--accent)]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarConfigMutation.mutate(configForm)} whileTap={{ scale: 0.97 }}
              disabled={guardarConfigMutation.isPending}
              className="bg-[var(--accent)] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </motion.button>
          </div>
        </div>
      )}

      {tab === 'paginas' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-soft)]">
            Título y contenido (Markdown) de las páginas legales/de ayuda enlazadas desde el footer. El contenido final se carga acá cuando esté listo — mientras tanto la ruta ya existe y no queda rota.
          </p>
          {[
            { clave: 'pagina_terminos', label: 'Términos y condiciones' },
            { clave: 'pagina_privacidad', label: 'Política de privacidad' },
            { clave: 'pagina_faq', label: 'Preguntas frecuentes' },
            { clave: 'pagina_envios', label: 'Envíos y devoluciones' },
          ].map(({ clave, label }) => (
            <div key={clave} className="bg-white border border-[var(--line)] rounded-xl p-5 flex flex-col gap-3">
              <div className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider">{label}</div>
              <div>
                <label className={labelCls}>Título</label>
                <input className={inputCls} value={configForm[`${clave}_titulo`] ?? ''} placeholder={label}
                  onChange={e => setConfigForm(f => ({ ...f, [`${clave}_titulo`]: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Contenido (Markdown)</label>
                <textarea className={inputCls + ' h-32 resize-y font-mono text-xs'}
                  value={configForm[`${clave}_markdown`] ?? ''} placeholder={'# Título\n\nTexto con **negrita** y un [link](https://ejemplo.com).'}
                  onChange={e => setConfigForm(f => ({ ...f, [`${clave}_markdown`]: e.target.value }))} />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3">
            {hayCambiosConfigSinGuardar && !configOk && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Tenés cambios sin guardar
              </span>
            )}
            <FeedbackToast show={configOk} className="text-xs text-[var(--accent)]">¡Guardado correctamente!</FeedbackToast>
            <motion.button onClick={() => guardarConfigMutation.mutate(configForm)} whileTap={{ scale: 0.97 }}
              disabled={guardarConfigMutation.isPending}
              className="bg-[var(--accent)] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2">
              <Save size={14} />
              {guardarConfigMutation.isPending ? 'Guardando...' : 'Guardar páginas'}
            </motion.button>
          </div>
        </div>
      )}
      </div>

      {mostrarPreview && (
        <div className="w-full lg:flex-1 lg:sticky lg:top-6 min-w-0" data-testid="navbar-preview-live">
          <div className="bg-white border border-[var(--line)] rounded-xl overflow-hidden">
            <div className="text-[10px] text-[var(--ink-soft)] uppercase tracking-wider px-3 py-2 bg-[var(--n-50)] border-b border-[var(--line)] font-semibold flex items-center justify-between">
              <span>Vista previa en vivo — borrador</span>
              <span className="normal-case font-normal text-[var(--n-300)]">así lo ven vos, no los clientes</span>
            </div>
            <ScaledPreview className="max-h-[calc(100vh-140px)]">
              {navbarSec && (
                <NavbarPreviewBar datos={navbarSec.datos} tema={temaEnVivo} nombreTienda={configForm.nombre_tienda ?? ''} />
              )}
              {seccionesPreview.length === 0
                ? <div className="text-center py-16 text-sm text-[var(--ink-soft)]">No hay secciones activas para mostrar.</div>
                : <HomeSecciones secciones={seccionesPreview} tema={temaEnVivo} />
              }
            </ScaledPreview>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

import type { Seccion, TipoSeccion } from './types';

// ── Fase 5: validación de contenido pre-publish ──────────────────────────────
// Dos niveles, no bloqueantes durante la edición — solo importan al momento
// de publicar (ver PublicarModal.tsx) y como badge informativo en cada
// SeccionCard. Filosofía: BLOQUEANTE únicamente para una sección que, tal
// como está configurada, no renderizaría absolutamente nada visible en el
// sitio público (confirmado leyendo el render real en HomeSecciones.tsx,
// no solo intuyendo por el nombre del campo). WARNING para todo lo demás
// que sea "se ve, pero quedó pobre o a medio configurar" — nunca bloquea.
//
// Una sección con activo:false no se valida: no importa si está vacía, no
// se va a mostrar de todas formas (ver validarSecciones).

export type SeveridadProblema = 'bloqueante' | 'warning';

export interface ProblemaValidacion {
  severidad: SeveridadProblema;
  mensaje: string;
}

export interface ResultadoValidacionSeccion {
  seccionId: string;
  tipo: TipoSeccion;
  problemas: ProblemaValidacion[];
}

const bloqueante = (mensaje: string): ProblemaValidacion => ({ severidad: 'bloqueante', mensaje });
const warning = (mensaje: string): ProblemaValidacion => ({ severidad: 'warning', mensaje });

// ── Botones: mismo criterio de resolución que resolverBotones en
// HomeSecciones.tsx (array datos.botones tiene prioridad total sobre los
// campos legacy btn_texto/btn_link + btn2_texto/btn2_link) — PERO acá, a
// diferencia del render, interesa detectar el caso "a medias" (texto sin
// link, o link sin texto), así que no se filtran los incompletos.
interface BotonCrudo { texto?: string; link?: string }

function botonesParaValidar(datos: Record<string, any>): BotonCrudo[] {
  if (Array.isArray(datos.botones) && datos.botones.length > 0) return datos.botones;
  const legacy: BotonCrudo[] = [];
  if (datos.btn_texto || datos.btn_link) legacy.push({ texto: datos.btn_texto, link: datos.btn_link });
  if (datos.btn2_texto || datos.btn2_link) legacy.push({ texto: datos.btn2_texto, link: datos.btn2_link });
  return legacy;
}

function botonRoto(b: BotonCrudo): boolean {
  return (!!b.texto?.trim() && !b.link?.trim()) || (!b.texto?.trim() && !!b.link?.trim());
}

function urlProbablementeInvalida(url: string): boolean {
  return !/^(https?:\/\/|\/)/.test(url);
}

// ── Validación por tipo ───────────────────────────────────────────────────
function validarTipo(tipo: TipoSeccion, datos: Record<string, any>): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];

  switch (tipo) {
    case 'hero': {
      const slides: any[] = Array.isArray(datos.slides) ? datos.slides : [];
      if (slides.length === 0) {
        // En la práctica el editor (HeroEditor) no deja borrar el último
        // slide, así que este caso es más una red de seguridad (datos
        // cargados a mano o de una versión anterior) que un flujo normal.
        problemas.push(bloqueante('No tiene ningún slide cargado.'));
        break;
      }
      slides.forEach((slide, i) => {
        if (!slide?.imagen_url) {
          problemas.push(warning(`Slide ${i + 1}: sin imagen — se va a ver, pero queda pobre visualmente.`));
        }
        botonesParaValidar(slide ?? {}).forEach(b => {
          if (botonRoto(b)) problemas.push(warning(`Slide ${i + 1}: un botón tiene texto sin link, o link sin texto.`));
        });
      });
      break;
    }

    case 'banner_texto': {
      if (!datos.texto?.trim()) problemas.push(bloqueante('El texto del banner está vacío.'));
      break;
    }

    case 'texto_libre': {
      if (!datos.html?.trim()) problemas.push(bloqueante('El contenido HTML está vacío.'));
      break;
    }

    case 'banner_imagen': {
      if (!datos.imagen_url?.trim()) {
        problemas.push(bloqueante('No tiene ninguna imagen cargada.'));
      } else if (urlProbablementeInvalida(datos.imagen_url.trim())) {
        problemas.push(warning('La URL de la imagen no empieza con http, https o / — probablemente esté rota o mal pegada.'));
      }
      break;
    }

    case 'stats_barra': {
      if (!(Array.isArray(datos.stats) && datos.stats.length > 0)) {
        problemas.push(bloqueante('No tiene ninguna estadística cargada.'));
      }
      break;
    }

    case 'como_funciona': {
      if (!(Array.isArray(datos.pasos) && datos.pasos.length > 0)) {
        problemas.push(bloqueante('No tiene ningún paso cargado.'));
      }
      break;
    }

    case 'filtros_rapidos': {
      if (!(Array.isArray(datos.items) && datos.items.length > 0)) {
        problemas.push(bloqueante('No tiene ningún filtro cargado.'));
      }
      break;
    }

    case 'cta_banner': {
      botonesParaValidar(datos).forEach(b => {
        if (botonRoto(b)) problemas.push(warning('Hay un botón con texto sin link, o link sin texto.'));
      });
      break;
    }

    // productos_destacados, categorias_grid, galeria_combos, newsletter:
    // sin validación — ver nota de "Casos límite documentados" al final del
    // archivo para el detalle de por qué, tipo por tipo.
    default:
      break;
  }

  return problemas;
}

// ── Entry points ─────────────────────────────────────────────────────────
// Secciones-tipo que participan del selector "Agregar sección" — navbar y
// footer quedan afuera a propósito (siempre tienen fallback hardcodeado,
// spec explícita: "sin validación bloqueante").
export function validarSeccion(sec: Seccion): ProblemaValidacion[] {
  if (!sec.activo) return [];
  if (sec.tipo === 'navbar' || sec.tipo === 'footer') return [];
  return validarTipo(sec.tipo as TipoSeccion, sec.datos ?? {});
}

export function validarSecciones(secciones: Seccion[]): ResultadoValidacionSeccion[] {
  return secciones
    .map(sec => ({ seccionId: sec.id, tipo: sec.tipo as TipoSeccion, problemas: validarSeccion(sec) }))
    .filter(r => r.problemas.length > 0);
}

export function hayProblemaBloqueante(resultados: ResultadoValidacionSeccion[]): boolean {
  return resultados.some(r => r.problemas.some(p => p.severidad === 'bloqueante'));
}

// ── Casos límite documentados (ver CLAUDE.md de esta fase, punto pedido
// explícitamente: "si encontrás un caso donde mi supuesto está mal,
// documentalo y ajustá el criterio") ─────────────────────────────────────
//
// 1. `productos_destacados`: el supuesto de la spec es correcto en la
//    práctica pero por una razón distinta a la esperada — NO existe un
//    fallback que traiga "los más vendidos" automáticamente si no se
//    seleccionan productos (`datos.productos_ids` vacío ⇒ la query queda
//    `enabled: false` y la grilla de productos queda vacía, ver
//    SeccionProductosDestacados en HomeSecciones.tsx). Pero el bloque NUNCA
//    queda 100% en blanco: el título ("Lo más vendido" por default) y el
//    link "Ver todos" se siguen renderizando siempre. Como el criterio de
//    "bloqueante" es "no renderizaría nada visible", este tipo se deja sin
//    validación bloqueante tal como pide la spec — pero no por tener un
//    fallback automático de productos (no lo tiene), sino porque el título
//    fijo alcanza para que la sección nunca esté vacía de contenido visible.
//
// 2. `galeria_combos`: si el backend devuelve 0 combos reales (todavía no
//    hay diseños de clientes ni combos de ejemplo cargados por el admin),
//    el componente SÍ retorna null y la sección queda 100% invisible — un
//    caso real de "sección objetivamente vacía". No se agrega como
//    bloqueante de todas formas: a diferencia del resto de las reglas
//    bloqueantes (que validan un campo de `datos` que el admin edita acá
//    mismo, en este editor), acá no hay ningún campo en el editor que
//    garantice combos > 0 — depende de datos vivos del backend
//    (configurador / combos de ejemplo cargados en otra pantalla). Validar
//    esto en el frontend del builder no le daría al admin nada accionable
//    para "arreglar" desde acá, así que queda documentado como límite
//    conocido en vez de forzado a bloqueante.

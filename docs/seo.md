# SEO / indexación

Estado y decisiones para que Google indexe el sitio y los links compartidos
(WhatsApp, Instagram) muestren un preview decente. Auditoría del 2026-09-18.

## Diagnóstico (verificado contra prod)

- El sitio es una SPA (React + Vite + React Router declarativo). El HTML inicial
  era solo `<title>Mate Laser Studio</title>`: sin description, OG ni datos
  estructurados. `/robots.txt` y `/sitemap.xml` devolvían el `index.html` con 200.
- No había manejo de `<title>`/meta por ruta en todo `src/`.
- `www.` y el dominio raíz responden **ambos 200** (contenido duplicado).
- Cualquier URL inexistente devolvía 200 con pantalla en blanco (soft-404).
- Googlebot **sí** ejecuta JavaScript: lo que más pesa en un sitio nuevo es que no
  tiene cómo descubrirlo (sin sitemap, sin Search Console, pocos links).

## Fase 1 — hecha (rama `feat/seo-fase-1`)

| Qué | Dónde |
|---|---|
| `robots.txt` (bloquea admin/carrito/checkout/pago/mi-cuenta/login…, apunta al sitemap) | `public/robots.txt` |
| Sitemap de respaldo (rutas fijas) | `public/sitemap.xml` |
| Sitemap real con productos + categorías, generado en el build de Docker | `scripts/sitemap.mjs` + `RUN` en `Dockerfile` |
| description/OG/Twitter genéricos + JSON-LD `Organization` | `index.html` |
| Plantillas de title/description/JSON-LD Product (puras, testeadas) | `src/lib/seo.ts` |
| Aplica el meta al `<head>` y lo restaura al salir de la página | `src/hooks/usePageMeta.ts` |
| Pantalla "no encontrada" con noindex (catch-all) | `src/pages/NoEncontrada.tsx` |
| Cableado | `Home`, `Productos`, `ProductoDetalle`, `PaginaEstatica`, `App` |
| Tests | `e2e/seo-utils.spec.ts`, `e2e/sitemap-script.spec.ts`, `e2e/seo-meta.spec.ts` |

### Trampas que ya se pisaron (no repetir)

- **Nada de `canonical`, `og:url` ni `og:image` estáticos en `index.html`.** Ese
  archivo se sirve para *todas* las URLs: un canonical fijo declararía cada página
  como duplicado de una sola. Los pone cada página con `usePageMeta`. Lo protege un
  test en `seo-utils.spec.ts`.
- **No usar el hoisting de React 19** (`<title>`/`<meta>` en el JSX): agregaría un
  segundo tag al lado de los de `index.html`, y con dos canonical Google ignora ambos.
  `usePageMeta` hace upsert imperativo → siempre queda una sola copia.
- **`serve` no permite headers por ruta del SPA** (`serve.json` matchea contra el
  archivo servido, `index.html`, no contra la URL) **e ignora páginas prerenderizadas
  por directorio** con `-s`. Probado en local. Por eso el SEO por URL del lado
  servidor exige reemplazar `serve` (Fase 2).
- Un **error de red/5xx de la API no marca noindex** en la PDP; solo un 404 real.
- `String.fromCharCode` / doble barra para U+2028/2029: escribirlos como ` `
  en un archivo terminó como el carácter literal y rompió el `tsc`.
- `npm run build` local antes de deployar: el CI no corre `tsc -b` del frontend, el
  primer que lo ve es el deploy a Fly.

## Pendiente de Tami (fuera del código)

Por impacto/esfuerzo (criterio de cm-marketing):

1. **Confirmar teléfono, un solo mail y dirección.** En la config del admin hoy hay
   placeholders (`tienda_telefono` = `+54 11 0000-0000`, dos mails distintos, sin
   calle/ciudad). Hasta entonces **no** se publican en datos estructurados.
2. **Google Search Console**: verificar el dominio, enviar `sitemap.xml` y pedir
   indexación de la home — **recién con la Fase 1 deployada**.
3. Link al sitio en la bio de Instagram (mismo nombre exacto).
4. Perfil de **Google Business Profile** (taller en CABA): la señal más fuerte para
   diferenciarse del aparato de terapia "MateLaser". Verificar tarda: empezar ya.
5. **Foto para compartir (`og:image`)**: un mate y una bombilla grabados, láser
   nítido, fondo cálido neutro, logo chico en una esquina, contenido centrado
   (WhatsApp recorta), 1200×630, < 300 KB. Va en `public/` y se referencia en
   `index.html`. Hoy no hay og:image genérico (la PDP sí usa la 1ª foto del producto).
6. Descripciones propias para los ~10 productos principales (34 de 44 hoy están
   vacías; la meta description sale de una plantilla).
7. **www → raíz**: Regla de redirect 301 en Cloudflare (preservando path y query;
   probar con 302 y pasar a 301). Antes confirmar `FRONTEND_URL` de prod (back_urls
   de Mercado Pago), el dominio registrado del Brick y que el smoke test
   (`.github/workflows/deploy.yml`, apunta a `www`) se cambie en el mismo PR. Los
   usuarios que entraban por www pierden la sesión una vez (localStorage por origen).
8. Si el repo de GitHub es público sin necesidad, pasarlo a privado (aparece en
   `site:` y compite con el sitio).

## Fase 2 — server propio (no hecha)

Reemplazar `npx serve` por un server Node mínimo (con `serve-handler`, mismos
headers de `serve.json`) que por request:

- inyecta el `<head>` correcto (title/description/canonical/OG/JSON-LD) para
  `/`, `/productos`, `/productos/:slug` y las páginas estáticas, consultando la API
  con cache TTL en memoria + stale-if-error;
- sirve `/sitemap.xml` dinámico;
- devuelve **404 real** para slugs inexistentes (siempre sirviendo el shell para
  que el cliente muestre su pantalla), y `X-Robots-Tag: noindex` en rutas privadas;
- **fail-open**: si la API falla o tarda, sirve el `index.html` plano.

Checklist de `arquitecto` (2026-09-18):

- **Health check**: `/healthz` propio, sin depender de la API (hoy `GET /`, con
  check de 5 s). Timeout de fetch a la API ≤ 1,5 s.
- **Cold start**: `min_machines_running = 1` (~US$2/mes). WhatsApp/IG no
  reintentan; con `0` el primer preview puede fallar. Actualizar el comentario de
  `fly.toml`. Cloudflare no cachea HTML por defecto.
- **Allowlist de rutas**: solo `/`, `/productos`, `/productos/:slug` y las páginas
  estáticas consultan la API. `/pago`, `/confirmacion`, `/auth/*`, `/checkout`,
  `/mi-cuenta`, `/admin` reciben el shell plano con `noindex` y `no-store`, sin
  tocar la query. No se toca lógica de pagos.
- **No loguear la query** de `/auth/google/callback` (trae `token` y
  `refreshToken`; ver hallazgo aparte de seguridad).
- **Headers**: cargar `headers` de `serve.json` una sola vez y aplicarlos a
  `serve-handler` *y* a las respuestas HTML inyectadas (si no, se pierde la CSP).
  Replicar la compresión que hoy hace `serve`.
- **404**: solo con lista fresca donde falta el slug, tras un refetch limitado. Un
  error de API nunca da 404. Resolver slugs contra la lista cacheada, paginando.
- **Seguridad**: escapar `& < > " '` en atributos; en JSON-LD usar
  `serializarJsonLd` (`<` → `<`, U+2028/9); descripción Markdown → texto plano
  (`aTextoPlano`); `og:image` solo https; slug con regex y largo máximo, nunca
  para armar rutas de archivo; `index.html` se lee una vez al arrancar; canonical y
  `og:url` salen de `SITE_URL` (env) + slug de la API, **nunca** de `Host` ni del
  path; clave de cache = slug (sin query), LRU acotado, TTL corto para negativos,
  single-flight. Testear con fixtures `"><script>` y `</script>`.
- El JSON-LD inyectado por el server debe llevar `data-seo="pagina"` (el mismo
  marcador de `usePageMeta`) para que el cliente lo **reemplace** y no lo duplique.
- Cambiar el smoke test post-deploy en el mismo PR que la redirección www → raíz.

## Fase 3 — opcional

- Snapshot HTML del contenido para bots sin JS.
- Landing indexable `/empresas` ("regalos empresariales con mate grabado", CTA a
  WhatsApp); la cartelería LED va aparte y solo con fotos reales.
- Google Merchant Center: postergado hasta tener descripciones de los productos
  principales, contactos reales y política de devoluciones (las licencias y los
  productos personalizados sin GTIN generan rechazos).
- URLs de categoría por slug (`/categoria/:slug`) en vez de `?categoria_id=N`.

## Decisiones de contenido (cm-marketing)

- Title ≤ 60, description ≤ 155. Si el title con marca no entra, se saca la marca
  antes que el nombre del producto.
- "con grabado láser" solo donde el producto/categoría es apto (`apto_grabado`).
- Keywords: para regalo, "mate personalizado" / "mate grabado con nombre"; para uso
  propio, "bombilla de alpaca" / "mate imperial". "Mates personalizados" a secas lo
  domina Mercado Libre: ir por long-tail.
- **A decidir por Tami**: cm-marketing pidió dejar Messi/Maradona/Selección fuera
  de los titles por marca registrada. Hoy los nombres de producto van tal cual en
  el title de su PDP (p. ej. "Llavero Messi | Mate Laser Studio"); no se filtran.

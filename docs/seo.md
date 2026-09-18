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
| description/OG/Twitter genéricos + imagen de marca para compartir (1200×630) | `index.html` + `public/og-default.png` |
| JSON-LD `Organization` alimentado desde el admin | valor base en `index.html`; `jsonLdOrganizacion` en `src/lib/seo.ts`; `src/hooks/useOrganizacionSeo.ts` (montado en `Layout`) |
| Plantillas de title/description/JSON-LD Product (puras, testeadas) | `src/lib/seo.ts` |
| Aplica el meta al `<head>` y lo restaura al salir de la página | `src/hooks/usePageMeta.ts` |
| Pantalla "no encontrada" con noindex (catch-all) | `src/pages/NoEncontrada.tsx` |
| Cableado | `Home`, `Productos`, `ProductoDetalle`, `PaginaEstatica`, `App` |
| Tests | `e2e/seo-utils.spec.ts`, `e2e/sitemap-script.spec.ts`, `e2e/seo-meta.spec.ts` |

### Qué se actualiza solo y qué no

| Dato | ¿Solo? |
|---|---|
| Nombre, descripción, fotos, precio y stock de productos; nombre de categorías (title, description, JSON-LD Product) | **Sí** — salen de la API en cada render; Google lo toma en su próximo rastreo |
| Título de las páginas estáticas (Nosotros, FAQ…) | **Sí** (admin). Su *description* está fija en `App.tsx` |
| Organization: nombre (`tienda_nombre`), descripción (`tienda_descripcion`), teléfono (`telefono_contacto`, el del botón de WhatsApp), mail (`email_contacto`, "Email de contacto"), y redes / mail / teléfono del bloque Footer (este último tiene prioridad) | **Sí**, desde el admin (cache de la API 2 min + 5 min del cliente) |
| Sitemap: productos y categorías nuevos | **Solo en cada deploy**, hasta la Fase 2 |
| Title/description de la home, plantillas de title/description, imagen de marca, logo | **No**: están en código (`src/lib/seo.ts`, `index.html`, `public/`); cambian con un deploy |
| Dirección | **Nunca** se publica sola: los `origen_*` de la config son el origen de los envíos, no un dato público |

Regla del JSON-LD de Organization: se publica solo lo que el negocio cargó a
propósito en el admin. Teléfono: el del footer si lo completó, si no
`telefono_contacto`. Mail: el del footer si lo completó, si no `email_contacto`
(Configuración → pestaña Tienda → "Email de contacto"; **no** se muestra en el
sitio). `tienda_email` **nunca** se usa: es un valor de ejemplo de la config de
fábrica. Un teléfono placeholder (`+54 11 0000-0000`) o sin código de país se
descarta. Si el negocio completa "Contacto directo" en el footer, además se muestra
en el sitio. Los cambios de config quedan en borrador hasta "Publicar".

### Trampas que ya se pisaron (no repetir)

- **Nada de `canonical` ni `og:url` estáticos en `index.html`.** Ese archivo se sirve
  para *todas* las URLs: un canonical fijo declararía cada página como duplicado de
  una sola. Los pone cada página con `usePageMeta`. Lo protege un test en
  `seo-utils.spec.ts`. El `og:image` estático sí está: es la imagen de marca por
  defecto (la ficha de producto la pisa con su foto y el hook la restaura al salir).
- **No usar el hoisting de React 19** (`<title>`/`<meta>` en el JSX): agregaría un
  segundo tag al lado de los de `index.html`, y con dos canonical Google ignora ambos.
  `usePageMeta` hace upsert imperativo → siempre queda una sola copia.
- **`serve` no permite headers por ruta del SPA** (`serve.json` matchea contra el
  archivo servido, `index.html`, no contra la URL) **e ignora páginas prerenderizadas
  por directorio** con `-s`. Probado en local. Por eso el SEO por URL del lado
  servidor exige reemplazar `serve` (Fase 2).
- Un **error de red/5xx de la API no marca noindex** en la PDP; solo un 404 real.
- Escribir los escapes unicode de los separadores de línea (U+2028 y U+2029) en un
  archivo con la tool Write los convierte en el carácter literal y rompe el `tsc`:
  usar `String.fromCharCode(0x2028)` (ver `serializarJsonLd`).
- `npm run build` local antes de deployar: el CI no corre `tsc -b` del frontend, el
  primer que lo ve es el deploy a Fly.

## Pendiente de Tami (fuera del código)

Por impacto/esfuerzo (criterio de cm-marketing):

1. ~~Confirmar datos de contacto~~ — confirmados por Tami (2026-09-18): teléfono
   `telefono_contacto` y mail **matelaserstudio@gmail.com**. Falta cargar el mail en
   Configuración → Tienda → "Email de contacto" y **Publicar**: hoy ese campo tiene
   matelaserstudio@outlook.com.ar, que se publicaría en Google si se deploya antes.
   Verificar con `curl https://api.matelaserstudio.com.ar/api/v1/configuracion`
   (campo `email_contacto`).
2. **Google Search Console**: verificar el dominio, enviar `sitemap.xml` y pedir
   indexación de la home — **recién con la Fase 1 deployada**.
3. Link al sitio en la bio de Instagram (mismo nombre exacto).
4. Perfil de **Google Business Profile** (taller en CABA): la señal más fuerte para
   diferenciarse del aparato de terapia "MateLaser". Verificar tarda: empezar ya.
5. ~~Imagen para compartir~~ — hecha con el logo que mandó Tami (`public/og-default.png`,
   1200×630, 130 KB). Mejora opcional (cm-marketing): una foto real de un mate y una
   bombilla grabados, con el logo chico en una esquina, convierte más que un logo solo.
6. Descripciones propias para los ~10 productos principales (34 de 44 hoy están
   vacías; la meta description sale de una plantilla).
7. **Redirect www → raíz** (Cloudflare → Rules → Redirect Rules). Hoy los dos hosts
   responden 200. Verificado el 2026-09-18: la CORS de la API permite ambos y el smoke
   test del Brick de Mercado Pago (`npm run test:smoke`) **pasa contra los dos hosts**,
   así que redirigir a la raíz no rompe el checkout **en modo TEST**. Al pasar a
   credenciales de producción de MP, repetir `SMOKE_BASE_URL=<host final> npm run test:smoke`
   y revisar el dominio registrado en el panel de MP.
   - Regla: Hostname *equals* `www.matelaserstudio.com.ar` → redirect dinámico
     `concat("https://matelaserstudio.com.ar", http.request.uri.path)`, **preservar query
     string**, primero 302 y pasar a 301 tras probar (el 301 se cachea).
   - Cambiar `SMOKE_BASE_URL` de `.github/workflows/deploy.yml` (hoy `www`) a la raíz:
     verificado que pasa en ambos, se puede hacer antes o después del redirect.
   - Los usuarios que entraban por www pierden la sesión una vez (localStorage por origen).
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

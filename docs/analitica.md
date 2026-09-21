# Analítica de navegación (Umami)

Umami Cloud cuenta visitas sin cookies (ver `src/lib/analytics.ts`: el script se
inyecta **solo en producción** y solo si hay `VITE_UMAMI_WEBSITE_ID`). Sobre eso
hay 3 eventos propios para entender cómo se navega por categorías. Se leen en
Umami → **Events** → click en el evento → pestaña **Properties**, donde se
agrupa por el valor de cada propiedad.

Sin datos personales: solo nombres/ids de categorías y el lugar de la interfaz.
Si Umami no cargó (dev, bloqueador de anuncios, click antes de la carga)
`track()` no hace nada y la interfaz sigue igual.

## `nav_categoria_click`

Alguien eligió una categoría (o "todas") desde algún lugar de la interfaz.

| Propiedad | Valores |
|---|---|
| `origen` | `navbar_link` (link de la barra, ej. "Diseños") · `navbar_panel` (panel ancho de Productos) · `navbar_submenu` (desplegable de una categoría raíz) · `menu_mobile` (hamburguesa) · `sidebar` (filtros en desktop) · `drawer` (filtros en mobile) · `chips` (chips sobre la grilla en mobile) · `migas` (breadcrumb de la ficha) |
| `categoria` | nombre de la categoría, o `todos` ("Todos", "Ver todos los productos", link a `/productos`) |
| `categoria_id` | id de la categoría (no viene con `todos`) |
| `nivel` | `raiz` · `hija` · `todos` |

Esto reemplaza al `filtro_categoria_aplicado` que se había propuesto: sería el
mismo dato (elegir categoría en el catálogo = `origen` `sidebar`/`drawer`/`chips`).

**Cómo usarlo:** agrupar por `categoria` para ver qué categorías atraen más
(Mates vs Diseños, etc.); agrupar por `origen` para ver qué navegación se usa
de verdad (¿el panel ancho o el sidebar?). Sirve para decidir el orden y qué
destacar en el menú.

No cuenta: el primer toque en tablet que solo abre un desplegable (no navega),
ni los links a otras secciones (Taller, Nosotros…).

## `nav_desplegable_abre`

Se abrió un desplegable del navbar (desktop/tablet).

| Propiedad | Valores |
|---|---|
| `menu` | etiqueta del link: `Productos`, `Diseños`… |
| `via` | `mouse` (hover) · `toque` · `teclado` · `click` (chevron) |

**Cómo usarlo:** comparar `nav_desplegable_abre` contra los `nav_categoria_click`
con origen `navbar_panel`/`navbar_submenu`: si el panel se abre mucho y se
clickea poco, la gente pasa el mouse de casualidad o el contenido no sirve. El
hover cuenta cada apertura (a los 120 ms de estar sobre el link), no cada pasada.

## `categoria_vacia_vista`

Alguien llegó a una categoría que no tiene productos ("No hay productos").

| Propiedad | Valores |
|---|---|
| `categoria` | nombre, o `desconocida` si el id no existe |
| `categoria_id` | id |

Solo se dispara cuando la categoría es el único filtro (con búsqueda o
"aptos para grabar" el 0 puede ser de la combinación). Una vez cada vez que se
llega a esa categoría. Como el menú y los filtros ocultan las categorías vacías, esto solo
debería ocurrir por links viejos o compartidos: si aparece seguido, hay un link
apuntando a una categoría que se vació.

## Dónde está en el código

- `src/lib/analytics.ts`: `track`, `trackCategoriaClick`, `trackEnlaceCatalogo`
  y el tipo `OrigenCategoria` (si se agrega un lugar nuevo, sumarlo ahí).
- Disparadores: `Navbar.tsx`, `MegaMenuCategorias.tsx`, `SubmenuCategoria.tsx`,
  `MenuMobileLinks.tsx`, `Productos.tsx`, `MigasProducto.tsx`.
- Tests: `e2e/analitica-categorias.spec.ts` (stub de `window.umami`).

## Fuera de alcance (posible próxima tanda)

Los clicks a categorías desde los bloques de la Home (`categorias_grid`,
`filtros_rapidos`) todavía no se miden: son otra puerta de entrada importante.

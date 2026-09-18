import { useEffect } from 'react';
import { serializarJsonLd, type PageMeta } from '../lib/seo';

// Aplica el PageMeta de la página al <head> y lo revierte al desmontar.
//
// Es un upsert imperativo (busca el tag; si existe lo actualiza, si no lo crea)
// y NO el hoisting nativo de React 19 (<title>/<meta> dentro del JSX) a
// propósito: index.html ya trae description/OG estáticos, y el hoisting
// agregaría un segundo tag al lado. Con <link rel="canonical"> duplicado
// Google ignora los dos. Acá siempre queda exactamente uno de cada.
//
// Idempotente bajo StrictMode (setup → cleanup → setup) y seguro ante cambios
// de ruta: React corre el cleanup de la página que se va antes que el setup de
// la que llega, así cada cleanup restaura el estado base del index.html.
//
// Fase 2: si el servidor inyecta estos mismos tags, el hook los actualiza en
// vez de duplicarlos — por eso el JSON-LD lleva data-seo="pagina" (el server
// debe usar el mismo marcador).

export type Restaurar = () => void;

function upsertMeta(atributo: 'name' | 'property', clave: string, contenido: string): Restaurar {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${clave}"]`);
  const creado = el === null;
  const previo = el?.getAttribute('content') ?? null;
  if (el === null) {
    el = document.createElement('meta');
    el.setAttribute(atributo, clave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenido);
  const nodo = el;
  return () => {
    if (creado) nodo.remove();
    else if (previo !== null) nodo.setAttribute('content', previo);
  };
}

function upsertCanonical(href: string): Restaurar {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const creado = el === null;
  const previo = el?.getAttribute('href') ?? null;
  if (el === null) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  const nodo = el;
  return () => {
    if (creado) nodo.remove();
    else if (previo !== null) nodo.setAttribute('href', previo);
  };
}

// Cada bloque de JSON-LD lleva un marcador data-seo: "pagina" (lo que declara
// la página actual: Product…) y "organizacion" (el de index.html, que
// useOrganizacionSeo actualiza con los datos del admin).
export function upsertJsonLd(marca: 'pagina' | 'organizacion', datos: Record<string, unknown>[]): Restaurar {
  let el = document.head.querySelector<HTMLScriptElement>(
    `script[type="application/ld+json"][data-seo="${marca}"]`,
  );
  const creado = el === null;
  const previo = el?.textContent ?? null;
  if (el === null) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo', marca);
    document.head.appendChild(el);
  }
  el.textContent = serializarJsonLd(datos.length === 1 ? datos[0] : datos);
  const nodo = el;
  return () => {
    if (creado) nodo.remove();
    else nodo.textContent = previo;
  };
}

function setTitulo(titulo: string): Restaurar {
  const previo = document.title;
  document.title = titulo;
  return () => {
    document.title = previo;
  };
}

/** `null` = todavía no hay datos (cargando): no toca el <head>. */
export function usePageMeta(meta: PageMeta | null) {
  // Clave estable: los llamadores arman un objeto nuevo en cada render.
  const clave = meta ? JSON.stringify(meta) : '';

  useEffect(() => {
    if (!clave) return;
    const m = JSON.parse(clave) as PageMeta;
    const restaurar: Restaurar[] = [];

    restaurar.push(setTitulo(m.title));
    restaurar.push(upsertMeta('property', 'og:title', m.title));
    restaurar.push(upsertMeta('name', 'twitter:title', m.title));

    if (m.description) {
      restaurar.push(upsertMeta('name', 'description', m.description));
      restaurar.push(upsertMeta('property', 'og:description', m.description));
      restaurar.push(upsertMeta('name', 'twitter:description', m.description));
    }
    if (m.canonical) {
      restaurar.push(upsertCanonical(m.canonical));
      restaurar.push(upsertMeta('property', 'og:url', m.canonical));
    }
    if (m.ogType) restaurar.push(upsertMeta('property', 'og:type', m.ogType));
    if (m.image) {
      restaurar.push(upsertMeta('property', 'og:image', m.image));
      restaurar.push(upsertMeta('name', 'twitter:image', m.image));
      restaurar.push(upsertMeta('name', 'twitter:card', 'summary_large_image'));
    }
    if (m.noindex) restaurar.push(upsertMeta('name', 'robots', 'noindex, follow'));
    if (m.jsonLd?.length) restaurar.push(upsertJsonLd('pagina', m.jsonLd));

    return () => {
      for (const r of restaurar.reverse()) r();
    };
  }, [clave]);
}

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DESCRIPCION_HOME,
  MAX_DESCRIPCION,
  MAX_TITULO,
  TITULO_HOME,
  aTextoPlano,
  armarTitulo,
  jsonLdOrganizacion,
  limpiarTituloSeo,
  metaCategoria,
  metaHome,
  metaPaginaEstatica,
  metaProducto,
  normalizarTelefono,
  recortar,
  serializarJsonLd,
} from '../src/lib/seo';
import type { Producto } from '../src/types';

// SEO Fase 1 — lógica pura (sin browser): plantillas de title/description,
// JSON-LD de producto y guards sobre los archivos estáticos (index.html,
// robots.txt). Las plantillas salen de la consulta con cm-marketing.

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const producto = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    nombre: 'Mate Imperial de Algarrobo',
    slug: 'mate-imperial-de-algarrobo',
    descripcion: '',
    precio_base: 35000,
    apto_grabado: true,
    colores_disponibles: [],
    personalizado_habilitado: false,
    personalizado_max_chars: 0,
    disponible: true,
    activo: true,
    destacado: false,
    orden: 0,
    creado_en: '2026-01-01T00:00:00.000Z',
    ...extra,
  }) as unknown as Producto;

const DESC_LARGA =
  'Mate imperial de algarrobo con virola de acero inoxidable, curado a mano y listo para usar. Se puede grabar con tu nombre o diseño.';

test.describe('SEO — helpers de texto', () => {
  test('recortar nunca supera el máximo, corta en palabra y agrega …', () => {
    const largo = 'palabra '.repeat(40);
    const r = recortar(largo, 50);
    expect(r.length).toBeLessThanOrEqual(50);
    expect(r.endsWith('…')).toBe(true);
    expect(r).not.toMatch(/palabr…$/); // no parte una palabra a la mitad
    expect(recortar('  texto   corto ', 50)).toBe('texto corto');
  });

  test('aTextoPlano saca markdown y HTML', () => {
    expect(aTextoPlano('## Título\n\n**Negrita** y _cursiva_ con [un link](http://x.com) <b>html</b>\n- item uno')).toBe(
      'Título Negrita y cursiva con un link html item uno',
    );
    expect(aTextoPlano(null)).toBe('');
    expect(aTextoPlano(undefined)).toBe('');
  });

  test('limpiarTituloSeo: sin emoji y pasa TODO MAYÚSCULAS a oración', () => {
    expect(limpiarTituloSeo('EL TALLER Y NOSOTROS ❤️')).toBe('El taller y nosotros');
    expect(limpiarTituloSeo('DISEÑOS PREDETERMINADOS')).toBe('Diseños predeterminados');
    expect(limpiarTituloSeo('Cortes en MDF')).toBe('Cortes en MDF');
    expect(limpiarTituloSeo('Bombillones de Alpaca')).toBe('Bombillones de Alpaca');
  });

  test('armarTitulo devuelve el primer candidato que entra en 60 y recorta el último si ninguno entra', () => {
    expect(armarTitulo('corto | Marca', 'corto')).toBe('corto | Marca');
    const largo = 'x'.repeat(58);
    expect(armarTitulo(`${largo} | Marca`, largo)).toBe(largo);
    const enorme = 'palabra '.repeat(20);
    const t = armarTitulo(`${enorme} | Marca`, enorme);
    expect(t.length).toBeLessThanOrEqual(MAX_TITULO);
    expect(t.endsWith('…')).toBe(true);
  });

  test('serializarJsonLd escapa < (cierre de <script>) y los separadores de línea U+2028/2029', () => {
    const out = serializarJsonLd({ n: `</script><img onerror=x>${LS}fin${PS}` });
    expect(out).not.toContain('<');
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    // Sigue siendo JSON válido y devuelve el mismo valor.
    expect(JSON.parse(out).n).toBe(`</script><img onerror=x>${LS}fin${PS}`);
  });
});

test.describe('SEO — plantillas por tipo de página', () => {
  test('home: title ≤ 60, description ≤ 155, canónico = raíz del dominio', () => {
    const m = metaHome();
    expect(m.title).toBe(TITULO_HOME);
    expect(m.title.length).toBeLessThanOrEqual(MAX_TITULO);
    expect(m.description!.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
    expect(m.canonical).toBe('https://matelaserstudio.com.ar/');
  });

  test('categoría: promete "grabado láser" solo si hay productos aptos', () => {
    const con = metaCategoria('Mates de Algarrobo', 6, true);
    expect(con.title).toBe('Mates de Algarrobo con grabado láser | Mate Laser Studio');
    expect(con.description).toContain('grabado láser');
    expect(con.canonical).toBe('https://matelaserstudio.com.ar/productos?categoria_id=6');

    const sin = metaCategoria('CANASTAS MATERAS', 14, false);
    expect(sin.title).toBe('Canastas materas | Mate Laser Studio');
    expect(sin.title + sin.description).not.toMatch(/grabado/i);
  });

  test('categoría con nombre larguísimo: el title sigue entrando en 60', () => {
    const m = metaCategoria('Bombillones de acero inoxidable y alpaca cincelada artesanal', 1, true);
    expect(m.title.length).toBeLessThanOrEqual(MAX_TITULO);
    expect(m.description!.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
  });

  test('página estática: sin emoji en el title y canonical sin barra final', () => {
    const m = metaPaginaEstatica('EL TALLER Y NOSOTROS ❤️', 'Desc.', '/nosotros/');
    expect(m.title).toBe('El taller y nosotros | Mate Laser Studio');
    expect(m.canonical).toBe('https://matelaserstudio.com.ar/nosotros');
    expect(m.description).toBe('Desc.');
  });
});

test.describe('SEO — metaProducto', () => {
  test('con descripción propia: title "Nombre | Marca", description = la del producto, canonical y og:image https', () => {
    const m = metaProducto(
      producto({
        descripcion: DESC_LARGA,
        categorias: { id: 6, nombre: 'Mates de Algarrobo' },
        material: 'Algarrobo',
        imagenes_producto: [
          { id: 'a', url: 'http://inseguro.example/a.jpg', alt_texto: '', orden: 0 },
          { id: 'b', url: 'https://cdn.example/b.webp', alt_texto: '', orden: 1 },
          { id: 'c', url: '/relativa.jpg', alt_texto: '', orden: 2 },
        ],
      }),
    );
    expect(m.title).toBe('Mate Imperial de Algarrobo | Mate Laser Studio');
    // DESC_LARGA entra entera en 155: no se recorta.
    expect(DESC_LARGA.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
    expect(m.description).toBe(DESC_LARGA);
    expect(m.canonical).toBe('https://matelaserstudio.com.ar/productos/mate-imperial-de-algarrobo');
    expect(m.ogType).toBe('product');
    expect(m.image).toBe('https://cdn.example/b.webp'); // solo https

    const ld = m.jsonLd![0] as Record<string, any>;
    expect(ld['@type']).toBe('Product');
    expect(ld.name).toBe('Mate Imperial de Algarrobo');
    expect(ld.image).toEqual(['https://cdn.example/b.webp']);
    expect(ld.category).toBe('Mates de Algarrobo');
    expect(ld.material).toBe('Algarrobo');
    expect(ld.offers).toMatchObject({
      '@type': 'Offer',
      price: 35000,
      priceCurrency: 'ARS',
      availability: 'https://schema.org/InStock',
    });
  });

  test('descripción larga en Markdown: la meta se recorta a 155 en texto plano; el JSON-LD a 500', () => {
    const md = `## Detalle\n\n${'Mate **artesanal** de algarrobo curado a mano. '.repeat(30)}`;
    const m = metaProducto(producto({ descripcion: md }));
    expect(m.description!.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
    expect(m.description!.endsWith('…')).toBe(true);
    expect(m.description).not.toMatch(/[*#]/);
    const ld = m.jsonLd![0] as Record<string, any>;
    expect(ld.description.length).toBeLessThanOrEqual(500);
    expect(ld.description).not.toMatch(/[*#]/);
  });

  test('sin descripción y apto para grabado: usa la plantilla con "grabado láser"', () => {
    const m = metaProducto(producto());
    // Con la marca serían 64 caracteres: se sacrifica la marca, no el producto.
    expect(m.title).toBe('Mate Imperial de Algarrobo con grabado láser');
    expect(m.description).toMatch(/^Mate Imperial de Algarrobo\. Grabado láser personalizado/);
    expect(m.description!.length).toBeLessThanOrEqual(MAX_DESCRIPCION);

    // Con nombre corto la marca sí entra.
    expect(metaProducto(producto({ nombre: 'Llavero Corazón' })).title).toBe(
      'Llavero Corazón con grabado láser | Mate Laser Studio',
    );
  });

  test('sin descripción y NO apto: no promete grabado láser en ningún lado', () => {
    const m = metaProducto(producto({ apto_grabado: false, nombre: 'Canasta Eco Cuero' }));
    expect(m.title).toBe('Canasta Eco Cuero | Mate Laser Studio');
    expect(`${m.title} ${m.description}`).not.toMatch(/grabad/i);
  });

  test('nombre TODO MAYÚSCULAS: el title lo normaliza pero el JSON-LD conserva el nombre real', () => {
    const m = metaProducto(producto({ nombre: 'LLAVERO CORAZÓN', descripcion: DESC_LARGA }));
    expect(m.title).toBe('Llavero corazón | Mate Laser Studio');
    expect((m.jsonLd![0] as Record<string, unknown>).name).toBe('LLAVERO CORAZÓN');
  });

  test('nombre larguísimo: el title entra en 60 sacrificando la marca antes que el nombre', () => {
    const m = metaProducto(producto({ nombre: 'Mate Imperial de Calabaza con Virola de Alpaca Cincelada Borravino' }));
    expect(m.title.length).toBeLessThanOrEqual(MAX_TITULO);
    expect(m.title).toContain('Mate Imperial de Calabaza');
  });

  test('slug con caracteres raros va codificado en el canonical', () => {
    expect(metaProducto(producto({ slug: 'mate ñandú/x' })).canonical).toBe(
      'https://matelaserstudio.com.ar/productos/mate%20%C3%B1and%C3%BA%2Fx',
    );
  });

  test('variantes con distinto precio: AggregateOffer solo entre las comprables', () => {
    const m = metaProducto(
      producto({
        tipos_opcion: [{ id: 't1', nombre: 'Color', orden: 0, valores: [] }],
        variantes_producto: [
          { id: 'v1', precio_override: null, disponible: true }, // = base 35000
          { id: 'v2', precio_override: 42000, disponible: true },
          { id: 'v3', precio_override: 10000, disponible: false }, // agotada: no cuenta
        ],
      }),
    );
    expect((m.jsonLd![0] as Record<string, any>).offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: 35000,
      highPrice: 42000,
      offerCount: 2,
      availability: 'https://schema.org/InStock',
    });
  });

  test('todas las variantes agotadas: OutOfStock', () => {
    const m = metaProducto(
      producto({
        tipos_opcion: [{ id: 't1', nombre: 'Color', orden: 0, valores: [] }],
        variantes_producto: [{ id: 'v1', precio_override: null, disponible: false }],
      }),
    );
    expect((m.jsonLd![0] as Record<string, any>).offers.availability).toBe('https://schema.org/OutOfStock');
  });

  test('producto sin variantes ignora filas huérfanas de variantes_producto', () => {
    const m = metaProducto(
      producto({ tipos_opcion: [], variantes_producto: [{ id: 'huerfana', precio_override: 1, disponible: true }] }),
    );
    expect((m.jsonLd![0] as Record<string, any>).offers).toMatchObject({ '@type': 'Offer', price: 35000 });
  });

  test('producto sin stock: OutOfStock', () => {
    const m = metaProducto(producto({ disponible: false }));
    expect((m.jsonLd![0] as Record<string, any>).offers.availability).toBe('https://schema.org/OutOfStock');
  });
});

test.describe('SEO — Organization desde el admin', () => {
  test('sin datos: valores base, sin contacto ni dirección', () => {
    const org = jsonLdOrganizacion();
    expect(org).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://matelaserstudio.com.ar/#organizacion',
      name: 'Mate Laser Studio',
      url: 'https://matelaserstudio.com.ar/',
      logo: 'https://matelaserstudio.com.ar/logo-mls.png',
      sameAs: ['https://instagram.com/matelaserstudio'],
    });
    expect(org).not.toHaveProperty('contactPoint');
    expect(org).not.toHaveProperty('address');
  });

  test('nombre y descripción salen de la config del admin (la descripción solo si es real)', () => {
    const conDatos = jsonLdOrganizacion({
      config: { tienda_nombre: '  Otra Marca ', tienda_descripcion: 'Una descripción propia bastante larga.' },
    });
    expect(conDatos).toMatchObject({ name: 'Otra Marca', description: 'Una descripción propia bastante larga.' });

    const corta = jsonLdOrganizacion({ config: { tienda_nombre: '', tienda_descripcion: 'corta' } });
    expect(corta.name).toBe('Mate Laser Studio');
    expect(corta.description).toMatch(/^Taller de grabado láser/);
  });

  test('teléfono: normaliza el de la config y rechaza placeholders y números ambiguos', () => {
    expect(normalizarTelefono('+54 11 2744-4565')).toBe('+541127444565');
    expect(normalizarTelefono('+541127444565')).toBe('+541127444565');
    expect(normalizarTelefono('541127444565')).toBe('+541127444565');
    expect(normalizarTelefono('+54 11 0000-0000')).toBeNull(); // placeholder del admin
    expect(normalizarTelefono('11 2744-4565')).toBeNull(); // sin código de país: ambiguo
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
    expect(normalizarTelefono(541127444565)).toBeNull(); // no es string

    const org = jsonLdOrganizacion({ config: { telefono_contacto: '+541127444565' } });
    expect(org.contactPoint).toEqual({
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'AR',
      availableLanguage: 'es',
      telephone: '+541127444565',
    });
    // El placeholder no genera contactPoint.
    expect(jsonLdOrganizacion({ config: { telefono_contacto: '+54 11 0000-0000' } })).not.toHaveProperty('contactPoint');
  });

  test('el teléfono/mail del footer (lo que ve el cliente) tiene prioridad sobre la config', () => {
    const org = jsonLdOrganizacion({
      config: { telefono_contacto: '+541127444565' },
      footer: { contacto: { telefono: '+54 9 11 5555-1234', email: 'ventas@ejemplo.com.ar' } },
    });
    expect(org.contactPoint).toMatchObject({ telephone: '+5491155551234', email: 'ventas@ejemplo.com.ar' });
  });

  test('mail: el del footer manda; si no, "Email de contacto" de la config; tienda_email (ejemplo de fábrica) nunca', () => {
    // Solo la config (Configuración → Tienda → Email de contacto).
    expect(jsonLdOrganizacion({ config: { email_contacto: 'matelaserstudio@gmail.com' } }).contactPoint).toMatchObject({
      email: 'matelaserstudio@gmail.com',
    });
    // El footer tiene prioridad sobre la config.
    expect(
      jsonLdOrganizacion({ config: { email_contacto: 'a@config.com' }, footer: { contacto: { email: 'b@footer.com' } } })
        .contactPoint,
    ).toMatchObject({ email: 'b@footer.com' });
    // Mail inválido en el footer: cae al de la config.
    expect(
      jsonLdOrganizacion({ config: { email_contacto: 'a@config.com' }, footer: { contacto: { email: 'no-es-un-mail' } } })
        .contactPoint,
    ).toMatchObject({ email: 'a@config.com' });
    // tienda_email (valor de ejemplo del seed) y valores inválidos: nada.
    const sinMail = jsonLdOrganizacion({
      config: { tienda_email: 'hola@matelaserstudio.com', email_contacto: 'no-es-un-mail' },
    });
    // Ningún patrón de mail (ojo: "@context"/"@type" del JSON-LD llevan @ pero sin texto antes).
    expect(JSON.stringify(sinMail)).not.toMatch(/[\w.+-]+@[\w-]+\./);
    expect(sinMail).not.toHaveProperty('contactPoint');
  });

  test('nunca publica la dirección: los origen_* son el origen de los envíos, no un dato público', () => {
    const org = jsonLdOrganizacion({
      config: { origen_calle: 'Calle Falsa 123', origen_ciudad: 'CABA', origen_cp: '1000', origen_provincia: 'CABA' },
      footer: { contacto: { direccion: 'Calle Falsa 123' } },
    });
    expect(org).not.toHaveProperty('address');
    expect(JSON.stringify(org)).not.toContain('Calle Falsa');
  });

  test('redes: solo https y solo redes conocidas; sin array usa el default; array vacío = sin sameAs', () => {
    const org = jsonLdOrganizacion({
      footer: {
        redes: [
          { href: 'https://www.instagram.com/otra_cuenta', label: '@otra_cuenta' },
          { href: 'https://facebook.com/otra', label: 'fb' },
          { href: 'http://instagram.com/insegura', label: 'http' },
          { href: 'javascript:alert(1)', label: 'xss' },
          { href: 'https://sitio-desconocido.com/x', label: 'otro' },
          { href: 'no-es-una-url', label: 'basura' },
          null,
        ],
      },
    });
    expect(org.sameAs).toEqual(['https://www.instagram.com/otra_cuenta', 'https://facebook.com/otra']);

    expect(jsonLdOrganizacion({ footer: {} }).sameAs).toEqual(['https://instagram.com/matelaserstudio']);
    expect(jsonLdOrganizacion({ footer: { redes: [] } })).not.toHaveProperty('sameAs');
  });
});

test.describe('SEO — archivos estáticos', () => {
  const raiz = process.cwd();
  const indexHtml = readFileSync(join(raiz, 'index.html'), 'utf8');

  test('index.html trae title/description = las constantes que usa la home', () => {
    expect(indexHtml).toContain(`<title>${TITULO_HOME}</title>`);
    expect(indexHtml).toContain(`<meta name="description" content="${DESCRIPCION_HOME}" />`);
    expect(indexHtml).toContain(`<meta property="og:title" content="${TITULO_HOME}" />`);
    expect(indexHtml).toContain(`<meta property="og:description" content="${DESCRIPCION_HOME}" />`);
  });

  test('index.html NO trae canonical ni og:url estáticos (se sirve para todas las URLs)', () => {
    // Un canonical fijo acá declararía TODAS las páginas como duplicado de una sola.
    expect(indexHtml).not.toMatch(/rel=["']canonical["']/);
    expect(indexHtml).not.toMatch(/property=["']og:url["']/);
  });

  test('index.html: og:image de marca (absoluta, https) apunta a un PNG real de 1200×630 y < 300 KB', () => {
    const og = indexHtml.match(/<meta property="og:image" content="([^"]+)" \/>/);
    const tw = indexHtml.match(/<meta name="twitter:image" content="([^"]+)" \/>/);
    expect(og).not.toBeNull();
    expect(tw![1]).toBe(og![1]);
    expect(og![1]).toBe('https://matelaserstudio.com.ar/og-default.png');
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image" />');

    const png = readFileSync(join(raiz, 'public', 'og-default.png'));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200); // ancho (chunk IHDR)
    expect(png.readUInt32BE(20)).toBe(630); // alto
    expect(png.length).toBeLessThan(300 * 1024);
  });

  test('index.html: el JSON-LD de Organization es el mismo que genera jsonLdOrganizacion() sin datos', () => {
    const m = indexHtml.match(/<script type="application\/ld\+json" data-seo="organizacion">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    // Lo que ve un crawler sin JS = lo que ve Google tras renderizar con la config vacía.
    expect(JSON.parse(m![1])).toEqual(jsonLdOrganizacion());
  });

  test('robots.txt: bloquea lo privado, deja abierto el catálogo y apunta al sitemap', () => {
    const robots = readFileSync(join(raiz, 'public', 'robots.txt'), 'utf8');
    const lineas = robots.split('\n').map((l) => l.trim());
    for (const ruta of ['/admin', '/carrito', '/checkout', '/pago/', '/confirmacion/', '/mi-cuenta', '/login', '/auth/']) {
      expect(lineas).toContain(`Disallow: ${ruta}`);
    }
    // Ni bloquear todo ni el catálogo.
    expect(lineas).not.toContain('Disallow: /');
    expect(lineas).not.toContain('Disallow: /productos');
    expect(lineas).toContain('Sitemap: https://matelaserstudio.com.ar/sitemap.xml');
  });
});

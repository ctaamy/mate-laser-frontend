// Cliente para la API Georef (datos.gob.ar) — provincias y localidades de Argentina.
// El checkout es un flujo crítico: si Georef falla o tarda, el caller debe caer a input libre
// en vez de trabar la compra. Por eso todo acá devuelve null en error/timeout, nunca lanza.

const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api';
const TIMEOUT_MS = 2500;
const PROVINCIAS_CACHE_KEY = 'mls_georef_provincias_v1';

export interface Provincia {
  id: string;
  nombre: string;
}

export interface Localidad {
  id: string;
  nombre: string;
  // Partido (Buenos Aires) o "CABA" — usado para resolver disponibilidad y precio
  // de logística privada contra cobertura_partidos/precios_zona. Undefined en
  // el resto de las provincias (esas zonas no existen fuera de CABA/GBA).
  partido?: string;
}

function esCABA(provinciaNombre: string): boolean {
  return provinciaNombre.trim().toLowerCase().startsWith('ciudad autónoma');
}

async function fetchConTimeout(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function obtenerProvincias(): Promise<Provincia[] | null> {
  try {
    const cached = localStorage.getItem(PROVINCIAS_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // localStorage no disponible o corrupto — seguimos con el fetch
  }

  const data = await fetchConTimeout(
    `${GEOREF_BASE}/provincias?campos=id,nombre&max=30&orden=nombre`
  );
  if (!data?.provincias) return null;

  // CABA como provincia propia (Georef ya la modela así, no como partido de Buenos Aires).
  const provincias: Provincia[] = data.provincias.map((p: any) => ({ id: p.id, nombre: p.nombre }));

  try {
    localStorage.setItem(PROVINCIAS_CACHE_KEY, JSON.stringify(provincias));
  } catch {
    // si no se puede cachear, no es crítico
  }

  return provincias;
}

export async function obtenerLocalidadesPorProvincia(provinciaNombre: string): Promise<Localidad[] | null> {
  if (!provinciaNombre) return null;

  const caba = esCABA(provinciaNombre);
  // "departamento" en Georef equivale a "partido" en la provincia de Buenos Aires.
  // Con aplanar=true, el objeto anidado departamento:{id,nombre} llega como departamento_nombre.
  const campos = caba ? 'id,nombre' : 'id,nombre,departamento';

  const data = await fetchConTimeout(
    `${GEOREF_BASE}/localidades?provincia=${encodeURIComponent(provinciaNombre)}&campos=${campos}&max=3000&orden=nombre&aplanar=true`
  );
  if (!data?.localidades) return null;

  // Deduplicar por nombre (Georef puede repetir la misma localidad en distintas fuentes/departamentos).
  const vistos = new Set<string>();
  const localidades: Localidad[] = [];
  for (const l of data.localidades) {
    if (vistos.has(l.nombre)) continue;
    vistos.add(l.nombre);
    localidades.push({
      id: l.id,
      nombre: l.nombre,
      partido: caba ? 'CABA' : (l.departamento_nombre || undefined),
    });
  }
  return localidades;
}

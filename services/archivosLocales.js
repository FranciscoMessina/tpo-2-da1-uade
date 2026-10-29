import { Directory, File, Paths } from 'expo-file-system';

// Todo lo que la app guarda como archivo vive bajo esta carpeta del almacenamiento
// persistente (Paths.document), separado por área y por cuenta:
//   hallado/cache/<usuario>/fotos/...    fotos de la caché de lectura
//   hallado/borradores/<usuario>/...     fotos del borrador del formulario
//   hallado/cola/<usuario>/<clientId>/   fotos de las publicaciones en cola
const RAIZ = 'hallado';

// Espera máxima de cada descarga y descargas simultáneas permitidas
const TIMEOUT_DESCARGA_MS = 20000;
const DESCARGAS_SIMULTANEAS = 2;

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

/** Deja un valor apto para usarlo como nombre de carpeta (solo letras, números, _ y -). */
export function segmentoSeguro(valor) {
  return String(valor).replace(/[^A-Za-z0-9_-]/g, '_') || '_';
}

// FNV-1a de 32 bits en hexadecimal
function fnv1a(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash corto y estable de un texto (dos pasadas para reducir colisiones). */
export function hashTexto(texto) {
  const entrada = String(texto);
  return fnv1a(entrada) + fnv1a(entrada.split('').reverse().join(''));
}

/** Extensión de imagen de una URI o URL (jpg si no se reconoce). */
export function extensionDeUri(uri) {
  const coincidencia = String(uri).match(/\.(png|webp|gif|jpe?g)(?:[?#]|$)/i);
  if (!coincidencia) return 'jpg';
  const extension = coincidencia[1].toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension;
}

/** Nombre de archivo determinístico para una URL: la misma URL cae siempre en el mismo archivo. */
export function nombreArchivoLocal(origen) {
  return `${hashTexto(origen)}.${extensionDeUri(origen)}`;
}

/** True si es una URI de archivo del dispositivo (file://). */
export function esUriLocal(uri) {
  return typeof uri === 'string' && /^file:\/\//i.test(uri);
}

/** True si la ruta apunta al directorio privado de pruebas (/uploads/pruebas), que nunca se guarda en el dispositivo. */
export function esRutaPrivada(url) {
  if (typeof url !== 'string') return false;

  let decodificada = url;
  try {
    decodificada = decodeURIComponent(url);
  } catch {
    // Si no se puede decodificar, se evalúa tal cual
  }

  const patron = /\/uploads\/pruebas(\/|\?|#|$)/i;
  return patron.test(url) || patron.test(decodificada);
}

/**
 * Una foto se puede descargar si es una imagen pública del propio backend
 * (`<baseUrl>/uploads/...`) y no pertenece a las pruebas privadas.
 */
export function esFotoDescargable(url, baseUrl) {
  if (typeof url !== 'string') return false;

  const base = String(baseUrl).replace(/\/+$/, '');
  if (!url.startsWith(`${base}/uploads/`)) return false;
  if (/\.\.|\\|%2e|%5c/i.test(url)) return false;

  return !esRutaPrivada(url);
}

/** De una lista de fotos, las que se pueden descargar (sin repetidas), hasta `maximo`. */
export function fotosDescargables(urls, baseUrl, maximo = Infinity) {
  if (!Array.isArray(urls)) return [];
  const unicas = [...new Set(urls.filter((url) => esFotoDescargable(url, baseUrl)))];
  return unicas.slice(0, maximo);
}

/**
 * Reemplaza cada URL por su copia local cuando existe.
 * `locales` es un mapa url -> uri local y `existe(uri)` confirma que el archivo sigue ahí.
 */
export function aplicarFotosLocales(fotos, locales, existe) {
  if (!Array.isArray(fotos)) return [];
  if (!locales || typeof locales !== 'object') return fotos;

  return fotos.map((foto) => {
    const local = locales[foto];
    return local && existe(local) ? local : foto;
  });
}

/** Conserva del mapa url -> uri solo las URLs que siguen en uso. */
export function conservarLocales(locales, fotos) {
  if (!locales || typeof locales !== 'object' || !Array.isArray(fotos)) return {};
  return Object.fromEntries(
    Object.entries(locales).filter(([url]) => fotos.includes(url))
  );
}

// ---------------------------------------------------------------------------
// Acceso al almacenamiento de archivos
// ---------------------------------------------------------------------------

function directorio(...segmentos) {
  return new Directory(Paths.document, RAIZ, ...segmentos.map(segmentoSeguro));
}

function asegurar(carpeta) {
  if (!carpeta.exists) carpeta.create({ intermediates: true, idempotent: true });
  return carpeta;
}

function prefijo(carpeta) {
  return `${carpeta.uri.replace(/\/+$/, '')}/`;
}

/** True si la URI pertenece al almacenamiento propio de la app (nunca se borra nada fuera de él). */
export function estaEnAlmacenApp(uri) {
  try {
    return typeof uri === 'string' && uri.startsWith(prefijo(directorio()));
  } catch {
    return false;
  }
}

/** True si la URI está dentro de la carpeta indicada. */
export function estaEnDirectorio(uri, ...segmentos) {
  try {
    return typeof uri === 'string' && uri.startsWith(prefijo(directorio(...segmentos)));
  } catch {
    return false;
  }
}

export function existeArchivo(uri) {
  try {
    return Boolean(uri) && new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * Copia un archivo (p. ej. la foto que devolvió el selector, que puede ser temporal)
 * a la carpeta indicada y devuelve la nueva URI. Si ya está en esa carpeta no la vuelve a copiar.
 */
export async function copiarALocal(uriOrigen, segmentos) {
  if (estaEnDirectorio(uriOrigen, ...segmentos)) return uriOrigen;

  const carpeta = asegurar(directorio(...segmentos));
  const nombre = `${Date.now().toString(36)}-${hashTexto(uriOrigen).slice(0, 8)}.${extensionDeUri(uriOrigen)}`;
  const destino = new File(carpeta, nombre);

  await new File(uriOrigen).copy(destino);
  return destino.uri;
}

const descargasEnCurso = new Map();

async function descargar(url, segmentos) {
  const carpeta = asegurar(directorio(...segmentos));
  const destino = new File(carpeta, nombreArchivoLocal(url));

  // Ya descargada: no se vuelve a pedir
  if (destino.exists && destino.size > 0) return destino.uri;

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_DESCARGA_MS);

  try {
    const archivo = await File.downloadFileAsync(url, destino, {
      idempotent: true,
      signal: controlador.signal,
    });
    return archivo.uri;
  } catch {
    // Una descarga a medias no debe quedar como si fuera válida
    try {
      if (destino.exists) destino.delete();
    } catch {
      // Sin acción: el próximo intento la pisa
    }
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Descarga una foto pública a la carpeta indicada y devuelve su URI local (o null si falla).
 * Las rutas privadas y los orígenes ajenos se rechazan. Pedidos simultáneos de la misma
 * foto comparten una sola descarga.
 */
export function descargarALocal(url, baseUrl, segmentos) {
  if (!esFotoDescargable(url, baseUrl)) return Promise.resolve(null);

  const clave = `${segmentos.join('/')}/${nombreArchivoLocal(url)}`;
  if (descargasEnCurso.has(clave)) return descargasEnCurso.get(clave);

  const tarea = descargar(url, segmentos).finally(() => {
    descargasEnCurso.delete(clave);
  });
  descargasEnCurso.set(clave, tarea);
  return tarea;
}

/**
 * Descarga varias fotos de a pocas por vez. Devuelve un mapa url -> uri local
 * con las que se pudieron guardar.
 */
export async function descargarVariasALocal(urls, baseUrl, segmentos) {
  const pendientes = fotosDescargables(urls, baseUrl);
  const locales = {};

  async function trabajador() {
    while (pendientes.length > 0) {
      const url = pendientes.shift();
      const local = await descargarALocal(url, baseUrl, segmentos);
      if (local) locales[url] = local;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DESCARGAS_SIMULTANEAS, pendientes.length) }, trabajador)
  );
  return locales;
}

/** Borra un archivo del almacenamiento de la app (ignora los que están fuera de él). */
export function borrarArchivo(uri) {
  try {
    if (!estaEnAlmacenApp(uri)) return;
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Falla silenciosa: un archivo huérfano no debe romper el flujo
  }
}

/** Borra una carpeta y todo su contenido. */
export function borrarDirectorio(...segmentos) {
  try {
    const carpeta = directorio(...segmentos);
    if (carpeta.exists) carpeta.delete();
  } catch {
    // Falla silenciosa
  }
}

/** Borra de una carpeta todos los archivos que no estén en `conservar` (lista de URIs). */
export function conservarSoloArchivos(segmentos, conservar) {
  try {
    const carpeta = directorio(...segmentos);
    if (!carpeta.exists) return;

    const aConservar = new Set(conservar);
    carpeta.list().forEach((entrada) => {
      if (entrada instanceof File && !aConservar.has(entrada.uri)) {
        try {
          entrada.delete();
        } catch {
          // Se intenta con el resto
        }
      }
    });
  } catch {
    // Falla silenciosa
  }
}

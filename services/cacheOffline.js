import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';
import {
  aplicarFotosLocales,
  borrarDirectorio,
  conservarLocales,
  conservarSoloArchivos,
  descargarVariasALocal,
  existeArchivo,
} from './archivosLocales';

// Las claves de la versión anterior eran globales (compartidas entre cuentas).
// Ya no se leen: se descartan al iniciar porque no se sabe a qué cuenta pertenecen.
const PREFIJO_LEGADO = '@hallado:cache_';

// Claves actuales: una "carpeta" por usuario autenticado.
const PREFIJO_CACHE = '@hallado:cache/';
const MAX_CONSULTADAS = 25;

// De cada resultado de búsqueda guardado se descarga solo la primera foto (la de la tarjeta)
const FOTOS_POR_RESULTADO_BUSQUEDA = 1;

// Usuario al que pertenece la caché en este momento. Lo fija useAuth con
// setUsuarioCache; sin usuario activo la caché no lee ni escribe nada.
let usuarioActivo = null;

function prefijoUsuario(id) {
  return `${PREFIJO_CACHE}${id}/`;
}

function clave(id, nombre) {
  return `${prefijoUsuario(id)}${nombre}`;
}

function clavePublicacion(id, idPublicacion) {
  return clave(id, `pub/${idPublicacion}`);
}

// Las escrituras y limpiezas se ejecutan de a una, para que el índice de
// consultadas no pierda actualizaciones y para que una limpieza no se pise
// con un guardado en curso.
let colaEscritura = Promise.resolve();

function encolar(tarea) {
  const resultado = colaEscritura.then(tarea);
  colaEscritura = resultado.catch(() => {});
  return resultado;
}

// Carpetas de fotos descargadas de la caché: una por publicación consultada y una
// compartida por los resultados de la última búsqueda.
function carpetaFotosPublicacion(uid, id) {
  return ['cache', uid, 'fotos', `pub-${id}`];
}

function carpetaFotosBusqueda(uid) {
  return ['cache', uid, 'fotos', 'busqueda'];
}

/**
 * Borra los archivos locales asociados a las entradas de caché que se van a descartar
 * (las fotos descargadas de cada publicación), ya sea por expulsión del índice
 * o por limpieza de la cuenta.
 */
async function liberarRecursosLocales(uid, entradas) {
  entradas.forEach((entrada) => {
    if (entrada?.id !== undefined) {
      borrarDirectorio(...carpetaFotosPublicacion(uid, entrada.id));
    }
  });
}

/**
 * Quita de una publicación los datos privados que no corresponde conservar
 * en el dispositivo: en publicaciones ajenas no se guarda la dirección exacta,
 * el teléfono del publicador ni las coordenadas precisas.
 */
function minimizarPublicacion(publicacion) {
  if (!publicacion || publicacion.esPropia) return publicacion;

  const { direccionExacta, ...resto } = publicacion;
  const segura = { ...resto, direccionExacta: null };

  if (segura.publicador) {
    const { phone, telefono, ...publicador } = segura.publicador;
    segura.publicador = publicador;
  }

  const redondear = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);
  if ('latitud' in segura) segura.latitud = redondear(segura.latitud);
  if ('longitud' in segura) segura.longitud = redondear(segura.longitud);
  if (segura.ubicacion) {
    segura.ubicacion = {
      ...segura.ubicacion,
      latitud: redondear(segura.ubicacion.latitud),
      longitud: redondear(segura.ubicacion.longitud),
    };
  }

  return segura;
}

// El teléfono de la contraparte de un reclamo tampoco se guarda en el dispositivo.
function minimizarReclamo(reclamo) {
  if (!reclamo) return reclamo;
  return {
    ...reclamo,
    telefono: null,
    publicacion: minimizarPublicacion(reclamo.publicacion),
  };
}

/**
 * Elimina las claves globales de versiones anteriores de la caché.
 * Es idempotente: solo corre una vez por ejecución de la app.
 */
let descarteLegado = null;

export function descartarCacheLegada() {
  if (!descarteLegado) {
    descarteLegado = (async () => {
      try {
        const claves = await AsyncStorage.getAllKeys();
        const viejas = claves.filter((k) => k.startsWith(PREFIJO_LEGADO));
        if (viejas.length > 0) await AsyncStorage.multiRemove(viejas);
      } catch {
        // Si falla, no bloquea el inicio de la app
      }
    })();
  }
  return descarteLegado;
}

/**
 * Borra toda la caché de una cuenta (por defecto, la del usuario activo).
 */
export function limpiarCacheUsuario(id = usuarioActivo) {
  if (!id) return Promise.resolve();
  const uid = String(id);

  return encolar(async () => {
    try {
      const claves = await AsyncStorage.getAllKeys();
      const propias = claves.filter((k) => k.startsWith(prefijoUsuario(uid)));

      if (propias.length > 0) {
        const rawLista = await AsyncStorage.getItem(clave(uid, 'consultadas'));
        const lista = rawLista ? JSON.parse(rawLista) : [];
        await liberarRecursosLocales(uid, Array.isArray(lista) ? lista : []);

        await AsyncStorage.multiRemove(propias);
      }

      // Aun sin claves, se borra toda la carpeta de fotos de la cuenta
      borrarDirectorio('cache', uid);
    } catch {
      // Falla silenciosa: no debe impedir el cierre de sesión
    }
  });
}

/**
 * Indica a qué cuenta pertenece la caché. Se llama al iniciar sesión o restaurarla
 * (con el id del usuario) y al cerrarla (con null). Si había otra cuenta activa,
 * se borra su caché: una cuenta nunca lee ni conserva datos de otra.
 */
export async function setUsuarioCache(id) {
  const nuevo = id ? String(id) : null;
  if (nuevo === usuarioActivo) return;

  const anterior = usuarioActivo;
  usuarioActivo = nuevo;
  if (anterior) await limpiarCacheUsuario(anterior);
}

/**
 * Guarda una publicación en el caché local de AsyncStorage
 * cada vez que se consulta su detalle con éxito.
 */
export async function guardarPublicacionConsultada(publicacion) {
  if (!publicacion || !publicacion.id) return;

  const uid = usuarioActivo;
  if (!uid) return;

  try {
    await encolar(async () => {
      // Si la sesión cambió mientras esperaba, se descarta el guardado
      if (usuarioActivo !== uid) return;

      const id = String(publicacion.id);
      const segura = minimizarPublicacion(publicacion);
      const { esOffline, desdeCache, fotosLocales: _descartadas, ...base } = segura;

      // Las fotos ya descargadas siguen valiendo mientras la publicación conserve esas URLs
      const rawPrevia = await AsyncStorage.getItem(clavePublicacion(uid, id));
      const previa = rawPrevia ? JSON.parse(rawPrevia) : null;
      const fotosLocales = conservarLocales(previa?.fotosLocales, segura.fotos);

      const pubAGuardar = {
        ...base,
        id,
        fotosLocales,
        fechaGuardado: new Date().toISOString(),
      };

      // 1. Guardar copia individual por ID
      await AsyncStorage.setItem(
        clavePublicacion(uid, id),
        JSON.stringify(pubAGuardar)
      );

      // 2. Actualizar lista de últimas publicaciones consultadas
      const raw = await AsyncStorage.getItem(clave(uid, 'consultadas'));
      const lista = raw ? JSON.parse(raw) : [];

      const filtrada = Array.isArray(lista)
        ? lista.filter((item) => String(item.id) !== id)
        : [];

      const resumen = {
        id,
        titulo: segura.titulo || 'Sin título',
        descripcion: segura.descripcion || '',
        categoria: segura.categoria || 'Otros',
        barrio: segura.barrio || 'Sin barrio',
        tipo: segura.tipo || 'encontrado',
        estado: segura.estado || 'abierta',
        fecha: segura.fecha || '',
        fotos: Array.isArray(segura.fotos) ? segura.fotos : [],
        fotosLocales,
        publicador: segura.publicador || null,
        fechaGuardado: new Date().toISOString(),
      };

      const todas = [resumen, ...filtrada];
      const actualizada = todas.slice(0, MAX_CONSULTADAS);
      const expulsadas = todas.slice(MAX_CONSULTADAS);

      await AsyncStorage.setItem(
        clave(uid, 'consultadas'),
        JSON.stringify(actualizada)
      );

      // 3. Borrar las copias individuales de las expulsadas del índice,
      //    para que el almacenamiento también quede acotado
      if (expulsadas.length > 0) {
        await liberarRecursosLocales(uid, expulsadas);
        await AsyncStorage.multiRemove(
          expulsadas.map((item) => clavePublicacion(uid, item.id))
        );
      }
    });
  } catch {
    // Si falla el guardado en almacenamiento local, no bloquea la navegación
    return;
  }

  // Las fotos se bajan en segundo plano: no demoran la navegación ni el guardado
  descargarFotosPublicacion(uid, String(publicacion.id), publicacion.fotos);
}

// Publicaciones cuyas fotos se están descargando ahora, para no repetir el trabajo
const descargasPublicacion = new Set();

function descargarFotosPublicacion(uid, id, fotos) {
  const clavePub = `${uid}/${id}`;
  if (descargasPublicacion.has(clavePub)) return;
  descargasPublicacion.add(clavePub);

  (async () => {
    const carpeta = carpetaFotosPublicacion(uid, id);
    const locales = await descargarVariasALocal(fotos, API_URL, carpeta);
    if (Object.keys(locales).length === 0) return;

    await encolar(async () => {
      // Si la cuenta salió o la entrada fue expulsada mientras se descargaba, no queda nada
      const raw = await AsyncStorage.getItem(clavePublicacion(uid, id));
      if (usuarioActivo !== uid || !raw) {
        borrarDirectorio(...carpeta);
        return;
      }

      const entrada = JSON.parse(raw);
      const fotosLocales = conservarLocales(
        { ...entrada.fotosLocales, ...locales },
        entrada.fotos
      );
      await AsyncStorage.setItem(
        clavePublicacion(uid, id),
        JSON.stringify({ ...entrada, fotosLocales })
      );

      // El resumen del índice de consultadas lleva la misma referencia
      const rawLista = await AsyncStorage.getItem(clave(uid, 'consultadas'));
      const lista = rawLista ? JSON.parse(rawLista) : [];
      if (Array.isArray(lista)) {
        const actualizada = lista.map((item) =>
          String(item.id) === id ? { ...item, fotosLocales } : item
        );
        await AsyncStorage.setItem(
          clave(uid, 'consultadas'),
          JSON.stringify(actualizada)
        );
      }

      // Se descartan las fotos de la carpeta que la publicación ya no usa
      conservarSoloArchivos(carpeta, Object.values(fotosLocales));
    });
  })()
    .catch(() => {
      // Sin fotos locales la publicación se ve igual, solo con las URLs
    })
    .finally(() => {
      descargasPublicacion.delete(clavePub);
    });
}

// Sin conexión, las fotos se leen de la copia local cuando existe; si el archivo
// ya no está (p. ej. el sistema lo borró) se deja la URL original.
function conFotosLocales(entrada) {
  return {
    ...entrada,
    fotos: aplicarFotosLocales(entrada.fotos, entrada.fotosLocales, existeArchivo),
  };
}

/**
 * Obtiene una publicación guardada previamente en AsyncStorage por su ID.
 */
export async function obtenerPublicacionCacheada(id) {
  const uid = usuarioActivo;
  if (!id || !uid) return null;
  try {
    const raw = await AsyncStorage.getItem(clavePublicacion(uid, id));
    if (usuarioActivo !== uid) return null;
    if (raw) {
      return conFotosLocales({ ...JSON.parse(raw), esOffline: true, desdeCache: true });
    }

    // Si no está por clave directa, buscar en la lista de consultadas
    const rawLista = await AsyncStorage.getItem(clave(uid, 'consultadas'));
    if (usuarioActivo !== uid) return null;
    if (rawLista) {
      const lista = JSON.parse(rawLista);
      const encontrada = Array.isArray(lista)
        ? lista.find((item) => String(item.id) === String(id))
        : null;
      if (encontrada) {
        return conFotosLocales({ ...encontrada, esOffline: true, desdeCache: true });
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene la lista de las últimas publicaciones consultadas.
 */
export async function obtenerConsultadasRecientes() {
  const uid = usuarioActivo;
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(clave(uid, 'consultadas'));
    if (!raw || usuarioActivo !== uid) return [];
    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista.map(conFotosLocales) : [];
  } catch {
    return [];
  }
}

/**
 * Guarda los resultados de la última búsqueda exitosa.
 */
export async function guardarUltimosResultadosBusqueda(resultados, filtros, orden) {
  if (!Array.isArray(resultados)) return;

  const uid = usuarioActivo;
  if (!uid) return;

  try {
    await encolar(async () => {
      if (usuarioActivo !== uid) return;

      // Las primeras fotos ya descargadas se conservan si el resultado sigue en la lista
      const rawPrevia = await AsyncStorage.getItem(clave(uid, 'busqueda'));
      const previa = rawPrevia ? JSON.parse(rawPrevia) : null;

      const datos = {
        resultados: resultados.map(minimizarPublicacion),
        filtros: filtros || null,
        orden: orden || 'recientes',
        fotosLocales: conservarLocales(
          previa?.fotosLocales,
          primerasFotos(resultados)
        ),
        fechaGuardado: new Date().toISOString(),
      };
      await AsyncStorage.setItem(clave(uid, 'busqueda'), JSON.stringify(datos));
    });
  } catch {
    // Falla silenciosa de guardado en caché
    return;
  }

  descargarFotosBusqueda(uid, resultados);
}

function primerasFotos(resultados) {
  return resultados.flatMap((r) =>
    Array.isArray(r?.fotos) ? r.fotos.slice(0, FOTOS_POR_RESULTADO_BUSQUEDA) : []
  );
}

// Cada búsqueda guardada reemplaza a la anterior: un contador evita que una
// descarga vieja pise el resultado de una más nueva.
let generacionBusqueda = 0;

function descargarFotosBusqueda(uid, resultados) {
  const generacion = ++generacionBusqueda;
  const carpeta = carpetaFotosBusqueda(uid);
  const urls = primerasFotos(resultados);

  (async () => {
    const locales = await descargarVariasALocal(urls, API_URL, carpeta);
    if (generacion !== generacionBusqueda) return;

    await encolar(async () => {
      if (usuarioActivo !== uid) {
        borrarDirectorio(...carpeta);
        return;
      }

      const raw = await AsyncStorage.getItem(clave(uid, 'busqueda'));
      if (!raw || generacion !== generacionBusqueda) return;

      const datos = JSON.parse(raw);
      const fotosLocales = conservarLocales(
        { ...datos.fotosLocales, ...locales },
        urls
      );
      await AsyncStorage.setItem(
        clave(uid, 'busqueda'),
        JSON.stringify({ ...datos, fotosLocales })
      );

      // Las fotos de búsquedas anteriores ya no hacen falta
      conservarSoloArchivos(carpeta, Object.values(fotosLocales));
    });
  })().catch(() => {
    // Sin fotos locales los resultados se ven igual, con el ícono de la categoría
  });
}

/**
 * Recupera los últimos resultados de búsqueda guardados exitosamente.
 */
export async function obtenerUltimosResultadosBusqueda() {
  const uid = usuarioActivo;
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(clave(uid, 'busqueda'));
    if (!raw || usuarioActivo !== uid) return null;

    const datos = JSON.parse(raw);
    if (!Array.isArray(datos.resultados)) return datos;

    return {
      ...datos,
      resultados: datos.resultados.map((resultado) => ({
        ...resultado,
        fotos: aplicarFotosLocales(resultado?.fotos, datos.fotosLocales, existeArchivo),
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Guarda los últimos reclamos enviados y recibidos para poder verlos sin conexión.
 */
export async function guardarUltimosReclamos({ enviados = [], recibidos = [] }) {
  const uid = usuarioActivo;
  if (!uid) return;

  try {
    await encolar(async () => {
      if (usuarioActivo !== uid) return;

      const datos = {
        enviados: Array.isArray(enviados) ? enviados.map(minimizarReclamo) : [],
        recibidos: Array.isArray(recibidos) ? recibidos.map(minimizarReclamo) : [],
        fechaGuardado: new Date().toISOString(),
      };
      await AsyncStorage.setItem(clave(uid, 'reclamos'), JSON.stringify(datos));
    });
  } catch {
    // Falla silenciosa
  }
}

/**
 * Recupera los últimos reclamos guardados en el almacenamiento local.
 */
export async function obtenerUltimosReclamos() {
  const uid = usuarioActivo;
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(clave(uid, 'reclamos'));
    if (!raw || usuarioActivo !== uid) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

// Las claves de la versión anterior eran globales (compartidas entre cuentas).
// Ya no se leen: se descartan al iniciar porque no se sabe a qué cuenta pertenecen.
const PREFIJO_LEGADO = '@hallado:cache_';

// Claves actuales: una "carpeta" por usuario autenticado.
const PREFIJO_CACHE = '@hallado:cache/';
const MAX_CONSULTADAS = 25;

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

/**
 * Punto de extensión para los archivos locales asociados a una entrada de caché
 * (p. ej. las fotos descargadas). Se invoca con las entradas que se van a
 * descartar, ya sea por expulsión del índice o por limpieza de la cuenta,
 * para que borren sus recursos junto con la entrada. Hoy no hay ninguno.
 */
// eslint-disable-next-line no-unused-vars
async function liberarRecursosLocales(entradas) {}

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
      if (propias.length === 0) return;

      const rawLista = await AsyncStorage.getItem(clave(uid, 'consultadas'));
      const lista = rawLista ? JSON.parse(rawLista) : [];
      await liberarRecursosLocales(Array.isArray(lista) ? lista : []);

      await AsyncStorage.multiRemove(propias);
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
      const { esOffline, desdeCache, ...base } = segura;
      const pubAGuardar = {
        ...base,
        id,
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
        await liberarRecursosLocales(expulsadas);
        await AsyncStorage.multiRemove(
          expulsadas.map((item) => clavePublicacion(uid, item.id))
        );
      }
    });
  } catch {
    // Si falla el guardado en almacenamiento local, no bloquea la navegación
  }
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
      const parsed = JSON.parse(raw);
      return { ...parsed, esOffline: true, desdeCache: true };
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
        return { ...encontrada, esOffline: true, desdeCache: true };
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
    return Array.isArray(lista) ? lista : [];
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

      const datos = {
        resultados: resultados.map(minimizarPublicacion),
        filtros: filtros || null,
        orden: orden || 'recientes',
        fechaGuardado: new Date().toISOString(),
      };
      await AsyncStorage.setItem(clave(uid, 'busqueda'), JSON.stringify(datos));
    });
  } catch {
    // Falla silenciosa de guardado en caché
  }
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
    return JSON.parse(raw);
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

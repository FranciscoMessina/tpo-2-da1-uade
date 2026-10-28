import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_CONSULTADAS = '@hallado:cache_publicaciones_recientes';
const CLAVE_PUB_PREFIJO = '@hallado:cache_pub_';
const CLAVE_ULTIMA_BUSQUEDA = '@hallado:cache_ultimos_resultados_busqueda';
const MAX_CONSULTADAS = 25;

/**
 * Guarda una publicación en el caché local de AsyncStorage
 * cada vez que se consulta su detalle con éxito.
 */
export async function guardarPublicacionConsultada(publicacion) {
  if (!publicacion || !publicacion.id) return;

  try {
    const id = String(publicacion.id);
    const pubAGuardar = {
      ...publicacion,
      id,
      esOffline: true,
      fechaGuardado: new Date().toISOString(),
    };

    // 1. Guardar copia individual por ID
    await AsyncStorage.setItem(
      `${CLAVE_PUB_PREFIJO}${id}`,
      JSON.stringify(pubAGuardar)
    );

    // 2. Actualizar lista de últimas publicaciones consultadas
    const raw = await AsyncStorage.getItem(CLAVE_CONSULTADAS);
    const lista = raw ? JSON.parse(raw) : [];

    const filtrada = Array.isArray(lista)
      ? lista.filter((item) => String(item.id) !== id)
      : [];

    const resumen = {
      id,
      titulo: publicacion.titulo || 'Sin título',
      descripcion: publicacion.descripcion || '',
      categoria: publicacion.categoria || 'Otros',
      barrio: publicacion.barrio || 'Sin barrio',
      tipo: publicacion.tipo || 'encontrado',
      estado: publicacion.estado || 'abierta',
      fecha: publicacion.fecha || '',
      fotos: Array.isArray(publicacion.fotos) ? publicacion.fotos : [],
      publicador: publicacion.publicador || null,
      fechaGuardado: new Date().toISOString(),
    };

    const actualizada = [resumen, ...filtrada].slice(0, MAX_CONSULTADAS);
    await AsyncStorage.setItem(CLAVE_CONSULTADAS, JSON.stringify(actualizada));
  } catch {
    // Si falla el guardado en almacenamiento local, no bloquea la navegación
  }
}

/**
 * Obtiene una publicación guardada previamente en AsyncStorage por su ID.
 */
export async function obtenerPublicacionCacheada(id) {
  if (!id) return null;
  try {
    const clave = `${CLAVE_PUB_PREFIJO}${id}`;
    const raw = await AsyncStorage.getItem(clave);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...parsed, esOffline: true };
    }

    // Si no está por clave directa, buscar en la lista de consultadas
    const rawLista = await AsyncStorage.getItem(CLAVE_CONSULTADAS);
    if (rawLista) {
      const lista = JSON.parse(rawLista);
      const encontrada = Array.isArray(lista)
        ? lista.find((item) => String(item.id) === String(id))
        : null;
      if (encontrada) {
        return { ...encontrada, esOffline: true };
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
  try {
    const raw = await AsyncStorage.getItem(CLAVE_CONSULTADAS);
    if (!raw) return [];
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

  try {
    const datos = {
      resultados,
      filtros: filtros || null,
      orden: orden || 'recientes',
      fechaGuardado: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CLAVE_ULTIMA_BUSQUEDA, JSON.stringify(datos));
  } catch {
    // Falla silenciosa de guardado en caché
  }
}

/**
 * Recupera los últimos resultados de búsqueda guardados exitosamente.
 */
export async function obtenerUltimosResultadosBusqueda() {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_ULTIMA_BUSQUEDA);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const CLAVE_ULTIMOS_RECLAMOS = '@hallado:cache_ultimos_reclamos';

/**
 * Guarda los últimos reclamos enviados y recibidos para poder verlos sin conexión.
 */
export async function guardarUltimosReclamos({ enviados = [], recibidos = [] }) {
  try {
    const datos = {
      enviados: Array.isArray(enviados) ? enviados : [],
      recibidos: Array.isArray(recibidos) ? recibidos : [],
      fechaGuardado: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CLAVE_ULTIMOS_RECLAMOS, JSON.stringify(datos));
  } catch {
    // Falla silenciosa
  }
}

/**
 * Recupera los últimos reclamos guardados en el almacenamiento local.
 */
export async function obtenerUltimosReclamos() {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_ULTIMOS_RECLAMOS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

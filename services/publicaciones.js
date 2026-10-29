import {
  esErrorDeConectividad,
  estaConectado,
  reportarFalloConexion,
} from './conexion';
import {
  guardarPublicacionConsultada,
  obtenerPublicacionCacheada,
  guardarUltimosResultadosBusqueda,
  obtenerUltimosResultadosBusqueda,
} from './cacheOffline';
import { isAxiosError } from 'axios';
import { api, API_URL, mensajeErrorApi } from './api';

const BASE_URL = API_URL.replace(/\/+$/, '');

function urlAbsoluta(url) {
  return url?.startsWith('/') ? `${BASE_URL}${url}` : url || null;
}

function prepararPublicacion(publicacion) {
  return {
    ...publicacion,
    fotos: (publicacion.fotos || []).map(urlAbsoluta),
    ...(publicacion.publicador
      ? {
          publicador: {
            ...publicacion.publicador,
            avatarUrl: urlAbsoluta(publicacion.publicador.avatarUrl),
          },
        }
      : {}),
  };
}

export async function obtenerPublicacion(id, { signal = undefined } = {}) {
  // 1. Si sabemos que el backend no está alcanzable (estado compartido), usar la copia local si existe
  if (!estaConectado()) {
    const cacheada = await obtenerPublicacionCacheada(id);
    if (cacheada) {
      return { ...cacheada, desdeCache: true, esOffline: true };
    }
  }

  // 2. Consultar la API y actualizar la copia local
  try {
    const { data } = await api.get(
      `/publicaciones/${encodeURIComponent(id)}`,
      { signal }
    );
    const preparada = prepararPublicacion(data);
    await guardarPublicacionConsultada(preparada);
    return preparada;
  } catch (error) {
    // Solo la falta de conectividad habilita la copia local; un 404, 401/403
    // u otro error HTTP se propaga tal cual (publicación eliminada, sin permiso, etc.)
    if (!esErrorDeConectividad(error)) throw error;

    reportarFalloConexion();

    const cacheada = await obtenerPublicacionCacheada(id);
    if (cacheada) {
      return { ...cacheada, desdeCache: true, esOffline: true };
    }

    throw new Error(
      'No hay conexión a internet y esta publicación no fue guardada previamente en el dispositivo.'
    );
  }
}

export async function obtenerSeguidas({ pagina = 1, signal = undefined } = {}) {
  const { data } = await api.get('/me/seguidas', {
    params: { page: pagina, pageSize: 20 },
    signal,
  });

  return { ...data, items: data.items.map(prepararPublicacion) };
}

export async function seguirPublicacion(id) {
  const { data } = await api.post(
    `/publicaciones/${encodeURIComponent(id)}/seguir`
  );

  return data;
}

export async function dejarDeSeguirPublicacion(id) {
  const { data } = await api.delete(
    `/publicaciones/${encodeURIComponent(id)}/seguir`
  );

  return data;
}

// Las fotos de prueba se suben a un directorio privado: solo las ve el reclamante y el dueño de la publicación
export async function subirFotoPrueba(uri) {
  if (!uri) return null;
  if (uri.startsWith('/uploads/pruebas/')) return uri;

  if (!/^(file|content):\/\//i.test(uri)) {
    throw new Error('Seleccioná una foto válida desde el dispositivo.');
  }

  const extension =
    uri.match(/\.(png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'jpg';

  const formulario = new FormData();
  formulario.append('file', {
    uri,
    name: `comprobante.${extension}`,
    type: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
  });

  const { data } = await api.post('/uploads/pruebas', formulario);
  return data.url;
}

/**
 * Envía un reclamo con evidencia estructurada.
 * datos: { mensaje, respuestaVerificacion?, barrio?, fotoUri? }
 * La foto (si hay) se sube antes a /uploads/pruebas y se envía como fotoPrueba.
 */
export async function enviarReclamo(id, datos = {}) {
  const fotoPrueba = datos.fotoUri ? await subirFotoPrueba(datos.fotoUri) : null;

  const cuerpo = { mensaje: (datos.mensaje || '').trim() };
  if (datos.respuestaVerificacion?.trim()) {
    cuerpo.respuestaVerificacion = datos.respuestaVerificacion.trim();
  }
  if (datos.barrio?.trim()) cuerpo.barrio = datos.barrio.trim();
  if (fotoPrueba) cuerpo.fotoPrueba = fotoPrueba;

  const { data } = await api.post(
    `/publicaciones/${encodeURIComponent(id)}/reclamos`,
    cuerpo
  );

  return data;
}

export async function obtenerMisReclamos({ tipo = 'todos', pagina = 1, signal = undefined } = {}) {
  const { data } = await api.get('/me/reclamos', {
    params: { tipo, page: pagina, pageSize: 50 },
    signal,
  });

  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      publicacion: item.publicacion ? prepararPublicacion(item.publicacion) : null,
    })),
  };
}

export async function aceptarReclamo(id) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(id)}/aceptar`);
  return data;
}

export async function rechazarReclamo(id) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(id)}/rechazar`);
  return data;
}

const TAMANIO_PAGINA_BUSQUEDA = 10;

export async function buscarPublicacionesConCache(
  filtros,
  orden = 'recientes',
  { pagina = 1, tamanioPagina = TAMANIO_PAGINA_BUSQUEDA, signal = undefined } = {}
) {
  try {
    const params = {
      situacion: filtros.situacion,
      categoria: filtros.categoria,
      zona: filtros.zona || undefined,
      palabras: filtros.palabras || undefined,
      periodo: filtros.periodo || 'semana',
      desde: filtros.periodo === 'rango' ? filtros.desde : undefined,
      hasta: filtros.periodo === 'rango' ? filtros.hasta : undefined,
      orden: orden || 'recientes',
      page: pagina,
      pageSize: tamanioPagina,
    };

    if (filtros.ubicacion?.latitud && filtros.ubicacion?.longitud) {
      params.latitud = filtros.ubicacion.latitud;
      params.longitud = filtros.ubicacion.longitud;
    }

    const { data } = await api.get('/publicaciones', { params, signal });
    const items = (data.items || []).map(prepararPublicacion);
    const total = data.total ?? items.length;

    // Guardar copia de los primeros resultados reales; nunca se pisa con una lista vacía
    if (pagina === 1 && items.length > 0) {
      await guardarUltimosResultadosBusqueda(items, filtros, orden);
    }

    return {
      items,
      total,
      pagina: data.page ?? pagina,
      tamanioPagina: data.pageSize ?? tamanioPagina,
      totalPaginas: Math.max(1, data.totalPages ?? Math.ceil(total / tamanioPagina)),
      esOffline: false,
    };
  } catch (error) {
    // Solo ante falta de conectividad se muestran los últimos resultados guardados;
    // un error HTTP con respuesta (o una búsqueda cancelada) se propaga como tal
    if (!esErrorDeConectividad(error)) throw error;

    reportarFalloConexion();

    const guardada = await obtenerUltimosResultadosBusqueda();
    // Descarta publicaciones de ejemplo que pudieron guardarse con versiones anteriores
    const resultados = Array.isArray(guardada?.resultados)
      ? guardada.resultados.filter((item) => !String(item?.id).startsWith('demo-'))
      : [];

    if (resultados.length > 0) {
      return {
        items: resultados,
        total: resultados.length,
        pagina: 1,
        tamanioPagina: resultados.length,
        totalPaginas: 1,
        esOffline: true,
        desdeCache: true,
        fechaGuardado: guardada.fechaGuardado,
        filtrosGuardados: guardada.filtros || null,
      };
    }

    return {
      items: [],
      total: 0,
      pagina: 1,
      tamanioPagina,
      totalPaginas: 1,
      esOffline: true,
      sinResultadosPrevios: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Alta, listado y gestión de publicaciones propias
// ---------------------------------------------------------------------------

// Cuántos días antes del vencimiento se avisa y se ofrece renovar
export const DIAS_AVISO_VENCIMIENTO = 5;

export const NOMBRE_ESTADO_PUBLICACION = {
  abierta: 'Abierta',
  en_reclamo: 'En reclamo',
  resuelta: 'Resuelta',
  vencida: 'Vencida',
};

// Subir una imagen puede tardar bastante más que el resto de las llamadas
const TIMEOUT_SUBIDA_MS = 30000;

/**
 * Días enteros que faltan para que venza la publicación (0 si vence hoy, negativo si ya venció).
 * Devuelve null si no hay fecha de vencimiento.
 */
export function diasParaVencer(venceAt) {
  if (!venceAt) return null;
  const fin = new Date(venceAt).getTime();
  if (Number.isNaN(fin)) return null;
  return Math.floor((fin - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Una publicación propia se puede renovar si venció o está por vencer (y no está resuelta). */
export function puedeRenovarse(publicacion) {
  if (!publicacion || publicacion.estado === 'resuelta') return false;
  if (publicacion.estado === 'vencida') return true;
  const dias = diasParaVencer(publicacion.venceAt);
  return dias !== null && dias <= DIAS_AVISO_VENCIMIENTO;
}

/** Mensaje para mostrar: el del servidor si hubo respuesta, o el del propio error (p. ej. foto inválida). */
export function mensajeErrorPublicacion(error) {
  return isAxiosError(error)
    ? mensajeErrorApi(error)
    : error?.message || 'No pudimos completar la operación. Intentá nuevamente.';
}

/**
 * Identificador único de un intento de alta. Hermes puede no tener crypto.randomUUID,
 * así que se cae a getRandomValues y, en último caso, a Math.random.
 */
export function generarClientId() {
  const criptografia = globalThis.crypto;
  if (typeof criptografia?.randomUUID === 'function') {
    return `app-${criptografia.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  if (typeof criptografia?.getRandomValues === 'function') {
    criptografia.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Versión 4 y variante RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  return `app-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Sube una foto de publicación a /uploads/images y devuelve su URL relativa.
 * Si ya es una foto del servidor (URL absoluta o /uploads/...) no vuelve a subirla.
 */
export async function subirFotoPublicacion(uri) {
  if (!uri) return null;
  if (uri.startsWith(BASE_URL)) return uri.slice(BASE_URL.length);
  if (uri.startsWith('/uploads/')) return uri;

  if (!/^(file|content):\/\//i.test(uri)) {
    throw new Error('Seleccioná una foto válida desde el dispositivo.');
  }

  const extension =
    uri.match(/\.(png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'jpg';

  const formulario = new FormData();
  formulario.append('file', {
    uri,
    name: `publicacion.${extension}`,
    type: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
  });

  const { data } = await api.post('/uploads/images', formulario, {
    timeout: TIMEOUT_SUBIDA_MS,
  });
  return data.url;
}

/**
 * Sube las fotos de a una y devuelve sus URLs en el mismo orden.
 * `fotosSubidas` (Map uri -> url) permite no repetir subidas cuando se reintenta el envío.
 */
async function subirFotos(uris = [], fotosSubidas = new Map()) {
  const urls = [];

  for (const uri of uris) {
    if (!fotosSubidas.has(uri)) {
      fotosSubidas.set(uri, await subirFotoPublicacion(uri));
    }
    urls.push(fotosSubidas.get(uri));
  }

  return [...new Set(urls)];
}

/**
 * Arma el cuerpo de POST/PATCH /publicaciones a partir de los datos del formulario.
 * `fotos` son las URLs que devolvió el servidor. Los campos opcionales vacíos viajan como null
 * para que al editar también puedan borrarse.
 */
export function armarCuerpoPublicacion(datos, fotos) {
  const encontrado = datos.tipo === 'encontre' || datos.tipo === 'encontrado';
  const cuerpo = {
    tipo: datos.tipo,
    titulo: datos.titulo.trim(),
    categoria: datos.categoria,
    descripcion: datos.descripcion.trim(),
    barrio: (datos.barrio || '').trim(),
    fecha: datos.fecha,
    franja: datos.franja,
    direccionExacta: datos.direccionExacta?.trim() || null,
    fotos,
  };

  if (datos.ubicacion) cuerpo.ubicacion = datos.ubicacion;

  if (encontrado) {
    cuerpo.preguntaVerificacion = datos.preguntaVerificacion?.trim() || null;
    cuerpo.respuestaVerificacion = datos.respuestaVerificacion?.trim() || null;
  }

  return cuerpo;
}

/**
 * Crea la publicación: sube las fotos y luego hace POST /publicaciones con el `clientId`.
 * Reutilizar el mismo `clientId` en los reintentos evita duplicados (el servidor devuelve la ya creada).
 */
export async function crearPublicacion(
  datos,
  { clientId = generarClientId(), fotosSubidas = undefined } = {}
) {
  const fotos = await subirFotos(datos.fotos, fotosSubidas);
  const { data } = await api.post('/publicaciones', {
    ...armarCuerpoPublicacion(datos, fotos),
    clientId,
  });

  return prepararPublicacion(data);
}

/** Publicaciones del usuario (GET /mis-publicaciones), con filtro opcional por estado. */
export async function obtenerMisPublicaciones({
  estado = undefined,
  pagina = 1,
  tamanioPagina = 10,
  signal = undefined,
} = {}) {
  const { data } = await api.get('/mis-publicaciones', {
    params: { estado: estado || undefined, page: pagina, pageSize: tamanioPagina },
    signal,
  });

  return { ...data, items: (data.items || []).map(prepararPublicacion) };
}

/**
 * Detalle de una publicación propia (incluye la respuesta de verificación).
 * No pasa por la caché offline: contiene datos privados y la gestión exige conexión.
 */
export async function obtenerPublicacionPropia(id, { signal = undefined } = {}) {
  const { data } = await api.get(`/publicaciones/${encodeURIComponent(id)}`, { signal });
  return prepararPublicacion(data);
}

/** PATCH /publicaciones/:id (solo abierta). Sube las fotos nuevas y conserva las ya subidas. */
export async function editarPublicacion(id, datos, { fotosSubidas = undefined } = {}) {
  const fotos = await subirFotos(datos.fotos, fotosSubidas);
  const { data } = await api.patch(
    `/publicaciones/${encodeURIComponent(id)}`,
    armarCuerpoPublicacion(datos, fotos)
  );

  return prepararPublicacion(data);
}

/** Baja lógica: DELETE /publicaciones/:id */
export async function eliminarPublicacion(id) {
  const { data } = await api.delete(`/publicaciones/${encodeURIComponent(id)}`);
  return data;
}

/** POST /publicaciones/:id/renovar: extiende el vencimiento 30 días desde hoy. */
export async function renovarPublicacion(id) {
  const { data } = await api.post(`/publicaciones/${encodeURIComponent(id)}/renovar`);
  return prepararPublicacion(data);
}

/** Reclamos recibidos por una publicación propia (paginado). */
export async function obtenerReclamosDePublicacion(
  id,
  { pagina = 1, tamanioPagina = 50, signal = undefined } = {}
) {
  const { data } = await api.get(
    `/publicaciones/${encodeURIComponent(id)}/reclamos`,
    { params: { page: pagina, pageSize: tamanioPagina }, signal }
  );

  return data;
}

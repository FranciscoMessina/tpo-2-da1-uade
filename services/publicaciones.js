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
import { api, API_URL } from './api';

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

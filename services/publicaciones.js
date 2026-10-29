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

export async function subirFotoReclamo(uri) {
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
    name: `comprobante.${extension}`,
    type: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
  });

  const { data } = await api.post('/uploads/images', formulario);
  return data.url;
}

export async function enviarReclamo(id, datos) {
  let mensajeFinal = '';

  if (typeof datos === 'string') {
    mensajeFinal = datos.trim();
  } else if (datos && typeof datos === 'object') {
    let fotoUrl = null;
    if (datos.fotoUri) {
      fotoUrl = await subirFotoReclamo(datos.fotoUri);
    }

    const partes = [];
    if (datos.barrio?.trim()) {
      partes.push(`Barrio donde se encontró: ${datos.barrio.trim()}`);
    }
    if (datos.respuesta?.trim()) {
      partes.push(`Respuesta a verificación: ${datos.respuesta.trim()}`);
    }
    if (datos.descripcion?.trim()) {
      partes.push(`Descripción: ${datos.descripcion.trim()}`);
    }
    if (fotoUrl) {
      partes.push(
        datos.barrio
          ? `Foto del hallazgo: ${fotoUrl}`
          : `Foto de comprobación: ${fotoUrl}`
      );
    }
    if (datos.mensaje?.trim()) {
      partes.push(`Mensaje: ${datos.mensaje.trim()}`);
    }

    mensajeFinal = partes.join('\n\n');
  }

  const { data } = await api.post(
    `/publicaciones/${encodeURIComponent(id)}/reclamos`,
    { mensaje: mensajeFinal }
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

export async function buscarPublicacionesConCache(
  filtros,
  orden = 'recientes',
  { signal = undefined } = {}
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
      page: 1,
      pageSize: 50,
    };

    if (filtros.ubicacion?.latitud && filtros.ubicacion?.longitud) {
      params.latitud = filtros.ubicacion.latitud;
      params.longitud = filtros.ubicacion.longitud;
    }

    const { data } = await api.get('/publicaciones', { params, signal });
    const items = (data.items || []).map(prepararPublicacion);

    // Guardar copia de los últimos resultados exitosos en almacenamiento local
    await guardarUltimosResultadosBusqueda(items, filtros, orden);

    return {
      items,
      total: data.total || items.length,
      esOffline: false,
    };
  } catch (error) {
    // Solo ante falta de conectividad se muestran los últimos resultados guardados;
    // un error HTTP con respuesta se propaga como tal
    if (!esErrorDeConectividad(error)) throw error;

    reportarFalloConexion();

    const guardada = await obtenerUltimosResultadosBusqueda();
    if (guardada && Array.isArray(guardada.resultados) && guardada.resultados.length > 0) {
      return {
        items: guardada.resultados,
        total: guardada.resultados.length,
        esOffline: true,
        desdeCache: true,
        fechaGuardado: guardada.fechaGuardado,
      };
    }

    return {
      items: [],
      total: 0,
      esOffline: true,
      sinResultadosPrevios: true,
    };
  }
}

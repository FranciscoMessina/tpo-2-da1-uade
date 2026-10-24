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
  const { data } = await api.get(
    `/publicaciones/${encodeURIComponent(id)}`,
    { signal }
  );

  return prepararPublicacion(data);
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

export async function enviarReclamo(id, mensaje) {
  const { data } = await api.post(
    `/publicaciones/${encodeURIComponent(id)}/reclamos`,
    { mensaje }
  );

  return data;
}

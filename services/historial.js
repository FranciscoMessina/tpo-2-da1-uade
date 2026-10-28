import { api } from './api';

export async function obtenerHistorial(filtros) {
  const { data } = await api.get('/me/historial', { params: filtros });
  return data;
}

export async function resolverPublicacion(id) {
  const { data } = await api.post(`/publicaciones/${encodeURIComponent(id)}/resolver`);
  return data;
}

export async function valorarDevolucion(id, positiva, comentario) {
  const { data } = await api.post(`/publicaciones/${encodeURIComponent(id)}/valoraciones`, {
    positiva, comentario: comentario.trim(),
  });
  return data;
}

export async function agradecerDevolucion(id, mensaje) {
  const { data } = await api.post(`/publicaciones/${encodeURIComponent(id)}/agradecimientos`, {
    mensaje: mensaje.trim(),
  });
  return data;
}

export async function obtenerAgradecimientos(usuarioId, page = 1) {
  const { data } = await api.get(`/usuarios/${encodeURIComponent(usuarioId)}/agradecimientos`, {
    params: { page },
  });
  return data;
}

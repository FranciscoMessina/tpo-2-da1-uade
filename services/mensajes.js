import { api } from './api';

// Mensajes entre las partes de un reclamo aceptado.
// El backend los devuelve del más viejo al más nuevo, paginados (máx. 100 por página).
export async function obtenerMensajes({ reclamoId, pagina = 1, signal = undefined }) {
  const { data } = await api.get(`/reclamos/${encodeURIComponent(reclamoId)}/mensajes`, {
    params: { page: pagina, pageSize: 100 },
    signal,
  });
  return data;
}

export async function enviarMensaje(reclamoId, texto) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(reclamoId)}/mensajes`, {
    texto: texto.trim(),
  });
  return data;
}

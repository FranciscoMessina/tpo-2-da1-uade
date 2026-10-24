import { api } from './api';

export async function obtenerNotificaciones({
  pagina = 1,
  signal = undefined,
} = {}) {
  const { data } = await api.get('/notificaciones', {
    params: { page: pagina, pageSize: 100 },
    signal,
  });

  return data;
}

export async function marcarNotificacionLeida(id) {
  const { data } = await api.post(
    `/notificaciones/${encodeURIComponent(id)}/leida`
  );

  return data;
}
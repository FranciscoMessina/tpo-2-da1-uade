import { api } from './api';

/**
 * Historial de notificaciones de la cuenta, de la más nueva a la más vieja. Cada una trae `leidaEn`
 * (null si está sin leer); la respuesta suma `sinLeer` de toda la cuenta.
 */
export async function obtenerNotificaciones({
  pagina = 1,
  tamanoPagina = 100,
  signal = undefined,
} = {}) {
  const { data } = await api.get('/notificaciones', {
    params: { page: pagina, pageSize: tamanoPagina },
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

export async function marcarTodasLeidas() {
  const { data } = await api.post('/notificaciones/leidas');

  return data;
}

/**
 * Contadores de lo que está sin leer, sin descargar el historial:
 * `{ sinLeer, corte, alertas: [{ alertaId, sinLeer }], publicaciones: [...], reclamos: [...] }`.
 */
export async function obtenerResumenNotificaciones({
  signal = undefined,
} = {}) {
  const { data } = await api.get('/notificaciones/resumen', { signal });

  return data;
}

/**
 * Marca como leído un grupo (`tipo`: alerta | publicacion | reclamo) con una sola escritura.
 * `corte` es el del último resumen mostrado: lo que llegó después queda sin leer.
 * Responde `{ marcadas, resumen }` con el resumen ya reconciliado.
 */
export async function marcarGrupoLeido({ tipo, id, corte }) {
  const { data } = await api.post('/notificaciones/grupo/leida', {
    tipo,
    id,
    corte,
  });

  return data;
}

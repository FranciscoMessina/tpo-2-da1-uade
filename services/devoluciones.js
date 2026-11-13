import { api } from './api';

export async function obtenerDevolucion(reclamoId, signal) {
  const { data } = await api.get(`/reclamos/${encodeURIComponent(reclamoId)}/devolucion`, { signal });
  return data;
}

export async function generarQrDevolucion(reclamoId) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(reclamoId)}/devolucion/qr`);
  return data;
}

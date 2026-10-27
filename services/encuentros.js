import { api } from './api';

export async function obtenerEncuentro(reclamoId, signal) {
  const { data } = await api.get(`/reclamos/${encodeURIComponent(reclamoId)}/encuentro`, { signal });
  return data;
}

export async function proponerEncuentro(reclamoId, direccion, actual) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(reclamoId)}/encuentro`, {
    direccion,
    propuestaId: actual.encuentro?.id ?? null,
    intento: actual.intento,
  });
  return data;
}

export async function aceptarEncuentro(reclamoId, actual) {
  const { data } = await api.post(`/reclamos/${encodeURIComponent(reclamoId)}/encuentro/aceptar`, {
    propuestaId: actual.encuentro.id,
    intento: actual.intento,
  });
  return data;
}

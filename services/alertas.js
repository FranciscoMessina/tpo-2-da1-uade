import { api } from './api';
import { filtrosIniciales } from '../data/searchDemo';

function prepararAlerta(alerta) {
  return {
    ...alerta,
    filtros: { ...filtrosIniciales(), ...alerta.filtros },
  };
}

function prepararFiltros(filtros) {
  return {
    situacion: filtros.situacion,
    categoria: filtros.categoria,
    palabras: filtros.palabras?.trim() || '',
    zona: filtros.zona?.trim() || '',
    periodo: filtros.periodo,
    ubicacion: filtros.ubicacion
      ? {
          latitud: filtros.ubicacion.latitud,
          longitud: filtros.ubicacion.longitud,
        }
      : null,
    ...(filtros.periodo === 'rango'
      ? { desde: filtros.desde, hasta: filtros.hasta }
      : {}),
    ...(filtros.ubicacion && filtros.radioKm !== undefined
      ? { radioKm: filtros.radioKm }
      : {}),
  };
}

export async function obtenerAlertas({
  pagina = 1,
  signal = undefined,
} = {}) {
  const { data } = await api.get('/alertas', {
    params: { page: pagina, pageSize: 20 },
    signal,
  });

  return { ...data, items: data.items.map(prepararAlerta) };
}

export async function crearAlerta(filtros) {
  const { data } = await api.post('/alertas', {
    filtros: prepararFiltros(filtros),
  });

  return prepararAlerta(data);
}

export async function actualizarAlerta(id, activa) {
  const { data } = await api.patch(
    `/alertas/${encodeURIComponent(id)}`,
    { activa }
  );

  return data;
}

export async function eliminarAlerta(id) {
  const { data } = await api.delete(
    `/alertas/${encodeURIComponent(id)}`
  );

  return data;
}

export async function marcarAlertaLeida(id) {
  const { data } = await api.post(
    `/alertas/${encodeURIComponent(id)}/leida`
  );

  return data;
}
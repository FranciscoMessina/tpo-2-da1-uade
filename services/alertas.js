import { api } from './api';
import {
  MENSAJE_RADIO_INVALIDO,
  filtrosIniciales,
  radioEfectivo,
  radioValido,
} from '../data/searchDemo';

function prepararAlerta(alerta) {
  const filtros = { ...filtrosIniciales(), ...alerta.filtros };
  const radioKm = radioEfectivo(filtros);

  return {
    ...alerta,
    // Una alerta por GPS siempre tiene radio (las anteriores usaban el de la API); por barrio no.
    filtros: radioKm === undefined ? filtros : { ...filtros, radioKm },
  };
}

function prepararFiltros(filtros) {
  const radioKm = radioEfectivo(filtros);

  // Misma validación que la API (0,1 a 500 km): se avisa antes de llamarla.
  if (radioKm !== undefined && !radioValido(radioKm)) {
    throw new Error(MENSAJE_RADIO_INVALIDO);
  }

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
    // Con GPS el radio se envía siempre, explícito; un barrio no lleva coordenadas ni radio.
    ...(radioKm === undefined ? {} : { radioKm }),
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
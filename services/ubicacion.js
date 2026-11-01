import * as Location from 'expo-location';
import { barrioMasCercano, buscarZona } from './catalogos';

// Describe unas coordenadas con un barrio del catálogo y una dirección legible.
//
// La dirección sale del geocodificador inverso del sistema (reverseGeocodeAsync, que en Android
// necesita conexión y el permiso de ubicación ya concedido). El barrio es el que el geocodificador
// nombra si el catálogo lo reconoce y, si no, el más cercano por distancia, que funciona sin red.
// Nada de esto lanza: sin red o ante un error la dirección es null y el barrio se calcula igual.

const TIMEOUT_GEOCODIFICADOR_MS = 6000;

const texto = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : '');

function conTimeout(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('Tiempo agotado')), ms);
  });

  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

async function geocodificar({ latitud, longitud }) {
  try {
    const resultados = await conTimeout(
      Location.reverseGeocodeAsync({ latitude: latitud, longitude: longitud }),
      TIMEOUT_GEOCODIFICADOR_MS
    );

    return Array.isArray(resultados) ? (resultados[0] ?? null) : null;
  } catch {
    return null;
  }
}

function armarDireccion(lugar) {
  if (!lugar) return null;

  const calle = [texto(lugar.street), texto(lugar.streetNumber)].filter(Boolean).join(' ');
  const localidad = texto(lugar.city) || texto(lugar.subregion) || texto(lugar.district);
  const direccion = [calle, localidad].filter(Boolean).join(', ');

  return direccion || null;
}

function barrioDelGeocodificador(lugar) {
  if (!lugar) return null;

  for (const candidato of [lugar.district, lugar.subregion, lugar.city]) {
    const zona = buscarZona(candidato);

    if (zona) return zona.nombre;
  }

  return null;
}

/**
 * `coords` es `{ latitud, longitud }`. Devuelve `{ barrio, direccion }`: `barrio` es el nombre de un
 * barrio del catálogo o `null` si ninguno está a 20 km; `direccion` es «Calle Altura, Localidad»
 * con lo que haya, o `null`.
 */
export async function describirUbicacion(coords) {
  const lugar = await geocodificar(coords ?? {});
  const barrio = barrioDelGeocodificador(lugar) ?? barrioMasCercano(coords ?? {})?.nombre ?? null;

  return { barrio, direccion: armarDireccion(lugar) };
}

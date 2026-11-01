import * as Location from 'expo-location';
import {
  barrioMasCercano,
  catalogoIncluido,
  restablecerCatalogo,
} from '../../services/catalogos';
import { describirUbicacion } from '../../services/ubicacion';

jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn() }));

const PALERMO = { latitud: -34.5889, longitud: -58.4306 };
const LEJOS = { latitud: -31.4201, longitud: -64.1888 }; // Córdoba

beforeEach(() => {
  restablecerCatalogo();
  Location.reverseGeocodeAsync.mockReset();
});

describe('barrioMasCercano', () => {
  test('devuelve el barrio con el centro más próximo', () => {
    expect(barrioMasCercano(PALERMO).nombre).toBe('Palermo');
    expect(barrioMasCercano({ latitud: -34.5631, longitud: -58.4562 }).nombre).toBe('Belgrano');
  });

  test('devuelve null si ninguno está dentro del máximo', () => {
    expect(barrioMasCercano(LEJOS)).toBeNull();
    expect(barrioMasCercano(PALERMO, catalogoIncluido(), 0.001)?.nombre).toBe('Palermo');
    expect(barrioMasCercano({ latitud: -34.5889, longitud: -58.4 }, catalogoIncluido(), 0.1)).toBeNull();
  });

  test('usa el catálogo recibido y rechaza coordenadas inválidas', () => {
    const catalogo = { zonas: [{ nombre: 'Único', latitud: -34.6, longitud: -58.4 }] };

    expect(barrioMasCercano(PALERMO, catalogo).nombre).toBe('Único');
    expect(barrioMasCercano({ latitud: 'x', longitud: 1 })).toBeNull();
    expect(barrioMasCercano()).toBeNull();
  });
});

describe('describirUbicacion', () => {
  test('toma el barrio del geocodificador si el catálogo lo reconoce y arma la dirección', async () => {
    Location.reverseGeocodeAsync.mockResolvedValue([
      { district: 'Villa Crespo', city: 'Buenos Aires', street: 'Av. Corrientes', streetNumber: '5000' },
    ]);

    expect(await describirUbicacion(PALERMO)).toEqual({
      barrio: 'Villa Crespo',
      direccion: 'Av. Corrientes 5000, Buenos Aires',
    });
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({
      latitude: PALERMO.latitud,
      longitude: PALERMO.longitud,
    });
  });

  test('reconoce el barrio ignorando tildes y mayúsculas, también en la subregión', async () => {
    Location.reverseGeocodeAsync.mockResolvedValue([
      { district: 'Comuna 14', subregion: 'NUÑEZ', city: null, street: null },
    ]);

    expect(await describirUbicacion(PALERMO)).toEqual({ barrio: 'Núñez', direccion: 'NUÑEZ' });
  });

  test('si el geocodificador no nombra un barrio conocido usa el más cercano', async () => {
    Location.reverseGeocodeAsync.mockResolvedValue([
      { district: 'Zona Norte', city: 'Ciudad', street: 'Calle', streetNumber: null },
    ]);

    expect(await describirUbicacion(PALERMO)).toEqual({
      barrio: 'Palermo',
      direccion: 'Calle, Ciudad',
    });
  });

  test('sin red o con error no lanza: dirección null y barrio por cercanía', async () => {
    Location.reverseGeocodeAsync.mockRejectedValue(new Error('Network'));

    expect(await describirUbicacion(PALERMO)).toEqual({ barrio: 'Palermo', direccion: null });
  });

  test('una respuesta vacía deja la dirección en null', async () => {
    Location.reverseGeocodeAsync.mockResolvedValue([]);

    expect(await describirUbicacion(PALERMO)).toEqual({ barrio: 'Palermo', direccion: null });
  });

  test('lejos de todo barrio y sin geocodificador, barrio null', async () => {
    Location.reverseGeocodeAsync.mockRejectedValue(new Error('x'));

    expect(await describirUbicacion(LEJOS)).toEqual({ barrio: null, direccion: null });
  });

  test('un geocodificador que no responde no bloquea', async () => {
    jest.useFakeTimers();
    Location.reverseGeocodeAsync.mockReturnValue(new Promise(() => {}));

    const pendiente = describirUbicacion(PALERMO);
    await jest.advanceTimersByTimeAsync(7000);

    expect(await pendiente).toEqual({ barrio: 'Palermo', direccion: null });
    jest.useRealTimers();
  });
});

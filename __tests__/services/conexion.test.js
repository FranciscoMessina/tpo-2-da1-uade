import { AxiosError, CanceledError } from 'axios';
import { api } from '../../services/api';
import {
  esErrorDeConectividad,
  estaConectado,
  reportarFalloConexion,
  suscribirConexion,
  verificarConexion,
} from '../../services/conexion';

function errorConRespuesta(status) {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: {},
    headers: {},
    config: {},
  });
}

// Promesa que se resuelve o rechaza a mano, para controlar cuándo «responde» el servidor
function diferida() {
  const d = {};
  d.promesa = new Promise((resolver, rechazar) => {
    d.resolver = resolver;
    d.rechazar = rechazar;
  });
  return d;
}

afterEach(() => jest.restoreAllMocks());

describe('esErrorDeConectividad', () => {
  test('un error de axios sin respuesta es de conectividad', () => {
    expect(esErrorDeConectividad(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true);
    expect(esErrorDeConectividad(new AxiosError('timeout', 'ECONNABORTED'))).toBe(true);
  });

  test('un error HTTP con respuesta no lo es', () => {
    [401, 404, 422, 500].forEach((status) => {
      expect(esErrorDeConectividad(errorConRespuesta(status))).toBe(false);
    });
  });

  test('una cancelación no lo es', () => {
    expect(esErrorDeConectividad(new CanceledError('canceled'))).toBe(false);
  });

  test('un error que no es de axios no lo es', () => {
    expect(esErrorDeConectividad(new Error('otro'))).toBe(false);
    expect(esErrorDeConectividad(null)).toBe(false);
    expect(esErrorDeConectividad(undefined)).toBe(false);
  });
});

describe('verificarConexion', () => {
  test('si el backend responde queda disponible', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({ data: [] });

    expect(await verificarConexion()).toBe(true);
    expect(estaConectado()).toBe(true);
  });

  test('pide un endpoint público sin enviar el token de sesión', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [] });

    await verificarConexion();

    expect(get).toHaveBeenCalledWith(
      '/categorias',
      expect.objectContaining({ headers: { Authorization: false } })
    );
  });

  test('cualquier respuesta HTTP, incluso un 500, cuenta como disponible', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(errorConRespuesta(500));
    expect(await verificarConexion()).toBe(true);

    jest.spyOn(api, 'get').mockRejectedValue(errorConRespuesta(404));
    expect(await verificarConexion()).toBe(true);
  });

  test('sin respuesta del servidor queda sin conexión y avisa a los oyentes', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    const oyente = jest.fn();
    const desuscribir = suscribirConexion(oyente);

    expect(await verificarConexion()).toBe(false);
    expect(estaConectado()).toBe(false);
    expect(oyente).toHaveBeenCalledWith(false);

    desuscribir();
  });

  test('al volver el servidor, el estado y los oyentes se actualizan', async () => {
    reportarFalloConexion();
    expect(estaConectado()).toBe(false);
    const oyente = jest.fn();
    const desuscribir = suscribirConexion(oyente);
    jest.spyOn(api, 'get').mockResolvedValue({ data: [] });

    await verificarConexion();

    expect(estaConectado()).toBe(true);
    expect(oyente).toHaveBeenCalledWith(true);
    desuscribir();
  });

  test('un oyente desuscripto no recibe más avisos', async () => {
    const oyente = jest.fn();
    suscribirConexion(oyente)();
    jest.spyOn(api, 'get').mockResolvedValue({ data: [] });
    reportarFalloConexion();

    await verificarConexion();

    expect(oyente).not.toHaveBeenCalled();
  });

  test('reutiliza la promesa en curso: no hay pings superpuestos', async () => {
    const respuesta = diferida();
    const get = jest.spyOn(api, 'get').mockReturnValue(respuesta.promesa);

    const primera = verificarConexion();
    const segunda = verificarConexion();
    const tercera = verificarConexion();

    expect(segunda).toBe(primera);
    expect(tercera).toBe(primera);
    expect(get).toHaveBeenCalledTimes(1);

    respuesta.resolver({ data: [] });
    expect(await primera).toBe(true);
  });

  test('terminado el ping, el siguiente chequeo hace una nueva petición', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: [] });

    await verificarConexion();
    await verificarConexion();

    expect(get).toHaveBeenCalledTimes(2);
  });
});

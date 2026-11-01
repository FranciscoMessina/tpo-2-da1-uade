import { AxiosError } from 'axios';
import {
  MENSAJE_SERVIDOR_NO_DISPONIBLE,
  MENSAJE_SIN_INTERNET,
  api,
  mensajeErrorApi,
  motivoSinConexion,
} from '../../services/api';
import {
  estaConectado,
  iniciarSondeo,
  suscribirConexion,
  verificarConexion,
} from '../../services/conexion';
import { hayInternet, iniciarMonitorRed, suscribirRed } from '../../services/red';
import { controlarAppState, restaurarAppState } from '../hooks/entorno';

// Doble de expo-network de jest.setup.js, con __emitir y __restablecer para simular el sistema
const Network = jest.requireMock('expo-network');

const sinRespuesta = () => new AxiosError('Network Error', 'ERR_NETWORK');
const vaciar = () => new Promise((resolver) => setImmediate(resolver));

beforeEach(() => {
  Network.__restablecer();
  jest.spyOn(api, 'get').mockResolvedValue({ data: [] });
});

afterEach(async () => {
  // Deja el estado compartido como al principio: red presente y backend disponible
  const detener = iniciarMonitorRed();
  Network.__emitir({ isConnected: true });
  detener();
  await verificarConexion();
  restaurarAppState();
  jest.restoreAllMocks();
});

describe('red del dispositivo', () => {
  test('lee el estado inicial y sigue los cambios del sistema', async () => {
    const oyente = jest.fn();
    const desuscribir = suscribirRed(oyente);
    const detener = iniciarMonitorRed();
    await vaciar();

    expect(hayInternet()).toBe(true);

    Network.__emitir({ isConnected: false });
    expect(hayInternet()).toBe(false);
    expect(oyente).toHaveBeenLastCalledWith(false);

    Network.__emitir({ isConnected: true });
    expect(hayInternet()).toBe(true);
    expect(oyente).toHaveBeenLastCalledWith(true);

    detener();
    desuscribir();
  });

  test('una red conectada pero sin salida a internet no cuenta como sin red', async () => {
    // Wi-Fi local o portal cautivo: el backend puede ser alcanzable, lo decide el ping
    const detener = iniciarMonitorRed();
    await vaciar();

    Network.__emitir({ isConnected: true, isInternetReachable: false });

    expect(hayInternet()).toBe(true);
    detener();
  });

  test('si el módulo nativo falla no rompe y queda el ping como fuente', async () => {
    jest.mocked(Network.getNetworkStateAsync).mockRejectedValueOnce(new Error('sin módulo'));

    const detener = iniciarMonitorRed();
    await vaciar();

    expect(hayInternet()).toBe(true);
    detener();
  });

  test('al detener el monitor deja de escuchar', async () => {
    const detener = iniciarMonitorRed();
    await vaciar();
    detener();

    Network.__emitir({ isConnected: false });

    expect(hayInternet()).toBe(true);
  });
});

describe('mensajes según la red', () => {
  test('con red y sin respuesta del servidor dice que el servidor no está disponible', () => {
    expect(mensajeErrorApi(sinRespuesta())).toBe(MENSAJE_SERVIDOR_NO_DISPONIBLE);
    expect(motivoSinConexion(MENSAJE_SERVIDOR_NO_DISPONIBLE)).toBe('servidor');
  });

  test('sin red en el dispositivo dice que no hay conexión a internet', async () => {
    const detener = iniciarMonitorRed();
    await vaciar();
    Network.__emitir({ isConnected: false });

    expect(mensajeErrorApi(sinRespuesta())).toBe(MENSAJE_SIN_INTERNET);
    expect(motivoSinConexion(`Algo falló. ${MENSAJE_SIN_INTERNET}`)).toBe('internet');
    detener();
  });

  test('un texto que no es de conexión no tiene motivo', () => {
    expect(motivoSinConexion('No pudimos completar la solicitud.')).toBeNull();
    expect(motivoSinConexion(undefined)).toBeNull();
  });
});

describe('conexión con la red del dispositivo', () => {
  test('cortarse la red deja el backend sin conexión al instante, sin pedirle nada', async () => {
    controlarAppState('background');
    const oyente = jest.fn();
    const desuscribir = suscribirConexion(oyente);
    const detener = iniciarSondeo();
    await vaciar();

    Network.__emitir({ isConnected: false });

    expect(estaConectado()).toBe(false);
    expect(oyente).toHaveBeenCalledWith(false);
    expect(api.get).not.toHaveBeenCalled();

    // Mientras no haya red tampoco se hace el ping
    expect(await verificarConexion()).toBe(false);
    expect(api.get).not.toHaveBeenCalled();

    detener();
    desuscribir();
  });

  test('al volver la red se comprueba el backend enseguida', async () => {
    controlarAppState('background');
    const detener = iniciarSondeo();
    await vaciar();
    Network.__emitir({ isConnected: false });
    expect(estaConectado()).toBe(false);

    Network.__emitir({ isConnected: true });
    await vaciar();

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(estaConectado()).toBe(true);
    detener();
  });

  test('con red pero sin respuesta del backend queda sin conexión por el ping', async () => {
    jest.mocked(api.get).mockRejectedValue(sinRespuesta());

    expect(await verificarConexion()).toBe(false);
    expect(estaConectado()).toBe(false);
    expect(hayInternet()).toBe(true);
  });
});

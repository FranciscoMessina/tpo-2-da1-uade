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

describe('orden de la lectura inicial y los eventos', () => {
  // Lectura inicial que resuelve cuando el test lo decide, como una consulta lenta al sistema
  function lecturaDiferida() {
    let resolver;
    let rechazar;
    const promesa = new Promise((res, rej) => {
      resolver = res;
      rechazar = rej;
    });
    jest.mocked(Network.getNetworkStateAsync).mockReturnValueOnce(promesa);
    return { resolver, rechazar };
  }

  test('un evento online no lo pisa una lectura inicial offline que llega tarde', async () => {
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();

    Network.__emitir({ isConnected: false });
    Network.__emitir({ isConnected: true });
    lectura.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(true);
    detener();
  });

  test('un evento offline no lo pisa una lectura inicial online que llega tarde', async () => {
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();

    Network.__emitir({ isConnected: false });
    lectura.resolver({ isConnected: true });
    await vaciar();

    expect(hayInternet()).toBe(false);
    detener();
  });

  test('sin eventos la lectura inicial sí se aplica', async () => {
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();

    lectura.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(false);
    detener();
  });

  test('si la lectura inicial falla, los eventos siguen funcionando', async () => {
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();

    lectura.rechazar(new Error('sin módulo'));
    await vaciar();
    Network.__emitir({ isConnected: false });

    expect(hayInternet()).toBe(false);
    detener();
  });

  test('si no se puede instalar el listener la lectura inicial igual se aplica', async () => {
    jest.mocked(Network.addNetworkStateListener).mockImplementationOnce(() => {
      throw new Error('sin listener');
    });
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();

    lectura.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(false);
    detener();
  });

  test('un monitor detenido antes de que resuelva la lectura no escribe nada', async () => {
    const lectura = lecturaDiferida();
    const detener = iniciarMonitorRed();
    detener();

    lectura.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(true);
  });

  test('un monitor reiniciado no hereda el evento del anterior', async () => {
    const primera = lecturaDiferida();
    const detenerPrimero = iniciarMonitorRed();
    Network.__emitir({ isConnected: true });
    detenerPrimero();
    primera.resolver({ isConnected: true });
    await vaciar();

    // El segundo monitor no vio ningún evento: su lectura inicial es la que vale
    const segunda = lecturaDiferida();
    const detenerSegundo = iniciarMonitorRed();
    segunda.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(false);
    detenerSegundo();
  });

  test('tras reconectar y llegar una lectura offline vieja se puede consultar al backend', async () => {
    controlarAppState('background');
    const lectura = lecturaDiferida();
    const detener = iniciarSondeo();

    Network.__emitir({ isConnected: false });
    Network.__emitir({ isConnected: true });
    await vaciar();
    api.get.mockClear();

    lectura.resolver({ isConnected: false });
    await vaciar();

    expect(hayInternet()).toBe(true);
    expect(await verificarConexion()).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(1);
    detener();
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

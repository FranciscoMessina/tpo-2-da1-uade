import { AxiosError } from 'axios';
import { api, MENSAJE_SERVIDOR_NO_DISPONIBLE, esMensajeSinConexion, mensajeErrorApi } from '../../services/api';
import { iniciarSondeo, verificarConexion } from '../../services/conexion';
import { controlarAppState, restaurarAppState } from '../hooks/entorno';

const adapterOriginal = api.defaults.adapter;

function errorDeRed(config) {
  return new AxiosError('Network Error', 'ERR_NETWORK', config);
}

afterEach(() => {
  api.defaults.adapter = adapterOriginal;
  restaurarAppState();
  jest.restoreAllMocks();
});

describe('mensajeErrorApi sin conexión', () => {
  test('sin respuesta del servidor devuelve el mensaje único de falta de conexión', () => {
    expect(mensajeErrorApi(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
      MENSAJE_SERVIDOR_NO_DISPONIBLE
    );
  });

  test('un timeout conserva su propio mensaje: el servidor tardó, no falta la conexión', () => {
    const mensaje = mensajeErrorApi(new AxiosError('timeout', 'ECONNABORTED'));

    expect(mensaje).toMatch(/tardó demasiado/);
    expect(esMensajeSinConexion(mensaje)).toBe(false);
  });

  test('un error HTTP muestra lo que dijo el servidor y no el aviso de conexión', () => {
    const error = new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 500,
      data: {},
      headers: {},
      config: {},
    });

    expect(esMensajeSinConexion(mensajeErrorApi(error))).toBe(false);
  });

  test('el mensaje se reconoce aunque venga dentro de otro texto', () => {
    expect(esMensajeSinConexion(`No se pudieron actualizar las novedades. ${MENSAJE_SERVIDOR_NO_DISPONIBLE}`)).toBe(true);
    expect(esMensajeSinConexion('Otro error')).toBe(false);
    expect(esMensajeSinConexion(undefined)).toBe(false);
  });
});

describe('iniciarSondeo y las peticiones reales', () => {
  function simularRed() {
    const urls = [];
    api.defaults.adapter = jest.fn(async (config) => {
      urls.push(config.url);
      throw errorDeRed(config);
    });
    return urls;
  }

  test('una petición que falla por conectividad comprueba la conexión enseguida', async () => {
    controlarAppState('background'); // sin sondeo periódico: solo cuenta la petición real
    const urls = simularRed();
    const detener = iniciarSondeo();

    await expect(api.get('/publicaciones')).rejects.toBeTruthy();
    await verificarConexion(); // espera al ping que dejó en curso el interceptor

    expect(urls).toEqual(['/publicaciones', '/categorias']);
    detener();
  });

  test('un error con respuesta del servidor no dispara la comprobación', async () => {
    controlarAppState('background');
    const urls = [];
    api.defaults.adapter = jest.fn(async (config) => {
      urls.push(config.url);
      throw new AxiosError('fallo', 'ERR_BAD_RESPONSE', config, undefined, {
        status: 404,
        data: {},
        headers: {},
        config,
      });
    });
    const detener = iniciarSondeo();

    await expect(api.get('/publicaciones/9')).rejects.toBeTruthy();

    expect(urls).toEqual(['/publicaciones/9']);
    detener();
  });

  test('al detener el sondeo se quita el interceptor', async () => {
    controlarAppState('background');
    const urls = simularRed();
    iniciarSondeo()();

    await expect(api.get('/publicaciones')).rejects.toBeTruthy();

    expect(urls).toEqual(['/publicaciones']);
  });
});

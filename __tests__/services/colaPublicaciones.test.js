import { AxiosError, CanceledError } from 'axios';
import {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  ESTADOS,
  MAX_FALLOS_SERVIDOR,
  calcularBackoff,
  clasificarError,
  crearItem,
  marcarEnviando,
  marcarError,
  marcarFalloConectividad,
  marcarFalloServidor,
  reiniciarEnviando,
  reintentar,
  siguienteItem,
} from '../../services/colaPublicaciones';

const DATOS = { titulo: 'Llaves', fotos: [] };
const AHORA = 1_000_000;

const item = (clientId, cambios = {}) => ({
  ...crearItem({ datos: DATOS, clientId, ahora: AHORA }),
  ...cambios,
});

const porId = (cola, id) => cola.find((i) => i.id === id);

function errorHttp(status) {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: {},
    headers: {},
    config: {},
  });
}

describe('calcularBackoff', () => {
  test('duplica la espera con cada fallo', () => {
    expect(calcularBackoff(1)).toBe(BACKOFF_BASE_MS);
    expect(calcularBackoff(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(calcularBackoff(3)).toBe(BACKOFF_BASE_MS * 4);
  });

  test('no supera el tope', () => {
    expect(calcularBackoff(50)).toBe(BACKOFF_MAX_MS);
  });

  test('sin fallos (o un valor inválido) no hay espera', () => {
    expect(calcularBackoff(0)).toBe(0);
    expect(calcularBackoff(-3)).toBe(0);
    expect(calcularBackoff(NaN)).toBe(0);
  });
});

describe('siguienteItem', () => {
  test('devuelve el primer pendiente en orden de creación', () => {
    const cola = [item('a'), item('b')];
    expect(siguienteItem(cola, AHORA).id).toBe('a');
  });

  test('saltea los ítems con error', () => {
    const cola = [item('a', { estado: ESTADOS.ERROR }), item('b')];
    expect(siguienteItem(cola, AHORA).id).toBe('b');
  });

  test('si hay un envío en curso no devuelve ninguno', () => {
    const cola = [item('a', { estado: ESTADOS.ENVIANDO }), item('b')];
    expect(siguienteItem(cola, AHORA)).toBeNull();
  });

  test('respeta la espera del primer pendiente sin adelantar a los siguientes', () => {
    const cola = [item('a', { proximoIntentoAt: AHORA + 5000 }), item('b')];
    expect(siguienteItem(cola, AHORA)).toBeNull();
  });

  test('cuando la espera venció, el ítem vuelve a estar disponible', () => {
    const cola = [item('a', { proximoIntentoAt: AHORA + 5000 }), item('b')];
    expect(siguienteItem(cola, AHORA + 5000).id).toBe('a');
  });

  test('una cola vacía o sin pendientes devuelve null', () => {
    expect(siguienteItem([], AHORA)).toBeNull();
    expect(siguienteItem([item('a', { estado: ESTADOS.ERROR })], AHORA)).toBeNull();
  });
});

describe('transiciones de estado', () => {
  test('marcarEnviando cambia solo el ítem indicado y no modifica la cola original', () => {
    const cola = [item('a'), item('b')];
    const nueva = marcarEnviando(cola, 'a', AHORA + 1);

    expect(porId(nueva, 'a').estado).toBe(ESTADOS.ENVIANDO);
    expect(porId(nueva, 'b').estado).toBe(ESTADOS.PENDIENTE);
    expect(porId(cola, 'a').estado).toBe(ESTADOS.PENDIENTE);
  });

  test('un fallo de conectividad vuelve a pendiente con espera exponencial y sin sumar fallos del servidor', () => {
    let cola = [item('a', { estado: ESTADOS.ENVIANDO })];

    cola = marcarFalloConectividad(cola, 'a', AHORA);
    expect(porId(cola, 'a')).toMatchObject({
      estado: ESTADOS.PENDIENTE,
      intentos: 1,
      fallosServidor: 0,
      proximoIntentoAt: AHORA + calcularBackoff(1),
    });

    cola = marcarFalloConectividad(cola, 'a', AHORA);
    expect(porId(cola, 'a')).toMatchObject({
      intentos: 2,
      proximoIntentoAt: AHORA + calcularBackoff(2),
    });
  });

  test('muchos fallos de conectividad seguidos nunca pasan el ítem a error', () => {
    let cola = [item('a')];
    for (let i = 0; i < MAX_FALLOS_SERVIDOR * 3; i += 1) {
      cola = marcarFalloConectividad(cola, 'a', AHORA);
    }
    expect(porId(cola, 'a').estado).toBe(ESTADOS.PENDIENTE);
  });

  test('los fallos del servidor reintentan hasta el límite y luego pasan a error', () => {
    let cola = [item('a')];

    for (let i = 1; i < MAX_FALLOS_SERVIDOR; i += 1) {
      cola = marcarFalloServidor(cola, 'a', 'Error 500', AHORA);
      expect(porId(cola, 'a')).toMatchObject({
        estado: ESTADOS.PENDIENTE,
        fallosServidor: i,
        ultimoError: 'Error 500',
      });
    }

    cola = marcarFalloServidor(cola, 'a', 'Error 500', AHORA);
    expect(porId(cola, 'a')).toMatchObject({
      estado: ESTADOS.ERROR,
      fallosServidor: MAX_FALLOS_SERVIDOR,
      proximoIntentoAt: null,
      ultimoError: 'Error 500',
    });
  });

  test('marcarError deja el ítem con error, sin espera y con el mensaje', () => {
    const cola = marcarError([item('a', { proximoIntentoAt: AHORA })], 'a', 'Título inválido', AHORA);
    expect(porId(cola, 'a')).toMatchObject({
      estado: ESTADOS.ERROR,
      proximoIntentoAt: null,
      ultimoError: 'Título inválido',
    });
  });

  test('marcarError sin mensaje usa uno genérico', () => {
    const cola = marcarError([item('a')], 'a', '', AHORA);
    expect(porId(cola, 'a').ultimoError).not.toBe('');
  });

  test('reintentar reinicia un ítem con error pero no toca a los demás estados', () => {
    const cola = [
      item('a', { estado: ESTADOS.ERROR, intentos: 4, fallosServidor: 5, ultimoError: 'x' }),
      item('b', { intentos: 2 }),
    ];

    const nueva = reintentar(reintentar(cola, 'a', AHORA), 'b', AHORA);
    expect(porId(nueva, 'a')).toMatchObject({
      estado: ESTADOS.PENDIENTE,
      intentos: 0,
      fallosServidor: 0,
      ultimoError: '',
    });
    expect(porId(nueva, 'b').intentos).toBe(2);
  });

  test('reiniciarEnviando devuelve a pendiente solo los ítems «enviando»', () => {
    const cola = [
      item('a', { estado: ESTADOS.ENVIANDO }),
      item('b', { estado: ESTADOS.ERROR }),
      item('c'),
    ];

    const nueva = reiniciarEnviando(cola, AHORA);
    expect(nueva.map((i) => i.estado)).toEqual([
      ESTADOS.PENDIENTE,
      ESTADOS.ERROR,
      ESTADOS.PENDIENTE,
    ]);
  });

  test('reiniciarEnviando devuelve la misma cola si no hay nada que reiniciar', () => {
    const cola = [item('a')];
    expect(reiniciarEnviando(cola, AHORA)).toBe(cola);
  });
});

describe('clasificarError', () => {
  test('un error sin respuesta es de conectividad', () => {
    expect(clasificarError(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('conectividad');
    expect(clasificarError(new AxiosError('timeout', 'ECONNABORTED'))).toBe('conectividad');
  });

  test('401 es de sesión', () => {
    expect(clasificarError(errorHttp(401))).toBe('sesion');
  });

  test('5xx, 408, 425 y 429 son del servidor', () => {
    [500, 502, 503, 408, 425, 429].forEach((status) => {
      expect(clasificarError(errorHttp(status))).toBe('servidor');
    });
  });

  test('422 y otros 4xx son un rechazo', () => {
    [400, 403, 404, 422].forEach((status) => {
      expect(clasificarError(errorHttp(status))).toBe('rechazo');
    });
  });

  test('una cancelación de axios o un AbortError se clasifican como cancelado', () => {
    expect(clasificarError(new CanceledError('canceled'))).toBe('cancelado');
    const abortar = new Error('abortado');
    abortar.name = 'AbortError';
    expect(clasificarError(abortar)).toBe('cancelado');
  });

  test('un error que no es de axios (p. ej. foto inválida) es un rechazo', () => {
    expect(clasificarError(new Error('Seleccioná una foto válida'))).toBe('rechazo');
  });
});

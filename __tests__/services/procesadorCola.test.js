import { AxiosError } from 'axios';
import { api } from '../../services/api';
import { procesarCola } from '../../services/procesadorCola';
import {
  ESTADOS,
  crearItem,
  descartarDeCola,
  leerCola,
  modificarCola,
} from '../../services/colaPublicaciones';

const UID = 'usuario-1';
const AHORA = 2_000_000;

const datos = (titulo, fotos = []) => ({
  tipo: 'perdi',
  titulo,
  categoria: 'Llaves',
  descripcion: 'Descripción',
  barrio: 'Palermo',
  fecha: '2026-10-01',
  hora: '09:00',
  direccionExacta: 'Calle 1',
  fotos,
});

async function sembrar(...items) {
  await modificarCola(UID, () => items);
}

const itemCola = (clientId, titulo = clientId, extra = {}) => ({
  ...crearItem({ datos: datos(titulo, extra.fotos), clientId, ahora: AHORA - 1000 }),
  ...extra.item,
});

function errorHttp(status, mensaje = 'Rechazado') {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: { error: { message: mensaje } },
    headers: {},
    config: {},
  });
}

const errorRed = () => new AxiosError('Network Error', 'ERR_NETWORK');

// Opciones comunes: hay conexión, los archivos existen y el reloj está fijo
const opciones = (extra = {}) => ({
  hayConexion: () => true,
  existe: () => true,
  ahora: () => AHORA,
  alFallarConexion: jest.fn(),
  ...extra,
});

describe('procesarCola', () => {
  test('sin conexión no envía nada y deja la cola intacta', async () => {
    await sembrar(itemCola('a'));
    const crear = jest.fn();

    const resultado = await procesarCola(UID, opciones({ crear, hayConexion: () => false }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'sin-conexion' });
    expect(crear).not.toHaveBeenCalled();
    expect(await leerCola(UID)).toHaveLength(1);
  });

  test('una cola vacía no hace nada', async () => {
    const crear = jest.fn();
    const resultado = await procesarCola(UID, opciones({ crear }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'vacia' });
    expect(crear).not.toHaveBeenCalled();
  });

  test('envía los pendientes en orden, con su clientId, y vacía la cola', async () => {
    await sembrar(itemCola('a'), itemCola('b'));
    const crear = jest.fn(async (d) => ({ id: `srv-${d.titulo}` }));
    const alEnviar = jest.fn();

    const resultado = await procesarCola(UID, opciones({ crear, alEnviar }));

    expect(resultado).toEqual({ enviadas: 2, motivo: 'vacia' });
    expect(crear.mock.calls.map(([d, o]) => [d.titulo, o.clientId])).toEqual([
      ['a', 'a'],
      ['b', 'b'],
    ]);
    expect(alEnviar).toHaveBeenCalledTimes(2);
    expect(await leerCola(UID)).toEqual([]);
  });

  test('un fallo de conectividad deja el ítem pendiente con espera y corta el procesamiento', async () => {
    await sembrar(itemCola('a'), itemCola('b'));
    const crear = jest.fn().mockRejectedValue(errorRed());
    const alFallarConexion = jest.fn();

    const resultado = await procesarCola(UID, opciones({ crear, alFallarConexion }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'sin-conexion' });
    expect(crear).toHaveBeenCalledTimes(1);
    expect(alFallarConexion).toHaveBeenCalledTimes(1);

    const [a, b] = await leerCola(UID);
    expect(a).toMatchObject({ estado: ESTADOS.PENDIENTE, intentos: 1 });
    expect(a.proximoIntentoAt).toBeGreaterThan(AHORA);
    expect(b).toMatchObject({ estado: ESTADOS.PENDIENTE, intentos: 0 });
  });

  test('si se corta la red y se reintenta, el alta usa siempre el mismo clientId y se crea una sola vez', async () => {
    await sembrar(itemCola('app-123', 'Mochila'));

    // El «servidor» deduplica por clientId, igual que el backend real
    const creadas = new Map();
    let fallar = true;
    const crear = jest.fn(async (d, { clientId }) => {
      if (fallar) {
        fallar = false;
        throw errorRed();
      }
      if (!creadas.has(clientId)) creadas.set(clientId, { id: creadas.size + 1, titulo: d.titulo });
      return creadas.get(clientId);
    });

    const primera = await procesarCola(UID, opciones({ crear }));
    expect(primera.motivo).toBe('sin-conexion');

    // Pasa el tiempo de espera y se reintenta (también «enviar ahora» con ignorarEspera)
    const segunda = await procesarCola(UID, opciones({ crear, ignorarEspera: true }));

    expect(segunda).toEqual({ enviadas: 1, motivo: 'vacia' });
    expect(crear.mock.calls.map(([, o]) => o.clientId)).toEqual(['app-123', 'app-123']);
    expect(creadas.size).toBe(1);
    expect(await leerCola(UID)).toEqual([]);
  });

  test('un pendiente en espera no se envía hasta que pasa el backoff', async () => {
    await sembrar(itemCola('a', 'a', { item: { proximoIntentoAt: AHORA + 10_000, intentos: 1 } }));
    const crear = jest.fn(async () => ({ id: 1 }));

    const antes = await procesarCola(UID, opciones({ crear }));
    expect(antes).toEqual({ enviadas: 0, motivo: 'espera' });
    expect(crear).not.toHaveBeenCalled();

    const despues = await procesarCola(UID, opciones({ crear, ahora: () => AHORA + 10_000 }));
    expect(despues.enviadas).toBe(1);
  });

  test('un 422 marca el ítem con error y sigue con el siguiente', async () => {
    await sembrar(itemCola('a'), itemCola('b'));
    const crear = jest.fn(async (d) => {
      if (d.titulo === 'a') throw errorHttp(422, 'Título inválido');
      return { id: 2 };
    });

    const resultado = await procesarCola(UID, opciones({ crear }));

    expect(resultado).toEqual({ enviadas: 1, motivo: 'vacia' });
    const cola = await leerCola(UID);
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({
      clientId: 'a',
      estado: ESTADOS.ERROR,
      ultimoError: 'Título inválido',
    });
  });

  test('un pendiente viejo sin hora ni dirección recibe un 422: queda con error visible, sin reintentos y sin perder los demás', async () => {
    const viejo = (clientId) => ({
      ...itemCola(clientId),
      datos: { ...datos(clientId), hora: undefined, direccionExacta: undefined },
    });
    await sembrar(viejo('viejo'), itemCola('b'));
    const crear = jest.fn(async (d) => {
      if (!d.hora) throw errorHttp(422, 'Ingresá la hora del suceso.');
      return { id: 2 };
    });

    const resultado = await procesarCola(UID, opciones({ crear }));
    expect(resultado).toEqual({ enviadas: 1, motivo: 'vacia' });
    expect(crear).toHaveBeenCalledTimes(2);

    const cola = await leerCola(UID);
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({
      clientId: 'viejo',
      estado: ESTADOS.ERROR,
      ultimoError: 'Ingresá la hora del suceso.',
      proximoIntentoAt: null,
    });

    // Otro procesamiento no lo reintenta: espera a que se edite o se descarte.
    await procesarCola(UID, opciones({ crear }));
    expect(crear).toHaveBeenCalledTimes(2);
    expect(await descartarDeCola(UID, 'viejo')).toBe(true);
    expect(await leerCola(UID)).toEqual([]);
  });

  test('un 500 reintenta más tarde y detiene el procesamiento con motivo «fallo»', async () => {
    await sembrar(itemCola('a'), itemCola('b'));
    const crear = jest.fn().mockRejectedValue(errorHttp(500, 'Error interno'));

    const resultado = await procesarCola(UID, opciones({ crear }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'fallo' });
    expect(crear).toHaveBeenCalledTimes(1);
    const [a] = await leerCola(UID);
    expect(a).toMatchObject({ estado: ESTADOS.PENDIENTE, fallosServidor: 1 });
  });

  test('un 401 deja el ítem pendiente, sin sumar intentos, para cuando se resuelva la sesión', async () => {
    await sembrar(itemCola('a'));
    const crear = jest.fn().mockRejectedValue(errorHttp(401));

    const resultado = await procesarCola(UID, opciones({ crear }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'sesion' });
    const [a] = await leerCola(UID);
    expect(a).toMatchObject({ estado: ESTADOS.PENDIENTE, intentos: 0 });
  });

  test('si falta una foto local sin subir, el ítem pasa a error sin llamar al servidor', async () => {
    await sembrar(itemCola('a', 'a', { fotos: ['file:///documentos/foto.jpg'] }));
    const crear = jest.fn();

    const resultado = await procesarCola(UID, opciones({ crear, existe: () => false }));

    expect(resultado.enviadas).toBe(0);
    expect(crear).not.toHaveBeenCalled();
    const [a] = await leerCola(UID);
    expect(a.estado).toBe(ESTADOS.ERROR);
    expect(a.ultimoError).toMatch(/foto/i);
  });

  test('pasa a crear el mapa de fotos ya subidas que estaba persistido', async () => {
    const uri = 'file:///documentos/foto.jpg';
    await sembrar(
      itemCola('a', 'a', { fotos: [uri], item: { fotosSubidas: { [uri]: '/uploads/images/1.jpg' } } })
    );
    const crear = jest.fn(async () => ({ id: 1 }));

    await procesarCola(UID, opciones({ crear }));

    const { fotosSubidas } = crear.mock.calls[0][1];
    expect(fotosSubidas.get(uri)).toBe('/uploads/images/1.jpg');
  });

  test('ignorarEspera libera la espera de backoff de los pendientes', async () => {
    await sembrar(itemCola('a', 'a', { item: { proximoIntentoAt: AHORA + 60_000 } }));
    const crear = jest.fn(async () => ({ id: 1 }));

    const resultado = await procesarCola(UID, opciones({ crear, ignorarEspera: true }));

    expect(resultado.enviadas).toBe(1);
  });

  test('una señal ya abortada no envía nada', async () => {
    await sembrar(itemCola('a'));
    const crear = jest.fn();
    const controlador = new AbortController();
    controlador.abort();

    const resultado = await procesarCola(UID, opciones({ crear, signal: controlador.signal }));

    expect(resultado).toEqual({ enviadas: 0, motivo: 'cancelado' });
    expect(crear).not.toHaveBeenCalled();
  });

  test('pedidos simultáneos comparten una sola ejecución', async () => {
    await sembrar(itemCola('a'));
    const crear = jest.fn(async () => ({ id: 1 }));

    const [uno, dos] = await Promise.all([
      procesarCola(UID, opciones({ crear })),
      procesarCola(UID, opciones({ crear })),
    ]);

    expect(crear).toHaveBeenCalledTimes(1);
    expect(dos).toBe(uno);
  });
});

describe('procesarCola con el alta real (api simulada)', () => {
  afterEach(() => jest.restoreAllMocks());

  test('un corte tras subir la foto no la vuelve a subir ni duplica el alta al reintentar', async () => {
    const uri = 'file:///documentos/foto.jpg';
    await sembrar(itemCola('app-xyz', 'Billetera', { fotos: [uri] }));

    let altasIntentadas = 0;
    const post = jest.spyOn(api, 'post').mockImplementation(async (url, cuerpo) => {
      if (url === '/uploads/images') return { data: { url: '/uploads/images/foto-1.jpg' } };
      altasIntentadas += 1;
      if (altasIntentadas === 1) throw errorRed();
      return { data: { id: 'srv-1', ...cuerpo, fotos: cuerpo.fotos } };
    });

    const primera = await procesarCola(UID, opciones({ ignorarEspera: true }));
    expect(primera.motivo).toBe('sin-conexion');

    // La foto quedó registrada como subida en la cola persistida
    const [pendiente] = await leerCola(UID);
    expect(pendiente.fotosSubidas).toEqual({ [uri]: '/uploads/images/foto-1.jpg' });

    const segunda = await procesarCola(UID, opciones({ ignorarEspera: true }));
    expect(segunda).toEqual({ enviadas: 1, motivo: 'vacia' });

    const subidas = post.mock.calls.filter(([url]) => url === '/uploads/images');
    const altas = post.mock.calls.filter(([url]) => url === '/publicaciones');
    expect(subidas).toHaveLength(1);
    expect(altas).toHaveLength(2);
    expect(altas.map(([, cuerpo]) => cuerpo.clientId)).toEqual(['app-xyz', 'app-xyz']);
    expect(altas[1][1].fotos).toEqual(['/uploads/images/foto-1.jpg']);
  });
});

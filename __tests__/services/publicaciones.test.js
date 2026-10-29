import { AxiosError, CanceledError } from 'axios';
import { api, API_URL } from '../../services/api';
import { estaConectado, verificarConexion } from '../../services/conexion';
import { setUsuarioCache } from '../../services/cacheOffline';
import {
  armarCuerpoPublicacion,
  buscarPublicacionesConCache,
  crearPublicacion,
  generarClientId,
  obtenerPublicacion,
} from '../../services/publicaciones';

const FILTROS = { situacion: 'perdi', categoria: 'Llaves', periodo: 'semana' };

const publicacion = (id, extra = {}) => ({
  id,
  titulo: `Objeto ${id}`,
  descripcion: 'Descripción',
  categoria: 'Llaves',
  barrio: 'Palermo',
  tipo: 'perdido',
  estado: 'abierta',
  fotos: [],
  esPropia: false,
  ...extra,
});

const errorRed = () => new AxiosError('Network Error', 'ERR_NETWORK');

function errorHttp(status) {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: { error: { message: 'Error del servidor' } },
    headers: {},
    config: {},
  });
}

// La conexión es un estado compartido: se restablece para que una prueba no afecte a la siguiente
beforeEach(async () => {
  jest.spyOn(api, 'get').mockResolvedValue({ data: [] });
  await verificarConexion();
  jest.restoreAllMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await setUsuarioCache(null);
});

describe('buscarPublicacionesConCache', () => {
  beforeEach(() => setUsuarioCache('A'));

  test('devuelve los resultados del servidor, con el total y la paginación', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: { items: [publicacion(1), publicacion(2)], total: 12, page: 1, pageSize: 10, totalPages: 2 },
    });

    const resultado = await buscarPublicacionesConCache(FILTROS);

    expect(resultado).toMatchObject({ total: 12, pagina: 1, totalPaginas: 2, esOffline: false });
    expect(resultado.items.map((i) => i.id)).toEqual([1, 2]);
  });

  test('convierte las rutas de fotos relativas en URLs absolutas', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: { items: [publicacion(1, { fotos: ['/uploads/images/a.jpg'] })], total: 1 },
    });

    const { items } = await buscarPublicacionesConCache(FILTROS);

    expect(items[0].fotos).toEqual([`${API_URL}/uploads/images/a.jpg`]);
  });

  test('un resultado vacío del servidor devuelve vacío, sin publicaciones de ejemplo ni marca offline', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({ data: { items: [], total: 0 } });

    const resultado = await buscarPublicacionesConCache(FILTROS);

    expect(resultado).toMatchObject({ items: [], total: 0, totalPaginas: 1, esOffline: false });
    expect(resultado.desdeCache).toBeUndefined();
  });

  test('un resultado vacío no pisa la última búsqueda guardada', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: { items: [publicacion(1)], total: 1 } });
    await buscarPublicacionesConCache(FILTROS);

    get.mockResolvedValueOnce({ data: { items: [], total: 0 } });
    await buscarPublicacionesConCache({ ...FILTROS, palabras: 'nada' });

    get.mockRejectedValueOnce(errorRed());
    const sinRed = await buscarPublicacionesConCache(FILTROS);
    expect(sinRed.items.map((i) => i.id)).toEqual([1]);
  });

  test('un error HTTP 500 se propaga y no se usa la caché', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: { items: [publicacion(1)], total: 1 } });
    await buscarPublicacionesConCache(FILTROS);

    get.mockRejectedValueOnce(errorHttp(500));

    await expect(buscarPublicacionesConCache(FILTROS)).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(estaConectado()).toBe(true);
  });

  test('una búsqueda cancelada se propaga', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(new CanceledError('canceled'));

    await expect(buscarPublicacionesConCache(FILTROS)).rejects.toBeInstanceOf(CanceledError);
  });

  test('sin red, usa la caché y la marca como offline y desdeCache', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: { items: [publicacion(1), publicacion(2)], total: 2 } });
    await buscarPublicacionesConCache(FILTROS);

    get.mockRejectedValueOnce(errorRed());
    const resultado = await buscarPublicacionesConCache({ ...FILTROS, palabras: 'otra' });

    expect(resultado).toMatchObject({ esOffline: true, desdeCache: true, total: 2 });
    expect(resultado.items.map((i) => i.id)).toEqual([1, 2]);
    expect(resultado.filtrosGuardados).toMatchObject({ categoria: 'Llaves' });
    expect(resultado.fechaGuardado).toEqual(expect.any(String));
  });

  test('sin red, la falla se refleja de inmediato en el estado de conexión', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    await buscarPublicacionesConCache(FILTROS);

    expect(estaConectado()).toBe(false);
  });

  test('sin red y sin caché devuelve vacío marcado como sin resultados previos', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    const resultado = await buscarPublicacionesConCache(FILTROS);

    expect(resultado).toMatchObject({
      items: [],
      total: 0,
      esOffline: true,
      sinResultadosPrevios: true,
    });
    expect(resultado.desdeCache).toBeUndefined();
  });

  test('la caché de otra cuenta no se muestra sin red', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: { items: [publicacion(1)], total: 1 } });
    await buscarPublicacionesConCache(FILTROS);

    await setUsuarioCache('B');
    get.mockRejectedValueOnce(errorRed());
    const resultado = await buscarPublicacionesConCache(FILTROS);

    expect(resultado.items).toEqual([]);
    expect(resultado.sinResultadosPrevios).toBe(true);
  });

  test('sin red descarta las publicaciones de ejemplo guardadas por versiones anteriores', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({
      data: { items: [publicacion('demo-1'), publicacion(7)], total: 2 },
    });
    await buscarPublicacionesConCache(FILTROS);

    get.mockRejectedValueOnce(errorRed());
    const resultado = await buscarPublicacionesConCache(FILTROS);

    expect(resultado.items.map((i) => i.id)).toEqual([7]);
  });

  test('solo la primera página actualiza la caché de la última búsqueda', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: { items: [publicacion(1)], total: 30 } });
    await buscarPublicacionesConCache(FILTROS);

    get.mockResolvedValueOnce({ data: { items: [publicacion(99)], total: 30 } });
    await buscarPublicacionesConCache(FILTROS, 'recientes', { pagina: 2 });

    get.mockRejectedValueOnce(errorRed());
    const resultado = await buscarPublicacionesConCache(FILTROS);
    expect(resultado.items.map((i) => i.id)).toEqual([1]);
  });

  test('envía los filtros como parámetros y omite los vacíos', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { items: [], total: 0 } });

    await buscarPublicacionesConCache(
      { ...FILTROS, zona: '', ubicacion: { latitud: -34.6, longitud: -58.4 } },
      'cercanas'
    );

    const [ruta, { params }] = get.mock.calls[0];
    expect(ruta).toBe('/publicaciones');
    expect(params).toMatchObject({
      situacion: 'perdi',
      categoria: 'Llaves',
      zona: undefined,
      orden: 'cercanas',
      page: 1,
      latitud: -34.6,
      longitud: -58.4,
    });
  });
});

describe('obtenerPublicacion', () => {
  beforeEach(() => setUsuarioCache('A'));

  test('un 404 se propaga aunque exista copia local', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: publicacion(5) });
    await obtenerPublicacion(5);

    get.mockRejectedValueOnce(errorHttp(404));

    await expect(obtenerPublicacion(5)).rejects.toMatchObject({ response: { status: 404 } });
  });

  test('sin red devuelve la copia guardada marcada como offline', async () => {
    const get = jest.spyOn(api, 'get');
    get.mockResolvedValueOnce({ data: publicacion(5) });
    await obtenerPublicacion(5);

    get.mockRejectedValueOnce(errorRed());
    const resultado = await obtenerPublicacion(5);

    expect(resultado).toMatchObject({ id: '5', desdeCache: true, esOffline: true });
  });

  test('sin red y sin copia guardada falla con un mensaje claro', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    await expect(obtenerPublicacion(404)).rejects.toThrow(/no fue guardada previamente/);
  });
});

describe('armarCuerpoPublicacion', () => {
  const datosBase = {
    titulo: '  Llaves  ',
    categoria: 'Llaves',
    descripcion: ' Con llavero ',
    barrio: ' Palermo ',
    fecha: '2026-10-01',
    franja: 'mañana',
    direccionExacta: '  ',
    preguntaVerificacion: ' ¿Cuántas? ',
    respuestaVerificacion: ' Tres ',
  };

  test.each(['encontre', 'encontrado'])('en un hallazgo («%s») incluye pregunta y respuesta', (tipo) => {
    const cuerpo = armarCuerpoPublicacion({ ...datosBase, tipo }, ['/uploads/images/1.jpg']);

    expect(cuerpo.preguntaVerificacion).toBe('¿Cuántas?');
    expect(cuerpo.respuestaVerificacion).toBe('Tres');
  });

  test('en una pérdida no envía pregunta ni respuesta', () => {
    const cuerpo = armarCuerpoPublicacion({ ...datosBase, tipo: 'perdi' }, []);

    expect(cuerpo).not.toHaveProperty('preguntaVerificacion');
    expect(cuerpo).not.toHaveProperty('respuestaVerificacion');
  });

  test('recorta los textos y manda null en la dirección vacía', () => {
    const cuerpo = armarCuerpoPublicacion({ ...datosBase, tipo: 'perdi' }, ['/uploads/images/1.jpg']);

    expect(cuerpo).toMatchObject({
      titulo: 'Llaves',
      descripcion: 'Con llavero',
      barrio: 'Palermo',
      direccionExacta: null,
      fotos: ['/uploads/images/1.jpg'],
    });
  });

  test('en un hallazgo, la pregunta y la respuesta vacías viajan como null', () => {
    const cuerpo = armarCuerpoPublicacion(
      { ...datosBase, tipo: 'encontre', preguntaVerificacion: ' ', respuestaVerificacion: undefined },
      []
    );

    expect(cuerpo.preguntaVerificacion).toBeNull();
    expect(cuerpo.respuestaVerificacion).toBeNull();
  });

  test('incluye la ubicación solo si hay', () => {
    const ubicacion = { latitud: -34.6, longitud: -58.4 };

    expect(armarCuerpoPublicacion({ ...datosBase, tipo: 'perdi', ubicacion }, [])).toHaveProperty(
      'ubicacion',
      ubicacion
    );
    expect(armarCuerpoPublicacion({ ...datosBase, tipo: 'perdi' }, [])).not.toHaveProperty('ubicacion');
  });
});

describe('crearPublicacion', () => {
  test('sube cada foto una vez y hace un solo alta con el clientId recibido', async () => {
    const post = jest.spyOn(api, 'post').mockImplementation(async (url, cuerpo) => {
      if (url === '/uploads/images') return { data: { url: '/uploads/images/nueva.jpg' } };
      return { data: { id: 'srv-1', fotos: cuerpo.fotos } };
    });

    const creada = await crearPublicacion(
      { tipo: 'perdi', titulo: 'T', categoria: 'C', descripcion: 'D', fecha: '2026-10-01', franja: 'tarde',
        fotos: ['file:///documentos/a.jpg', 'file:///documentos/ya-subida.jpg'] },
      {
        clientId: 'app-fijo',
        fotosSubidas: new Map([['file:///documentos/ya-subida.jpg', '/uploads/images/previa.jpg']]),
      }
    );

    const subidas = post.mock.calls.filter(([url]) => url === '/uploads/images');
    const altas = post.mock.calls.filter(([url]) => url === '/publicaciones');
    expect(subidas).toHaveLength(1);
    expect(altas).toHaveLength(1);
    expect(altas[0][1]).toMatchObject({
      clientId: 'app-fijo',
      fotos: ['/uploads/images/nueva.jpg', '/uploads/images/previa.jpg'],
    });
    expect(creada.fotos).toEqual([
      `${API_URL}/uploads/images/nueva.jpg`,
      `${API_URL}/uploads/images/previa.jpg`,
    ]);
  });

  test('sin clientId genera uno nuevo', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { id: 1, fotos: [] } });

    await crearPublicacion({ tipo: 'perdi', titulo: 'T', categoria: 'C', descripcion: 'D', fotos: [] });

    expect(post.mock.calls[0][1].clientId).toMatch(/^app-/);
  });

  test('una foto que no es del dispositivo se rechaza antes de crear nada', async () => {
    const post = jest.spyOn(api, 'post');

    await expect(
      crearPublicacion({ tipo: 'perdi', titulo: 'T', categoria: 'C', descripcion: 'D', fotos: ['http://x.test/a.jpg'] })
    ).rejects.toThrow(/foto válida/);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('generarClientId', () => {
  const FORMATO = /^app-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const criptografiaOriginal = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: criptografiaOriginal, configurable: true });
  });

  const reemplazarCrypto = (valor) =>
    Object.defineProperty(globalThis, 'crypto', { value: valor, configurable: true });

  test('genera ids con el formato «app-» + UUID v4', () => {
    expect(generarClientId()).toMatch(FORMATO);
  });

  test('genera ids únicos', () => {
    const ids = new Set(Array.from({ length: 200 }, generarClientId));
    expect(ids.size).toBe(200);
  });

  test('sin randomUUID usa getRandomValues y mantiene el formato', () => {
    reemplazarCrypto({
      getRandomValues: (bytes) => {
        bytes.forEach((_, i) => {
          bytes[i] = (i * 17 + 3) % 256;
        });
        return bytes;
      },
    });

    expect(generarClientId()).toMatch(FORMATO);
  });

  test('sin crypto usa Math.random y mantiene el formato y la unicidad', () => {
    reemplazarCrypto(undefined);

    const ids = new Set(Array.from({ length: 100 }, generarClientId));
    expect(ids.size).toBe(100);
    ids.forEach((id) => expect(id).toMatch(FORMATO));
  });
});

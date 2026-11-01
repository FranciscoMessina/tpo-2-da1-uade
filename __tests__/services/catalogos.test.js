import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import SearchForm from '../../components/SearchForm';
import FormularioPublicacion, {
  valoresDesdePublicacion,
} from '../../components/FormularioPublicacion';
import { CATEGORIAS, ZONAS, filtrosIniciales } from '../../data/busqueda';
import { api } from '../../services/api';
import {
  CLAVE_CATALOGO,
  actualizarCatalogo,
  buscarZona,
  cargarCatalogoGuardado,
  catalogoActual,
  catalogoIncluido,
  coordenadasPropias,
  iniciarCatalogo,
  opcionesZona,
  restablecerCatalogo,
  suscribirCatalogo,
  validarCatalogo,
  versionDeCatalogo,
} from '../../services/catalogos';
import { abrirSelectorBarrio } from '../components/ayudas';
import * as conexion from '../../services/conexion';
import { simularConectividad } from '../hooks/entorno';

// El GPS se reemplaza: las pantallas no piden permisos ni usan el dispositivo.
jest.mock('../../hooks/useUbicacionActual', () => ({
  __esModule: true,
  default: () => ({ obtener: jest.fn(), cargando: false, error: '' }),
}));

// Huella del catálogo que trae la app. Es la misma que declara el backend para el suyo
// (tests/app.test.ts, «las respuestas declaran la versión del catálogo»): si cambia a propósito la
// lista, hay que actualizar los dos valores.
const VERSION_INCLUIDA = '3c78e368';

const CATEGORIAS_API = ['Documentos', 'Llaves', 'Electrónica', 'Mascotas', 'Ropa', 'Otros', 'Bicicletas'];
const VILLA = { nombre: 'Ciudad Evita', latitud: -34.5731, longitud: -58.4887 };
const ZONAS_API = [...ZONAS, VILLA];
const VERSION_API = 'abc12345';

function respuesta(data, version = VERSION_API) {
  return { data, headers: version === null ? {} : { 'x-catalogo-version': version } };
}

// Responde cada catálogo del backend; cualquier otra ruta es un error de la prueba.
function backend({ categorias = CATEGORIAS_API, zonas = ZONAS_API, version = VERSION_API } = {}) {
  return jest.spyOn(api, 'get').mockImplementation(async (ruta) => {
    if (ruta === '/categorias') return respuesta(categorias, version);
    if (ruta === '/barrios') return respuesta(zonas, version);
    throw new Error(`ruta inesperada ${ruta}`);
  });
}

const errorRed = () => new AxiosError('Network Error', 'ERR_NETWORK');

function errorHttp(status) {
  return new AxiosError('fallo', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: { error: { message: 'Error del servidor' } },
    headers: {},
    config: {},
  });
}

const nombres = (catalogo) => catalogo.zonas.map((z) => z.nombre);
const guardado = async () => JSON.parse(await AsyncStorage.getItem(CLAVE_CATALOGO));

beforeEach(() => {
  restablecerCatalogo();
  simularConectividad(true);
});

afterEach(() => jest.restoreAllMocks());

describe('catálogo incluido en la app', () => {
  test('es el catálogo de data/busqueda, con origen y versión conocidos', () => {
    const incluido = catalogoIncluido();

    expect(incluido).toMatchObject({ origen: 'incluido', version: VERSION_INCLUIDA });
    expect(incluido.categorias).toEqual(CATEGORIAS);
    expect(incluido.zonas).toEqual(ZONAS);
    expect(ZONAS).toHaveLength(91);
    expect(catalogoActual()).toBe(incluido);
  });

  test('la versión es una huella del contenido: cambia con una categoría, un nombre o una coordenada', () => {
    const base = versionDeCatalogo(CATEGORIAS, ZONAS);

    expect(base).toBe(VERSION_INCLUIDA);
    expect(versionDeCatalogo(CATEGORIAS, ZONAS)).toBe(base);
    expect(versionDeCatalogo([...CATEGORIAS, 'Bicicletas'], ZONAS)).not.toBe(base);
    expect(versionDeCatalogo(CATEGORIAS, [...ZONAS, VILLA])).not.toBe(base);
    expect(
      versionDeCatalogo(CATEGORIAS, [{ ...ZONAS[0], latitud: -34.6 }, ...ZONAS.slice(1)])
    ).not.toBe(base);
  });

  test('conserva los nombres y el orden históricos que guardan publicaciones y alertas', () => {
    expect(CATEGORIAS).toEqual(['Documentos', 'Llaves', 'Electrónica', 'Mascotas', 'Ropa', 'Otros']);
    expect(nombres(catalogoIncluido()).slice(0, 6)).toEqual([
      'Centro',
      'Palermo',
      'Recoleta',
      'Belgrano',
      'Caballito',
      'Almagro',
    ]);
  });
});

describe('actualizarCatalogo: con conexión', () => {
  test('toma el catálogo de la API, lo marca como tal con su versión y lo guarda', async () => {
    const get = backend();
    const oyente = jest.fn();
    suscribirCatalogo(oyente);

    const catalogo = await actualizarCatalogo();

    expect(catalogo).toMatchObject({ origen: 'api', version: VERSION_API });
    expect(catalogo.categorias).toEqual(CATEGORIAS_API);
    expect(nombres(catalogo)).toContain('Ciudad Evita');
    expect(catalogoActual()).toBe(catalogo);
    expect(oyente).toHaveBeenCalledTimes(1);
    // Es un catálogo público: se pide sin el token de sesión.
    expect(get).toHaveBeenCalledWith('/categorias', expect.objectContaining({ headers: { Authorization: false } }));
    expect(get).toHaveBeenCalledWith('/barrios', expect.objectContaining({ headers: { Authorization: false } }));
    expect(await guardado()).toMatchObject({
      version: VERSION_API,
      categorias: CATEGORIAS_API,
      zonas: ZONAS_API,
    });
  });

  test('si la API no declara versión, la calcula con la misma huella', async () => {
    backend({ version: null });

    const catalogo = await actualizarCatalogo();

    expect(catalogo.version).toBe(versionDeCatalogo(CATEGORIAS_API, ZONAS_API));
  });

  test('un catálogo idéntico al actual no vuelve a avisar a las pantallas', async () => {
    backend();
    await actualizarCatalogo();
    const oyente = jest.fn();
    suscribirCatalogo(oyente);

    await actualizarCatalogo();

    expect(oyente).not.toHaveBeenCalled();
  });

  test('el catálogo de la API reemplaza al incluido: ya no se ofrecen los barrios que dejó de listar', async () => {
    backend({ zonas: ZONAS.filter((z) => z.nombre !== 'Centro') });

    const catalogo = await actualizarCatalogo();

    expect(nombres(catalogo)).not.toContain('Centro');
    expect(nombres(catalogo)).toContain('Palermo');
  });
});

describe('catálogo sin conexión y con errores', () => {
  test('sin conexión y sin copia guardada se usa el catálogo incluido, sin pedir nada', async () => {
    simularConectividad(false);
    const get = backend();

    const catalogo = await iniciarCatalogo();

    expect(get).not.toHaveBeenCalled();
    expect(catalogo).toMatchObject({ origen: 'incluido', version: VERSION_INCLUIDA });
    expect(catalogo.categorias).toEqual(CATEGORIAS);
  });

  test('sin conexión se usa el último catálogo válido guardado, con su origen y su versión', async () => {
    backend();
    await actualizarCatalogo();
    restablecerCatalogo();
    simularConectividad(false);
    const get = jest.spyOn(api, 'get');
    get.mockClear();

    const catalogo = await iniciarCatalogo();

    expect(get).not.toHaveBeenCalled();
    expect(catalogo).toMatchObject({ origen: 'cache', version: VERSION_API });
    expect(nombres(catalogo)).toContain('Ciudad Evita');
    expect(catalogoActual()).toBe(catalogo);
  });

  test('un error de red conserva el último catálogo válido, avisa la falta de conexión y no lanza', async () => {
    backend();
    await actualizarCatalogo();
    const anterior = catalogoActual();
    const reportar = jest.spyOn(conexion, 'reportarFalloConexion');
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    await expect(actualizarCatalogo()).resolves.toBe(anterior);

    expect(catalogoActual()).toBe(anterior);
    expect(reportar).toHaveBeenCalledTimes(1);
  });

  test('un error de red sin copia previa deja el catálogo incluido, listo para publicar', async () => {
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    const catalogo = await actualizarCatalogo();

    expect(catalogo).toMatchObject({ origen: 'incluido', version: VERSION_INCLUIDA });
    expect(await guardado()).toBeNull();
  });

  test('un error HTTP del servidor conserva el catálogo pero no marca al backend como caído', async () => {
    const reportar = jest.spyOn(conexion, 'reportarFalloConexion');
    jest.spyOn(api, 'get').mockRejectedValue(errorHttp(500));

    const catalogo = await actualizarCatalogo();

    expect(catalogo.origen).toBe('incluido');
    expect(reportar).not.toHaveBeenCalled();
  });

  test('una copia guardada ilegible se descarta y queda el catálogo incluido', async () => {
    await AsyncStorage.setItem(CLAVE_CATALOGO, '{no es json');

    expect(await cargarCatalogoGuardado()).toBeNull();
    expect((await iniciarCatalogo()).origen).toBe('incluido');

    await AsyncStorage.setItem(CLAVE_CATALOGO, JSON.stringify({ version: 'x', categorias: [], zonas: [] }));
    restablecerCatalogo();
    simularConectividad(false);

    expect((await iniciarCatalogo()).origen).toBe('incluido');
  });

  test('la copia guardada no pisa a un catálogo de la API que llegó antes', async () => {
    backend();
    await actualizarCatalogo();
    const reciente = catalogoActual();

    await cargarCatalogoGuardado();

    expect(catalogoActual()).toBe(reciente);
  });
});

describe('validación del catálogo recibido', () => {
  const invalidos = {
    'sin categorías': { categorias: [] },
    'categorías que no son texto': { categorias: ['Llaves', 3] },
    'categorías repetidas aunque cambien tildes o mayúsculas': { categorias: ['Electrónica', 'ELECTRONICA'] },
    'sin barrios': { zonas: [] },
    'una respuesta que no es una lista': { zonas: { nombre: 'Palermo' } },
    'barrio sin nombre': { zonas: [{ nombre: ' ', latitud: -34.6, longitud: -58.4 }] },
    'coordenadas como texto': { zonas: [{ nombre: 'Centro', latitud: '-34.6', longitud: -58.4 }] },
    'latitud fuera de rango': { zonas: [{ nombre: 'Centro', latitud: -91, longitud: -58.4 }] },
    'longitud no finita': { zonas: [{ nombre: 'Centro', latitud: -34.6, longitud: null }] },
    // Fusionarlos haría que una publicación de «Nunez» quedara en el centro de «Núñez» o al revés.
    'barrios homónimos que solo difieren en tildes o mayúsculas': {
      zonas: [
        { nombre: 'Núñez', latitud: -34.545, longitud: -58.456 },
        { nombre: 'NUNEZ', latitud: -34.9, longitud: -58.1 },
      ],
    },
  };

  test.each(Object.entries(invalidos))('rechaza %s y conserva el catálogo vigente', async (_caso, cambio) => {
    backend({ categorias: CATEGORIAS, zonas: ZONAS });
    await actualizarCatalogo();
    const vigente = catalogoActual();
    const guardada = await guardado();
    backend({ ...cambio });

    const resultado = await actualizarCatalogo();

    expect(resultado).toBe(vigente);
    expect(await guardado()).toEqual(guardada);
  });

  test('validarCatalogo devuelve null ante lo inválido y el catálogo limpio ante lo válido', () => {
    expect(validarCatalogo(null)).toBeNull();
    expect(validarCatalogo({ categorias: ['Llaves'] })).toBeNull();
    expect(validarCatalogo({ categorias: ['Llaves'], zonas: [VILLA] })).toEqual({
      categorias: ['Llaves'],
      zonas: [VILLA],
    });
  });

  test('si las dos respuestas declaran versiones distintas no se mezclan: se descarta el pedido', async () => {
    jest.spyOn(api, 'get').mockImplementation(async (ruta) =>
      ruta === '/categorias'
        ? respuesta(CATEGORIAS_API, 'aaaaaaaa')
        : respuesta(ZONAS_API, 'bbbbbbbb')
    );

    const catalogo = await actualizarCatalogo();

    expect(catalogo.origen).toBe('incluido');
    expect(await guardado()).toBeNull();
  });
});

describe('iniciarCatalogo', () => {
  test('restaura la copia guardada, la actualiza y no repite el pedido mientras sigue fresca', async () => {
    const get = backend();

    const [a, b] = await Promise.all([iniciarCatalogo(), iniciarCatalogo()]);
    await iniciarCatalogo();

    expect(a).toBe(b);
    expect(a.origen).toBe('api');
    // Una vez por catálogo: las llamadas simultáneas y las siguientes comparten el mismo pedido.
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('con `forzar` vuelve a pedirlo', async () => {
    const get = backend();
    await iniciarCatalogo();

    await iniciarCatalogo({ forzar: true });

    expect(get).toHaveBeenCalledTimes(4);
  });

  test('si el pedido falló, el siguiente intento no espera: reintenta', async () => {
    jest.spyOn(api, 'get').mockRejectedValueOnce(errorRed()).mockRejectedValueOnce(errorRed());
    await iniciarCatalogo();
    simularConectividad(true);
    const get = backend();

    const catalogo = await iniciarCatalogo();

    expect(get).toHaveBeenCalled();
    expect(catalogo.origen).toBe('api');
  });
});

describe('barrios y nombres históricos', () => {
  test('buscarZona encuentra el barrio sin importar tildes ni mayúsculas y devuelve el nombre canónico', () => {
    expect(buscarZona('PALERMO')).toEqual(ZONAS[1]);
    expect(buscarZona('  pálermo ')).toEqual(ZONAS[1]);
    expect(buscarZona('Ciudad Evita')).toBeUndefined();
  });

  test('un nombre histórico sigue resolviéndose aunque el catálogo nuevo ya no lo liste', async () => {
    backend({ zonas: [VILLA] });
    const catalogo = await actualizarCatalogo();

    expect(nombres(catalogo)).toEqual(['Ciudad Evita']);
    expect(buscarZona('Palermo', catalogo)).toEqual(ZONAS[1]);
    expect(buscarZona('Ciudad Evita', catalogo)).toEqual(VILLA);
  });

  test('si el catálogo vigente tiene un barrio, manda sobre el incluido de igual nombre', async () => {
    const nuevo = { nombre: 'Palermo', latitud: -34.58, longitud: -58.42 };
    backend({ zonas: [nuevo] });
    const catalogo = await actualizarCatalogo();

    expect(buscarZona('palermo', catalogo)).toEqual(nuevo);
  });

  test('la ubicación nunca elige un barrio: sin nombre no hay zona', () => {
    expect(buscarZona('')).toBeUndefined();
    expect(buscarZona(undefined)).toBeUndefined();
    expect(buscarZona(null)).toBeUndefined();
    expect(buscarZona('Ubicación actual')).toBeUndefined();
  });

  test('opcionesZona suma el barrio histórico elegido que el catálogo ya no lista, sin duplicar', async () => {
    backend({ zonas: [VILLA] });
    const catalogo = await actualizarCatalogo();

    expect(opcionesZona(catalogo, '').map((z) => z.nombre)).toEqual(['Ciudad Evita']);
    expect(opcionesZona(catalogo, 'Palermo').map((z) => z.nombre)).toEqual(['Ciudad Evita', 'Palermo']);
    expect(opcionesZona(catalogo, 'Ciudad Evita').map((z) => z.nombre)).toEqual(['Ciudad Evita']);
    expect(opcionesZona(catalogo, 'Barrio inventado').map((z) => z.nombre)).toEqual(['Ciudad Evita']);
  });
});

describe('SearchForm y FormularioPublicacion usan el mismo catálogo', () => {
  const montarBusqueda = () =>
    render(
      <SearchForm
        initialFilters={{ ...filtrosIniciales(), categoria: 'Llaves' }}
        onSubmit={jest.fn()}
      />
    );

  // La publicación es un asistente: las categorías están en el paso 3 y el barrio en el 4.
  const montarPublicacion = () =>
    render(<FormularioPublicacion valoresIniciales={{ paso: 3 }} onEnviar={jest.fn()} />);

  // Ambos formularios ofrecen los barrios en un desplegable con buscador (la lista solo dibuja unas
  // filas por vez).
  const verBarrios = (formulario) => {
    if (formulario === 'publicación') {
      screen.unmount();
      render(<FormularioPublicacion valoresIniciales={{ paso: 4 }} onEnviar={jest.fn()} />);
    }
    abrirSelectorBarrio();
  };
  const ofrece = (formulario, barrio) => {
    fireEvent.changeText(screen.getByLabelText('Buscar barrio'), barrio);

    return screen.queryByText(barrio) !== null;
  };

  test.each([
    ['búsqueda', montarBusqueda],
    ['publicación', montarPublicacion],
  ])('el formulario de %s ofrece el catálogo incluido sin conexión', (nombre, montar) => {
    simularConectividad(false);
    montar();

    for (const categoria of CATEGORIAS) {
      expect(screen.getByText(categoria)).toBeTruthy();
    }
    expect(screen.queryByText('Bicicletas')).toBeNull();
    verBarrios(nombre);
    for (const zona of ZONAS) {
      expect(ofrece(nombre, zona.nombre)).toBe(true);
    }
    expect(ofrece(nombre, 'Ciudad Evita')).toBe(false);
  });

  test.each([
    ['búsqueda', montarBusqueda],
    ['publicación', montarPublicacion],
  ])('el formulario de %s se actualiza cuando llega el catálogo de la API', async (nombre, montar) => {
    simularConectividad(false);
    backend();
    montar();

    await act(async () => {
      await actualizarCatalogo();
    });
    expect(screen.getByText('Bicicletas')).toBeTruthy();
    verBarrios(nombre);
    expect(ofrece(nombre, 'Ciudad Evita')).toBe(true);
  });

  test('ambos formularios muestran lo mismo desde la copia guardada, sin conexión', async () => {
    backend();
    await actualizarCatalogo();
    restablecerCatalogo();
    simularConectividad(false);
    jest.spyOn(api, 'get').mockRejectedValue(errorRed());

    const busqueda = montarBusqueda();
    await act(async () => {
      await iniciarCatalogo();
    });
    abrirSelectorBarrio();
    expect(ofrece('búsqueda', 'Ciudad Evita')).toBe(true);
    expect(screen.getByText('Bicicletas')).toBeTruthy();
    busqueda.unmount();

    montarPublicacion();
    expect(screen.getByText('Bicicletas')).toBeTruthy();
    verBarrios('publicación');
    expect(ofrece('publicación', 'Ciudad Evita')).toBe(true);
  });

  test('al editar, un barrio guardado con otra grafía se reconoce y uno sin barrio conserva sus coordenadas', async () => {
    expect(valoresDesdePublicacion({ barrio: 'PÁLERMO', tipo: 'perdido' })).toMatchObject({
      barrio: 'Palermo',
      coords: null,
    });

    const ubicacion = { latitud: -31.42, longitud: -64.18 };
    expect(valoresDesdePublicacion({ barrio: 'Ubicación actual', tipo: 'perdido', ubicacion })).toMatchObject({
      barrio: '',
      coords: ubicacion,
    });
  });
});

describe('coordenadasPropias', () => {
  const centro = { latitud: -34.5889, longitud: -58.4306 };

  test('el centro del barrio no cuenta como coordenadas propias', () => {
    expect(coordenadasPropias('Palermo', centro)).toBeNull();
    expect(coordenadasPropias('palermo', centro)).toBeNull();
  });

  test('otras coordenadas, aunque haya barrio, sí son propias', () => {
    const gps = { latitud: -34.6, longitud: -58.4 };
    expect(coordenadasPropias('Palermo', gps)).toEqual(gps);
    expect(coordenadasPropias('Barrio inexistente', centro)).toEqual(centro);
  });

  test('sin ubicación o con una inválida no hay coordenadas', () => {
    expect(coordenadasPropias('Palermo', null)).toBeNull();
    expect(coordenadasPropias('Palermo', { latitud: '1', longitud: 2 })).toBeNull();
  });
});

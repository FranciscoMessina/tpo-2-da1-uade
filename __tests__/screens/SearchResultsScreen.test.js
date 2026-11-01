import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SearchResultsScreen from '../../screens/SearchResultsScreen';
import { buscarPublicacionesConCache, obtenerPublicacion } from '../../services/publicaciones';
import { useSearch } from '../../context/SearchContext';
import { useConexion } from '../../context/ConexionContext';
import { filtrosIniciales } from '../../data/busqueda';
import { __navegacion as navegacion } from '@react-navigation/native';
import { simularConectividad } from '../hooks/entorno';

// La API y los contextos se reemplazan: la prueba no toca la red.
jest.mock('../../services/publicaciones');
jest.mock('../../context/SearchContext');
jest.mock('../../context/ConexionContext');

const contextoBusqueda = (extra = {}) => ({
  alertas: [],
  alertasLoading: false,
  alertasGuardando: false,
  alertasError: '',
  recargarAlertas: jest.fn(),
  recordarBusqueda: jest.fn(),
  crearAlerta: jest.fn().mockResolvedValue(true),
  ...extra,
});

const publicacion = (id, extra = {}) => ({
  id,
  tipo: 'perdido',
  titulo: `Publicación ${id}`,
  categoria: 'Llaves',
  barrio: 'Palermo',
  fecha: '2026-10-20',
  fotos: [],
  ...extra,
});

const respuesta = (items, extra = {}) => ({
  items,
  total: items.length,
  pagina: 1,
  tamanioPagina: 10,
  totalPaginas: 1,
  esOffline: false,
  ...extra,
});

const ruta = { params: { filtros: filtrosIniciales() } };
const pantalla = () => <SearchResultsScreen route={ruta} navigation={navegacion} />;
const renderizar = () => render(pantalla());

beforeEach(() => {
  jest.mocked(buscarPublicacionesConCache).mockReset();
  jest.mocked(obtenerPublicacion).mockReset();
  jest.mocked(useSearch).mockReturnValue(contextoBusqueda());
  jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
  simularConectividad(true);
});

afterEach(() => jest.restoreAllMocks());

describe('SearchResultsScreen — resultados', () => {
  test('renderiza las tarjetas de las publicaciones devueltas por la búsqueda', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([publicacion('p1'), publicacion('p2')])
    );

    renderizar();
    await act(async () => {});

    expect(screen.getByText('Publicación p1')).toBeTruthy();
    expect(screen.getByText('Publicación p2')).toBeTruthy();
    expect(screen.getByText('2 coincidencias')).toBeTruthy();
  });
});

describe('SearchResultsScreen — ubicación en las tarjetas', () => {
  test('muestra las coordenadas públicas aproximadas cuando existen', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([publicacion('p1', { latitud: -34.5889, longitud: -58.4306 })])
    );

    renderizar();
    await act(async () => {});

    expect(screen.getByText('Ubicación aproximada: -34.589, -58.431')).toBeTruthy();
  });

  test('usa ubicacion cuando no vienen latitud y longitud sueltas', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([publicacion('p1', { ubicacion: { latitud: -34.6037, longitud: -58.3816 } })])
    );

    renderizar();
    await act(async () => {});

    expect(screen.getByText('Ubicación aproximada: -34.604, -58.382')).toBeTruthy();
  });

  test.each([
    ['sin coordenadas', {}],
    ['con coordenadas nulas', { latitud: null, longitud: null, ubicacion: null }],
    ['con una sola coordenada', { latitud: -34.5889 }],
    ['con coordenadas fuera de rango', { latitud: 200, longitud: -58.4306 }],
    ['con coordenadas que no son números', { latitud: '-34.5', longitud: 'x' }],
  ])('no muestra ubicación %s ni falla', async (_caso, extra) => {
    buscarPublicacionesConCache.mockResolvedValueOnce(respuesta([publicacion('p1', extra)]));

    renderizar();
    await act(async () => {});

    expect(screen.getByText('Publicación p1')).toBeTruthy();
    expect(screen.queryByText(/Ubicación aproximada/)).toBeNull();
  });

  test('no expone la dirección privada ni el teléfono de la publicación', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([
        publicacion('p1', {
          latitud: -34.5889,
          longitud: -58.4306,
          direccionExacta: 'Av. Santa Fe 1234',
          publicador: { phone: '+54 11 5555-0000' },
        }),
      ])
    );

    renderizar();
    await act(async () => {});

    expect(screen.getByText(/Ubicación aproximada/)).toBeTruthy();
    expect(screen.queryByText(/Santa Fe 1234/)).toBeNull();
    expect(screen.queryByText(/5555-0000/)).toBeNull();
  });

  test('muestra la ubicación de los resultados guardados sin conexión', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([publicacion('p1', { latitud: -34.589, longitud: -58.431 })], {
        esOffline: true,
        desdeCache: true,
      })
    );

    renderizar();
    await act(async () => {});

    expect(screen.getByText('Modo sin conexión')).toBeTruthy();
    expect(screen.getByText('Ubicación aproximada: -34.589, -58.431')).toBeTruthy();
  });

  test('no pide el detalle de la publicación para mostrar la ubicación', async () => {
    buscarPublicacionesConCache.mockResolvedValueOnce(
      respuesta([publicacion('p1', { latitud: -34.5889, longitud: -58.4306 })])
    );

    renderizar();
    await act(async () => {});

    expect(buscarPublicacionesConCache).toHaveBeenCalledTimes(1);
    expect(obtenerPublicacion).not.toHaveBeenCalled();
  });
});

describe('SearchResultsScreen — guardar alerta sin conexión', () => {
  const TITULO = 'Guardar búsqueda como alerta';
  const AVISO = /Sin conexión: no se puede guardar la alerta/;

  async function renderizarConResultados(contexto) {
    jest.mocked(useSearch).mockReturnValue(contexto);
    buscarPublicacionesConCache.mockResolvedValue(respuesta([publicacion('p1')]));
    const vista = renderizar();
    await act(async () => {});
    return vista;
  }

  test('con conexión el botón está habilitado y guarda la alerta', async () => {
    const contexto = contextoBusqueda();
    await renderizarConResultados(contexto);
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    expect(screen.getByText(TITULO)).not.toBeDisabled();
    expect(screen.queryByText(AVISO)).toBeNull();

    await act(async () => { fireEvent.press(screen.getByText(TITULO)); });

    expect(contexto.crearAlerta).toHaveBeenCalledTimes(1);
    expect(alerta).toHaveBeenCalledWith('Alerta guardada', expect.any(String));
  });

  test('sin conexión deshabilita guardar, lo explica y no llama a la API', async () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    simularConectividad(false);
    const contexto = contextoBusqueda();
    await renderizarConResultados(contexto);

    expect(screen.getByText(TITULO)).toBeDisabled();
    expect(screen.getByText(AVISO)).toBeTruthy();

    fireEvent.press(screen.getByText(TITULO));
    expect(contexto.crearAlerta).not.toHaveBeenCalled();
  });

  test('al volver la conexión el botón se habilita y guarda', async () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    const contexto = contextoBusqueda();
    const vista = await renderizarConResultados(contexto);
    expect(screen.getByText(TITULO)).toBeDisabled();

    jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
    vista.rerender(pantalla());

    expect(screen.getByText(TITULO)).not.toBeDisabled();
    expect(screen.queryByText(AVISO)).toBeNull();

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await act(async () => { fireEvent.press(screen.getByText(TITULO)); });
    expect(contexto.crearAlerta).toHaveBeenCalledTimes(1);
  });

  test('si la conexión cae entre el render y el toque, no llama a la API y avisa', async () => {
    // El contexto todavía dice «con red», pero el estado compartido ya registró la caída.
    const contexto = contextoBusqueda();
    await renderizarConResultados(contexto);
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simularConectividad(false);

    await act(async () => { fireEvent.press(screen.getByText(TITULO)); });

    expect(contexto.crearAlerta).not.toHaveBeenCalled();
    expect(alerta).toHaveBeenCalledWith('Sin conexión', expect.stringContaining('Sin conexión'));
  });

  test('sin resultados, el botón de la lista vacía también queda deshabilitado', async () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    jest.mocked(useSearch).mockReturnValue(contextoBusqueda());
    buscarPublicacionesConCache.mockResolvedValue(respuesta([]));
    renderizar();
    await act(async () => {});

    const botones = screen.getAllByText(TITULO);
    expect(botones).toHaveLength(2);
    botones.forEach((boton) => expect(boton).toBeDisabled());
  });
});

describe('SearchResultsScreen — acciones que siguen disponibles sin conexión', () => {
  beforeEach(() => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    simularConectividad(false);
  });

  test('la lectura, la navegación y la publicación (cola/borradores) no se bloquean', async () => {
    buscarPublicacionesConCache.mockResolvedValue(respuesta([]));
    renderizar();
    await act(async () => {});

    expect(screen.getByText('Mis alertas')).not.toBeDisabled();
    expect(screen.getByText('Refinar filtros')).not.toBeDisabled();
    expect(screen.getByText('Más cercanos')).not.toBeDisabled();
    expect(screen.getByText('Publicar mi pérdida')).not.toBeDisabled();

    fireEvent.press(screen.getByText('Publicar mi pérdida'));
    expect(navegacion.navigate).toHaveBeenCalledWith('CrearPublicacion', expect.any(Object));

    fireEvent.press(screen.getByText('Mis alertas'));
    expect(navegacion.popTo).toHaveBeenCalledWith('Principal', { screen: 'Alertas' });
  });

  test('reintentar la búsqueda sigue habilitado y vuelve a consultar', async () => {
    buscarPublicacionesConCache.mockResolvedValue(
      respuesta([], { esOffline: true, sinResultadosPrevios: true })
    );
    renderizar();
    await act(async () => {});
    const llamadas = buscarPublicacionesConCache.mock.calls.length;

    const reintentos = screen.getAllByText('Reintentar');
    reintentos.forEach((boton) => expect(boton).not.toBeDisabled());
    await act(async () => { fireEvent.press(reintentos[0]); });

    expect(buscarPublicacionesConCache.mock.calls.length).toBe(llamadas + 1);
  });

  test('abrir una tarjeta sigue funcionando', async () => {
    buscarPublicacionesConCache.mockResolvedValue(respuesta([publicacion('p1')]));
    renderizar();
    await act(async () => {});

    fireEvent.press(screen.getByText('Publicación p1'));

    expect(navegacion.navigate).toHaveBeenCalledWith('DetallePublicacion', { publicacionId: 'p1' });
  });
});

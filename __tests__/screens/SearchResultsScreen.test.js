import { act, render, screen } from '@testing-library/react-native';
import SearchResultsScreen from '../../screens/SearchResultsScreen';
import { buscarPublicacionesConCache } from '../../services/publicaciones';
import { useSearch } from '../../context/SearchContext';
import { filtrosIniciales } from '../../data/searchDemo';
import { __navegacion as navegacion } from '@react-navigation/native';
import { simularConectividad } from '../hooks/entorno';

// La API y el contexto de búsqueda se reemplazan: la prueba no toca la red.
jest.mock('../../services/publicaciones');
jest.mock('../../context/SearchContext');

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

function renderizar() {
  const ruta = { params: { filtros: filtrosIniciales() } };
  return render(<SearchResultsScreen route={ruta} navigation={navegacion} />);
}

beforeEach(() => {
  jest.mocked(buscarPublicacionesConCache).mockReset();
  jest.mocked(useSearch).mockReturnValue(contextoBusqueda());
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

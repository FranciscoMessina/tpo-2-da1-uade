import { act, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import AlertasScreen from '../../screens/AlertasScreen';
import { SearchProvider, claveRecientes, useSearch } from '../../context/SearchContext';
import { api } from '../../services/api';
import {
  crearAlerta,
  obtenerAlertas,
} from '../../services/alertas';
import { buscarPublicacionesConCache } from '../../services/publicaciones';
import {
  claveBusqueda,
  filtrosIniciales,
  resumenBusqueda,
  validarFiltros,
} from '../../data/busqueda';

// Los hooks de datos se reemplazan: estas pruebas miran el resumen y el historial, no la red.
let mockUsuario = { id: 7 };
jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({ usuario: mockUsuario }),
}));
jest.mock('../../hooks/useAlertas', () => ({
  __esModule: true,
  default: () => ({ alertas: [], loading: false, error: '', guardando: false }),
}));
jest.mock('../../hooks/useSeguidas', () => ({
  __esModule: true,
  default: () => ({ publicaciones: [], loading: false, error: '', guardando: false }),
}));
jest.mock('../../hooks/useNovedades', () => ({
  __esModule: true,
  default: () => ({
    porAlerta: new Map(),
    porPublicacion: new Map(),
    porReclamo: new Map(),
    loading: false,
    error: '',
    guardando: false,
  }),
}));

// Centro fijo de prueba: la API nunca recibe seguimiento continuo, solo un punto y un radio.
const CENTRO = { latitud: -34.6, longitud: -58.4 };

const base = {
  ...filtrosIniciales(),
  categoria: 'Llaves',
};

const porGps = (radioKm, extra = {}) => ({
  ...base,
  zona: '',
  ubicacion: CENTRO,
  ...(radioKm === undefined ? {} : { radioKm }),
  ...extra,
});

const porBarrio = (extra = {}) => ({
  ...base,
  zona: 'Palermo',
  ubicacion: null,
  ...extra,
});

afterEach(() => jest.restoreAllMocks());

function simularCreacion() {
  return jest.spyOn(api, 'post').mockImplementation(async (ruta, cuerpo) => ({
    data: { id: 'alerta-1', activa: true, filtros: cuerpo.filtros },
  }));
}

const filtrosEnviados = (post) => post.mock.calls[0][1].filtros;

describe('alerta por GPS: centro fijo más radio', () => {
  test('guarda el centro y el radio elegidos', async () => {
    const post = simularCreacion();

    await crearAlerta(porGps(2.5));

    expect(post).toHaveBeenCalledWith('/alertas', expect.anything());
    expect(filtrosEnviados(post)).toMatchObject({
      ubicacion: CENTRO,
      radioKm: 2.5,
    });
    expect(filtrosEnviados(post).zona).toBe('');
  });

  test('sin radio elegido envía el radio inicial de la API (10 km), no lo deja implícito', async () => {
    const post = simularCreacion();

    await crearAlerta(porGps());

    expect(filtrosEnviados(post).radioKm).toBe(10);
  });

  test('acepta los extremos 0,1 y 500 km', async () => {
    const post = simularCreacion();

    await crearAlerta(porGps(0.1));
    await crearAlerta(porGps(500));

    expect(post.mock.calls.map(([, cuerpo]) => cuerpo.filtros.radioKm)).toEqual([0.1, 500]);
  });

  test.each([0.09, 0, -3, 500.01, NaN, Infinity])(
    'rechaza el radio %p antes de llamar a la API',
    async (radio) => {
      const post = simularCreacion();

      await expect(crearAlerta(porGps(radio))).rejects.toThrow(/radio/i);

      expect(post).not.toHaveBeenCalled();
    }
  );

  test('conserva el rango de fechas fijo junto con el radio', async () => {
    const post = simularCreacion();

    await crearAlerta(
      porGps(3, { periodo: 'rango', desde: '2026-03-01', hasta: '2026-03-03' })
    );

    expect(filtrosEnviados(post)).toMatchObject({
      periodo: 'rango',
      desde: '2026-03-01',
      hasta: '2026-03-03',
      radioKm: 3,
    });
  });
});

describe('alerta por barrio: filtro textual', () => {
  test('no lleva coordenadas ni radio, aunque el filtro conserve un radio viejo', async () => {
    const post = simularCreacion();

    await crearAlerta(porBarrio({ radioKm: 3 }));

    const enviados = filtrosEnviados(post);
    expect(enviados.zona).toBe('Palermo');
    expect(enviados.ubicacion).toBeNull();
    expect(enviados).not.toHaveProperty('radioKm');
  });
});

describe('recuperación de alertas', () => {
  test('devuelve el radio guardado y el centro', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: {
        items: [
          {
            id: 'a1',
            activa: true,
            filtros: { ...porGps(7.5), desde: undefined },
          },
        ],
        totalPages: 1,
      },
    });

    const { items } = await obtenerAlertas();

    expect(items[0].filtros).toMatchObject({ ubicacion: CENTRO, radioKm: 7.5 });
  });

  test('una alerta anterior sin radio se muestra con el radio inicial de la API', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: {
        items: [{ id: 'a1', activa: true, filtros: porGps() }],
        totalPages: 1,
      },
    });

    const { items } = await obtenerAlertas();

    expect(items[0].filtros.radioKm).toBe(10);
  });

  test('una alerta por barrio sigue sin radio', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({
      data: {
        items: [{ id: 'a1', activa: true, filtros: porBarrio() }],
        totalPages: 1,
      },
    });

    const { items } = await obtenerAlertas();

    expect(items[0].filtros).not.toHaveProperty('radioKm');
    expect(items[0].filtros.ubicacion).toBeNull();
  });
});

describe('búsqueda y alerta con los mismos filtros', () => {
  async function parametrosDeBusqueda(filtros) {
    const get = jest.spyOn(api, 'get');
    // Descarta llamadas y respuestas previas (por ejemplo, la lista de alertas recuperada).
    get.mockReset();
    get.mockResolvedValue({ data: { items: [], total: 0 } });

    await buscarPublicacionesConCache(filtros);

    return get.mock.calls[0][1].params;
  }

  test.each([
    ['con radio elegido', porGps(4)],
    ['sin radio elegido', porGps()],
  ])('GPS %s: la búsqueda envía el mismo centro y radio que guarda la alerta', async (_, filtros) => {
    const post = simularCreacion();
    await crearAlerta(filtros);
    const alerta = filtrosEnviados(post);

    const busqueda = await parametrosDeBusqueda(filtros);

    expect(busqueda.latitud).toBe(alerta.ubicacion.latitud);
    expect(busqueda.longitud).toBe(alerta.ubicacion.longitud);
    expect(busqueda.radioKm).toBe(alerta.radioKm);
  });

  test('el radio también viaja al repetir la búsqueda desde una alerta recuperada', async () => {
    jest.spyOn(api, 'get').mockResolvedValueOnce({
      data: { items: [{ id: 'a1', activa: true, filtros: porGps(12) }], totalPages: 1 },
    });
    const { items } = await obtenerAlertas();

    const busqueda = await parametrosDeBusqueda(items[0].filtros);

    expect(busqueda.radioKm).toBe(12);
  });

  test('por barrio la búsqueda no envía coordenadas ni radio', async () => {
    const busqueda = await parametrosDeBusqueda(porBarrio({ radioKm: 3 }));

    expect(busqueda.zona).toBe('Palermo');
    expect(busqueda).not.toHaveProperty('latitud');
    expect(busqueda).not.toHaveProperty('longitud');
    expect(busqueda).not.toHaveProperty('radioKm');
  });

  test('un centro con coordenada 0 sigue enviándose', async () => {
    const busqueda = await parametrosDeBusqueda(
      porGps(5, { ubicacion: { latitud: 0, longitud: -58.4 } })
    );

    expect(busqueda.latitud).toBe(0);
    expect(busqueda.longitud).toBe(-58.4);
  });
});

describe('filtros compartidos', () => {
  test('radios distintos son búsquedas distintas', () => {
    expect(claveBusqueda(porGps(2))).not.toBe(claveBusqueda(porGps(3)));
  });

  test('sin radio equivale al radio inicial', () => {
    expect(claveBusqueda(porGps())).toBe(claveBusqueda(porGps(10)));
  });

  test('el radio no cambia la clave de una búsqueda por barrio', () => {
    expect(claveBusqueda(porBarrio({ radioKm: 3 }))).toBe(
      claveBusqueda(porBarrio())
    );
  });

  test('el resumen muestra el centro y el radio, o el barrio', () => {
    expect(resumenBusqueda(porGps(2.5))).toContain('radio 2,5 km');
    expect(resumenBusqueda(porGps(2.5))).toContain('-34.600, -58.400');
    expect(resumenBusqueda(porBarrio())).toContain('Palermo');
    expect(resumenBusqueda(porBarrio())).not.toMatch(/radio/);
  });

  test('validarFiltros exige un radio entre 0,1 y 500 km solo con GPS', () => {
    expect(validarFiltros(porGps(0.1))).toBe('');
    expect(validarFiltros(porGps(500))).toBe('');
    expect(validarFiltros(porGps())).toBe('');
    expect(validarFiltros(porGps(0.09))).toMatch(/radio/i);
    expect(validarFiltros(porGps(500.01))).toMatch(/radio/i);
    expect(validarFiltros(porGps(NaN))).toMatch(/radio/i);
    expect(validarFiltros(porBarrio({ radioKm: 9999 }))).toBe('');
  });
});

describe('resumen de la alerta en pantalla', () => {
  function mostrar(alertas) {
    const contexto = {
      alertas,
      alertasLoading: false,
      alertasError: '',
      alertasGuardando: false,
      recargarAlertas: jest.fn(),
      eliminarAlerta: jest.fn(),
      activarAlerta: jest.fn(),
      novedadesPorAlerta: new Map(),
      novedadesLoading: false,
      novedadesError: '',
      novedadesGuardando: false,
      recargarNovedades: jest.fn(),
      marcarAlertaLeida: jest.fn(),
    };

    jest
      .spyOn(require('../../context/SearchContext'), 'useSearch')
      .mockReturnValue(contexto);

    render(<AlertasScreen navigation={{ navigate: jest.fn() }} />);
  }

  test('una alerta por GPS muestra el centro, el radio y que el centro es fijo', () => {
    mostrar([{ id: 'a1', activa: true, filtros: porGps(5) }]);

    expect(screen.getByText(/-34\.600, -58\.400\) · radio 5 km/)).toBeTruthy();
    expect(screen.getByText(/Centro fijo/)).toBeTruthy();
  });

  test('una alerta por barrio muestra el barrio, sin radio ni centro', () => {
    mostrar([{ id: 'a1', activa: true, filtros: porBarrio() }]);

    expect(screen.getByText(/Palermo/)).toBeTruthy();
    expect(screen.queryByText(/radio/)).toBeNull();
    expect(screen.queryByText(/Centro fijo/)).toBeNull();
  });
});

describe('búsquedas recientes guardadas', () => {
  const CLAVE = claveRecientes(7);

  beforeEach(() => {
    mockUsuario = { id: 7 };
  });

  function Recientes() {
    const { recientes } = useSearch();

    return (
      <Text testID="recientes">
        {JSON.stringify(recientes.map((item) => item.filtros.radioKm ?? null))}
      </Text>
    );
  }

  async function cargar(guardadas) {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(guardadas));
    render(
      <SearchProvider>
        <Recientes />
      </SearchProvider>
    );

    return JSON.parse((await screen.findByTestId('recientes')).props.children);
  }

  const guardada = (filtros) => ({ clave: 'vieja', filtros });

  test('conserva el radio y descarta las de radio inválido', async () => {
    const radios = await cargar([
      guardada(porGps(7)),
      guardada(porGps(0.01)),
      guardada(porGps(999)),
      guardada(porBarrio()),
    ]);

    expect(radios).toEqual([7, null]);
  });

  test('una búsqueda por GPS guardada sin radio y la misma con el radio inicial son una sola', async () => {
    const radios = await cargar([guardada(porGps()), guardada(porGps(10))]);

    expect(radios).toHaveLength(1);
  });

  test('radios distintos del mismo punto son búsquedas distintas', async () => {
    const radios = await cargar([guardada(porGps(2)), guardada(porGps(3))]);

    expect(radios).toEqual([2, 3]);
  });

  describe('al cambiar de cuenta', () => {
    // Elemento nuevo en cada render: React no vuelve a renderizar uno idéntico y el mock de useAuth no se releería
    const arbol = () => (
      <SearchProvider>
        <Recientes />
        <Grabar />
      </SearchProvider>
    );

    let grabar;
    function Grabar() {
      grabar = useSearch().recordarBusqueda;
      return null;
    }

    const leer = async (esperados) =>
      waitFor(() =>
        expect(JSON.parse(screen.getByTestId('recientes').props.children)).toEqual(esperados)
      );

    test('cada cuenta ve solo su historial y lo guarda en su propia clave', async () => {
      await AsyncStorage.setItem(claveRecientes(7), JSON.stringify([guardada(porGps(7))]));
      await AsyncStorage.setItem(claveRecientes(8), JSON.stringify([guardada(porGps(4))]));

      const { rerender } = render(arbol());
      await leer([7]);

      mockUsuario = { id: 8 };
      rerender(arbol());
      await leer([4]);

      act(() => grabar(porGps(9)));
      await leer([9, 4]);
      await waitFor(async () =>
        expect(JSON.parse(await AsyncStorage.getItem(claveRecientes(8)))).toHaveLength(2)
      );
      expect(JSON.parse(await AsyncStorage.getItem(claveRecientes(7)))).toHaveLength(1);
    });

    test('al cerrar sesión el historial queda vacío y no se escribe en ninguna cuenta', async () => {
      await AsyncStorage.setItem(claveRecientes(7), JSON.stringify([guardada(porGps(7))]));

      const { rerender } = render(arbol());
      await leer([7]);

      mockUsuario = null;
      rerender(arbol());
      await leer([]);

      act(() => grabar(porGps(9)));
      await leer([]);
      expect(JSON.parse(await AsyncStorage.getItem(claveRecientes(7)))).toHaveLength(1);
    });

    test('descarta el historial global de versiones anteriores', async () => {
      await AsyncStorage.setItem(
        '@hallado:busquedas-recientes:v1',
        JSON.stringify([guardada(porGps(3))])
      );

      render(arbol());
      await leer([]);

      await waitFor(async () =>
        expect(await AsyncStorage.getItem('@hallado:busquedas-recientes:v1')).toBeNull()
      );
    });
  });
});

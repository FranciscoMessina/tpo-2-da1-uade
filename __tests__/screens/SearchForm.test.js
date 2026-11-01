import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SearchForm from '../../components/SearchForm';
import { fechaLocal, filtrosIniciales } from '../../data/busqueda';
import { elegirBarrio } from '../components/ayudas';
import { barrioMasCercano } from '../../services/catalogos';
import useUbicacionActual from '../../hooks/useUbicacionActual';
import * as Location from 'expo-location';

// El GPS se reemplaza: la prueba no pide permisos ni usa el dispositivo.
jest.mock('../../hooks/useUbicacionActual', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Sin geocodificador disponible (sin red): el barrio sale de la cercanía.
jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn().mockRejectedValue(new Error('sin red')),
}));

const deDate = (fecha) => fechaLocal(fecha);

const CENTRO = { latitud: -34.6, longitud: -58.4 };
// Mountain View: lejos de todos los barrios del catálogo.
const LEJOS = { latitud: 37.42, longitud: -122.08 };
const ETIQUETA_RADIO = 'Radio de búsqueda en kilómetros';

let obtener;

beforeEach(() => {
  obtener = jest.fn().mockResolvedValue(CENTRO);
  jest.mocked(useUbicacionActual).mockReturnValue({
    obtener,
    cargando: false,
    error: '',
  });
});

afterEach(() => jest.clearAllMocks());

function montar(initialFilters = { ...filtrosIniciales(), categoria: 'Llaves' }) {
  const onSubmit = jest.fn();

  render(<SearchForm initialFilters={initialFilters} onSubmit={onSubmit} />);

  return onSubmit;
}

const usarGps = () =>
  act(async () => {
    fireEvent.press(screen.getByText('Usar mi ubicación actual'));
  });

const buscar = () => fireEvent.press(screen.getByText('Buscar coincidencias'));

const radio = () => screen.getByLabelText(ETIQUETA_RADIO);

describe('SearchForm: radio al elegir GPS', () => {
  test('sin GPS no hay control de radio ni se pide la ubicación', () => {
    montar();

    expect(screen.queryByLabelText(ETIQUETA_RADIO)).toBeNull();
    expect(obtener).not.toHaveBeenCalled();
  });

  test('elegir un barrio nunca pide GPS', () => {
    const onSubmit = montar();

    elegirBarrio('Palermo');
    buscar();

    expect(obtener).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ zona: 'Palermo', ubicacion: null });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('radioKm');
  });

  test('al elegir GPS aparece el radio con el valor inicial de la API (10 km) y se envía', async () => {
    const onSubmit = montar();

    await usarGps();

    expect(radio().props.value).toBe('10');
    buscar();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      zona: '',
      ubicacion: CENTRO,
      radioKm: 10,
    });
  });

  test('el radio se puede configurar, también con coma decimal', async () => {
    const onSubmit = montar();
    await usarGps();

    fireEvent.changeText(radio(), '2,5');
    buscar();

    expect(onSubmit.mock.calls[0][0].radioKm).toBe(2.5);
  });

  test.each(['0.1', '500'])('acepta el extremo %s km', async (texto) => {
    const onSubmit = montar();
    await usarGps();

    fireEvent.changeText(radio(), texto);
    buscar();

    expect(onSubmit.mock.calls[0][0].radioKm).toBe(Number(texto));
  });

  test.each(['0.09', '0', '500.1', '', 'abc', '-5'])(
    'rechaza el radio "%s" y no busca',
    async (texto) => {
      const onSubmit = montar();
      await usarGps();

      fireEvent.changeText(radio(), texto);
      buscar();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/radio/i);
    }
  );

  test('explica que el centro queda fijo y no se sigue al dispositivo', async () => {
    montar();

    await usarGps();

    expect(screen.getByText(/centro queda fijo/i)).toBeTruthy();
  });
});

describe('SearchForm: refinar conserva el radio', () => {
  test('muestra y reenvía el radio de la búsqueda que se está refinando', () => {
    const onSubmit = montar({
      ...filtrosIniciales(),
      categoria: 'Llaves',
      ubicacion: CENTRO,
      radioKm: 25,
    });

    expect(radio().props.value).toBe('25');
    buscar();

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ ubicacion: CENTRO, radioKm: 25 });
  });

  test('una búsqueda con GPS anterior sin radio se refina con el radio inicial', () => {
    const onSubmit = montar({
      ...filtrosIniciales(),
      categoria: 'Llaves',
      ubicacion: CENTRO,
    });

    expect(radio().props.value).toBe('10');
    buscar();

    expect(onSubmit.mock.calls[0][0].radioKm).toBe(10);
  });

  test('volver a usar el GPS no pisa el radio ya elegido', async () => {
    const onSubmit = montar({
      ...filtrosIniciales(),
      categoria: 'Llaves',
      ubicacion: CENTRO,
      radioKm: 25,
    });

    await usarGps();
    buscar();

    expect(onSubmit.mock.calls[0][0].radioKm).toBe(25);
  });
});

describe('SearchForm: barrio limpia GPS y radio', () => {
  test('al elegir un barrio después del GPS desaparecen centro y radio', async () => {
    const onSubmit = montar();
    await usarGps();
    fireEvent.changeText(radio(), '40');

    elegirBarrio('Recoleta');

    expect(screen.queryByLabelText(ETIQUETA_RADIO)).toBeNull();
    buscar();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ zona: 'Recoleta', ubicacion: null });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('radioKm');
  });

  test('al elegir GPS después de un barrio se limpia el barrio y el radio vuelve al inicial', async () => {
    const onSubmit = montar();
    elegirBarrio('Recoleta');

    await usarGps();
    buscar();

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      zona: '',
      ubicacion: CENTRO,
      radioKm: 10,
    });
  });

  test('barrio, GPS y barrio de nuevo no arrastran el radio anterior', async () => {
    const onSubmit = montar();
    await usarGps();
    fireEvent.changeText(radio(), '40');
    elegirBarrio('Recoleta');
    await usarGps();

    expect(radio().props.value).toBe('10');
    buscar();
    expect(onSubmit.mock.calls[0][0].radioKm).toBe(10);
  });

  test('si no se obtiene la ubicación no queda un radio huérfano', async () => {
    obtener.mockResolvedValue(null);
    montar();

    await usarGps();

    expect(screen.queryByLabelText(ETIQUETA_RADIO)).toBeNull();
  });
});

describe('SearchForm: barrio cercano al GPS', () => {
  test('con GPS informa el barrio más cercano sin elegirlo como filtro', async () => {
    const onSubmit = montar();

    await usarGps();

    const esperado = barrioMasCercano(CENTRO).nombre;
    expect(await screen.findByText(`Cerca de: ${esperado}`)).toBeTruthy();
    buscar();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ zona: '', ubicacion: CENTRO, radioKm: 10 });
  });

  test('mientras busca el barrio avisa que lo está buscando', async () => {
    const espera = {};
    jest.mocked(Location.reverseGeocodeAsync).mockReturnValueOnce(
      new Promise((resolver) => {
        espera.resolver = resolver;
      })
    );
    montar();

    await usarGps();

    expect(screen.getByText('Buscando el barrio más cercano…')).toBeTruthy();
    expect(screen.queryByText(/Cerca de:/)).toBeNull();

    await act(async () => espera.resolver([]));

    expect(screen.queryByText('Buscando el barrio más cercano…')).toBeNull();
    expect(screen.getByText(/Cerca de:/)).toBeTruthy();
  });

  test('si ningún barrio queda cerca lo dice', async () => {
    obtener.mockResolvedValue(LEJOS);
    montar();

    await usarGps();

    expect(
      await screen.findByText('No estás cerca de ningún barrio disponible.')
    ).toBeTruthy();
    expect(screen.queryByText('Buscando el barrio más cercano…')).toBeNull();
    expect(screen.queryByText(/Cerca de:/)).toBeNull();
  });

  test('elegir un barrio quita el aviso de que no hay barrio cercano', async () => {
    obtener.mockResolvedValue(LEJOS);
    montar();
    await usarGps();
    await screen.findByText('No estás cerca de ningún barrio disponible.');

    elegirBarrio('Recoleta');

    expect(screen.queryByText('No estás cerca de ningún barrio disponible.')).toBeNull();
  });

  test('elegir «Sin barrio» con el GPS activo no lo quita', async () => {
    const onSubmit = montar();
    await usarGps();

    fireEvent.press(screen.getByLabelText('Barrio'));
    fireEvent.press(screen.getByLabelText('Sin barrio'));

    expect(radio().props.value).toBe('10');
    buscar();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ ubicacion: CENTRO });
  });

  test('elegir un barrio quita el aviso «Cerca de»', async () => {
    montar();
    await usarGps();
    await screen.findByText(/Cerca de:/);

    elegirBarrio('Recoleta');

    expect(screen.queryByText(/Cerca de:/)).toBeNull();
  });
});

describe('SearchForm: rango de fechas con selector nativo', () => {
  const RANGO = {
    ...filtrosIniciales(),
    categoria: 'Llaves',
    zona: 'Palermo',
    periodo: 'rango',
    desde: '2026-10-01',
    hasta: '2026-10-05',
  };

  function elegirFecha(etiqueta, fecha) {
    fireEvent.press(screen.getByLabelText(etiqueta));
    act(() => screen.getByTestId('datetimepicker').props.onValueChange({}, fecha));
    fireEvent.press(screen.getByText('Listo'));
  }

  test('muestra las fechas como DD/MM/AAAA y no hay campos de texto', () => {
    montar(RANGO);

    expect(screen.getByText('01/10/2026')).toBeTruthy();
    expect(screen.getByText('05/10/2026')).toBeTruthy();
    expect(screen.queryByDisplayValue('2026-10-01')).toBeNull();
    expect(screen.queryByText(/AAAA-MM-DD/)).toBeNull();
  });

  test('elegir las fechas las envía en AAAA-MM-DD', () => {
    const onSubmit = montar(RANGO);

    elegirFecha('Fecha desde', new Date(2026, 9, 2));
    elegirFecha('Fecha hasta', new Date(2026, 9, 4));
    buscar();

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ desde: '2026-10-02', hasta: '2026-10-04' });
  });

  test('desde no puede superar a hasta y hasta no puede ser futura ni anterior a desde', () => {
    montar(RANGO);

    fireEvent.press(screen.getByLabelText('Fecha desde'));
    expect(deDate(screen.getByTestId('datetimepicker').props.maximumDate)).toBe('2026-10-05');
    fireEvent.press(screen.getByText('Cancelar'));

    fireEvent.press(screen.getByLabelText('Fecha hasta'));
    const props = screen.getByTestId('datetimepicker').props;
    expect(deDate(props.minimumDate)).toBe('2026-10-01');
    expect(deDate(props.maximumDate)).toBe(fechaLocal());
  });
});

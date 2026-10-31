import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SearchForm from '../../components/SearchForm';
import { filtrosIniciales } from '../../data/searchDemo';
import useUbicacionActual from '../../hooks/useUbicacionActual';

// El GPS se reemplaza: la prueba no pide permisos ni usa el dispositivo.
jest.mock('../../hooks/useUbicacionActual', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const CENTRO = { latitud: -34.6, longitud: -58.4 };
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

    fireEvent.press(screen.getByText('Palermo'));
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

    fireEvent.press(screen.getByText('Recoleta'));

    expect(screen.queryByLabelText(ETIQUETA_RADIO)).toBeNull();
    buscar();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ zona: 'Recoleta', ubicacion: null });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('radioKm');
  });

  test('al elegir GPS después de un barrio se limpia el barrio y el radio vuelve al inicial', async () => {
    const onSubmit = montar();
    fireEvent.press(screen.getByText('Recoleta'));

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
    fireEvent.press(screen.getByText('Recoleta'));
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

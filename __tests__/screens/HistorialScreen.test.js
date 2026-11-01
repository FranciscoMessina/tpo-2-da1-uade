import { act, fireEvent, render, screen } from '@testing-library/react-native';
import HistorialScreen from '../../screens/HistorialScreen';
import { obtenerHistorial } from '../../services/historial';
import { __navegacion as navegacion } from '@react-navigation/native';
import { diferida, simularConectividad } from '../hooks/entorno';

// La API se reemplaza: la prueba no toca la red.
jest.mock('../../services/historial');

const caso = (id, titulo) => ({ id, titulo, tipo: 'devolvi' });
const respuesta = (...items) => ({ items, totalPages: 1 });

beforeEach(() => {
  jest.mocked(obtenerHistorial).mockReset();
  simularConectividad(true);
});

afterEach(() => jest.restoreAllMocks());

// Los casos se muestran con CasoResuelto; el título es lo único que necesita la prueba.
jest.mock('../../components/CasoResuelto', () => {
  const { Text } = require('react-native');
  function CasoResueltoDoble({ caso }) {
    return <Text>{caso.titulo}</Text>;
  }
  return CasoResueltoDoble;
});

describe('HistorialScreen', () => {
  test('muestra el estado de carga y luego los casos resueltos', async () => {
    const pendiente = diferida();
    obtenerHistorial.mockReturnValueOnce(pendiente.promesa);

    render(<HistorialScreen navigation={navegacion} />);
    expect(screen.queryByText('Llaves en el parque')).toBeNull();

    await act(async () => { pendiente.resolver(respuesta(caso('c1', 'Llaves en el parque'))); });

    expect(screen.getByText('Llaves en el parque')).toBeTruthy();
    expect(obtenerHistorial).toHaveBeenCalledWith({ tipo: 'devolvi', page: 1 });
  });

  test('descarta la respuesta tardía de un filtro anterior', async () => {
    const devolvi = diferida();
    const recupere = diferida();
    obtenerHistorial
      .mockReturnValueOnce(devolvi.promesa)
      .mockReturnValueOnce(recupere.promesa);

    render(<HistorialScreen navigation={navegacion} />);
    fireEvent.press(screen.getByText('Recuperé'));
    expect(obtenerHistorial).toHaveBeenLastCalledWith({ tipo: 'recupere', page: 1 });

    // Responde primero «Recuperé» y después, tarde, la consulta de «Devolví»
    await act(async () => { recupere.resolver(respuesta(caso('c2', 'Mochila recuperada'))); });
    await act(async () => { devolvi.resolver(respuesta(caso('c1', 'Llaves devueltas'))); });

    expect(screen.getByText('Mochila recuperada')).toBeTruthy();
    expect(screen.queryByText('Llaves devueltas')).toBeNull();
  });

  test('muestra el error de la API y permite reintentar', async () => {
    obtenerHistorial
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Historial no disponible' } } } })
      .mockResolvedValueOnce(respuesta(caso('c1', 'Llaves en el parque')));

    render(<HistorialScreen navigation={navegacion} />);
    await act(async () => {});
    expect(screen.getByText('Historial no disponible')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByText('Reintentar')); });

    expect(screen.queryByText('Historial no disponible')).toBeNull();
    expect(screen.getByText('Llaves en el parque')).toBeTruthy();
  });

  test('desmontar la pantalla con una petición pendiente no produce errores al responder', async () => {
    const pendiente = diferida();
    obtenerHistorial.mockReturnValueOnce(pendiente.promesa);
    const errores = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<HistorialScreen navigation={navegacion} />);
    unmount();
    await act(async () => { pendiente.resolver(respuesta(caso('c1', 'Llaves en el parque'))); });

    expect(errores).not.toHaveBeenCalled();
  });
});

describe('HistorialScreen: filtro por fechas', () => {
  function elegirFecha(etiqueta, fecha) {
    fireEvent.press(screen.getByLabelText(etiqueta));
    act(() => screen.getByTestId('datetimepicker').props.onValueChange({}, fecha));
    fireEvent.press(screen.getByText('Listo'));
  }

  test('filtra por las fechas elegidas, en AAAA-MM-DD, y las muestra como DD/MM/AAAA', async () => {
    obtenerHistorial.mockResolvedValue(respuesta());
    render(<HistorialScreen navigation={navegacion} />);
    await act(async () => {});
    expect(screen.queryByText(/AAAA-MM-DD/)).toBeNull();

    elegirFecha('Fecha desde', new Date(2026, 9, 1));
    elegirFecha('Fecha hasta', new Date(2026, 9, 20));
    expect(screen.getByText('01/10/2026')).toBeTruthy();
    expect(screen.getByText('20/10/2026')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByText('Filtrar')); });

    expect(obtenerHistorial).toHaveBeenLastCalledWith({
      desde: '2026-10-01',
      hasta: '2026-10-20',
      tipo: 'devolvi',
      page: 1,
    });
  });

  test('«Limpiar fechas» quita el filtro y vuelve a los placeholders', async () => {
    obtenerHistorial.mockResolvedValue(respuesta());
    render(<HistorialScreen navigation={navegacion} />);
    await act(async () => {});

    elegirFecha('Fecha desde', new Date(2026, 9, 1));
    await act(async () => { fireEvent.press(screen.getByText('Filtrar')); });
    await act(async () => { fireEvent.press(screen.getByText('Limpiar fechas')); });

    expect(screen.getByText('Desde')).toBeTruthy();
    expect(obtenerHistorial).toHaveBeenLastCalledWith({ tipo: 'devolvi', page: 1 });
  });
});

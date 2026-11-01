import { fireEvent, render, screen } from '@testing-library/react-native';
import { Aviso, Boton, ErrorConReintento } from '../../components/ui';
import { MENSAJE_SIN_CONEXION } from '../../services/api';

let mockHayConexion = true;

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: mockHayConexion }),
}));

beforeEach(() => {
  mockHayConexion = true;
});

describe('Boton con requiereConexion', () => {
  test('con conexión funciona como cualquier botón', () => {
    const onPress = jest.fn();
    render(<Boton titulo="Guardar" requiereConexion notaSinConexion="Necesitás conexión." onPress={onPress} />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Necesitás conexión.')).toBeNull();
  });

  test('sin conexión queda bloqueado y explica por qué', () => {
    mockHayConexion = false;
    const onPress = jest.fn();
    render(<Boton titulo="Guardar" requiereConexion notaSinConexion="Necesitás conexión." onPress={onPress} />);

    fireEvent.press(screen.getByText('Guardar'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(screen.getByText('Necesitás conexión.')).toBeTruthy();
  });

  test('sin conexión y sin nota solo se bloquea', () => {
    mockHayConexion = false;
    render(<Boton titulo="Eliminar" requiereConexion onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  test('un botón que no requiere conexión sigue activo sin conexión', () => {
    mockHayConexion = false;
    const onPress = jest.fn();
    render(<Boton titulo="Ver" onPress={onPress} />);

    fireEvent.press(screen.getByText('Ver'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('errores por falta de conexión', () => {
  test('Aviso de error con el mensaje de conexión se muestra como aviso de conexión', () => {
    render(<Aviso tono="peligro" mensaje={MENSAJE_SIN_CONEXION} />);

    expect(screen.getByText(MENSAJE_SIN_CONEXION)).toBeTruthy();
  });

  test('ErrorConReintento titula «Sin conexión» y mantiene el reintento', () => {
    const onReintentar = jest.fn();
    render(<ErrorConReintento mensaje={MENSAJE_SIN_CONEXION} onReintentar={onReintentar} />);

    expect(screen.getByText('Sin conexión')).toBeTruthy();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  test('ErrorConReintento con otro error no agrega el título de conexión', () => {
    render(<ErrorConReintento mensaje="No pudimos completar la solicitud." onReintentar={jest.fn()} />);

    expect(screen.queryByText('Sin conexión')).toBeNull();
  });
});

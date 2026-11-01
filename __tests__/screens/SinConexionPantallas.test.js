import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { __navegacion as navegacion } from '@react-navigation/native';
import AlertasScreen from '../../screens/AlertasScreen';
import SeguidasScreen from '../../screens/SeguidasScreen';
import LoginScreen from '../../screens/LoginScreen';
import { useSearch } from '../../context/SearchContext';
import useAuth from '../../hooks/useAuth';
import { MENSAJE_SIN_CONEXION } from '../../services/api';

let mockHayConexion = true;

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: mockHayConexion }),
}));
jest.mock('../../context/SearchContext');
jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: jest.fn(),
  emailValido: (email) => /\S+@\S+\.\S+/.test(email),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const SIN_CONEXION = /Sin conexión|conexión/;

function contextoBusqueda(extra = {}) {
  return {
    alertas: [{ id: 'a1', activa: true, filtros: { situacion: 'perdi', categoria: 'Llaves', zona: 'Palermo', periodo: 'hoy', palabras: '' } }],
    alertasLoading: false,
    alertasError: '',
    alertasGuardando: false,
    recargarAlertas: jest.fn(),
    eliminarAlerta: jest.fn(),
    activarAlerta: jest.fn(),
    seguidas: [{ id: 'p1', titulo: 'Mochila azul', tipo: 'perdido', fecha: '2026-10-30', fotos: [] }],
    seguidasLoading: false,
    seguidasError: '',
    seguidasGuardando: false,
    recargarSeguidas: jest.fn(),
    dejarDeSeguirPublicacion: jest.fn(),
    novedadesPorAlerta: new Map([['a1', 2]]),
    novedadesPorPublicacion: new Map([['p1', 1]]),
    novedadesLoading: false,
    novedadesError: '',
    novedadesGuardando: false,
    recargarNovedades: jest.fn(),
    marcarAlertaLeida: jest.fn(),
    marcarPublicacionLeida: jest.fn(),
    ...extra,
  };
}

beforeEach(() => {
  mockHayConexion = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('AlertasScreen sin conexión', () => {
  test('muestra un solo aviso de conexión en lugar de los errores y bloquea los cambios', () => {
    mockHayConexion = false;
    const contexto = contextoBusqueda({
      alertasError: MENSAJE_SIN_CONEXION,
      novedadesError: MENSAJE_SIN_CONEXION,
    });
    jest.mocked(useSearch).mockReturnValue(contexto);

    render(<AlertasScreen navigation={navegacion} />);

    expect(screen.getByText(/no pausarlas, eliminarlas ni marcar novedades/)).toBeTruthy();
    expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
    expect(screen.queryByText(/No se pudieron actualizar las novedades/)).toBeNull();

    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar novedades como leídas' })).toBeDisabled();
    expect(screen.getByLabelText('Alerta activa').props.disabled).toBe(true);

    fireEvent.press(screen.getByText('Eliminar'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('con conexión permite eliminar y marcar como leídas', () => {
    const contexto = contextoBusqueda();
    jest.mocked(useSearch).mockReturnValue(contexto);

    render(<AlertasScreen navigation={navegacion} />);

    expect(screen.queryByText(SIN_CONEXION)).toBeNull();
    fireEvent.press(screen.getByText('Marcar novedades como leídas'));
    expect(contexto.marcarAlertaLeida).toHaveBeenCalledWith('a1');
    fireEvent.press(screen.getByText('Eliminar'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});

describe('SeguidasScreen sin conexión', () => {
  test('avisa que falta la conexión y bloquea dejar de seguir', () => {
    mockHayConexion = false;
    jest.mocked(useSearch).mockReturnValue(
      contextoBusqueda({ seguidasError: MENSAJE_SIN_CONEXION, novedadesError: MENSAJE_SIN_CONEXION })
    );

    render(<SeguidasScreen navigation={navegacion} />);

    expect(screen.getByText(/no dejar de seguirlas ni marcar novedades/)).toBeTruthy();
    expect(screen.queryByText(MENSAJE_SIN_CONEXION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Dejar de seguir' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar novedades como leídas' })).toBeDisabled();
  });
});

describe('LoginScreen sin conexión', () => {
  const iniciarSesion = jest.fn();

  beforeEach(() => {
    iniciarSesion.mockClear();
    jest.mocked(useAuth).mockReturnValue({
      iniciarSesion,
      loading: false,
      error: '',
      limpiarError: jest.fn(),
    });
  });

  test('bloquea Ingresar y explica que hace falta conexión', () => {
    mockHayConexion = false;
    render(<LoginScreen navigation={navegacion} />);

    expect(screen.getByText('Necesitás conexión para ingresar.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();
    // Recuperar la contraseña y registrarse siguen abiertas: sus pasos se bloquean al enviar
    expect(screen.getByRole('button', { name: 'Olvidé mi contraseña' })).toBeEnabled();
  });

  test('con conexión Ingresar funciona', () => {
    render(<LoginScreen navigation={navegacion} />);

    expect(screen.queryByText('Necesitás conexión para ingresar.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });
});

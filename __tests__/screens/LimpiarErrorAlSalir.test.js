import { render } from '@testing-library/react-native';
import RegisterScreen from '../../screens/RegisterScreen';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';
import useAuth from '../../hooks/useAuth';

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: true }),
}));
jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: jest.fn(),
  emailValido: (email) => /\S+@\S+\.\S+/.test(email),
  validarContraseña: () => '',
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe.each([
  ['Registro', RegisterScreen],
  ['Recuperar contraseña', ForgotPasswordScreen],
])('%s', (_nombre, Pantalla) => {
  it('limpia el error de auth al salir de la pantalla', () => {
    const limpiarError = jest.fn();
    jest.mocked(useAuth).mockReturnValue({
      loading: false,
      error: 'Esperá 30 segundos antes de pedir otro código.',
      limpiarError,
      solicitarCodigoRegistro: jest.fn(),
      solicitarRecupero: jest.fn(),
      verificarCodigo: jest.fn(),
      reenviarCodigo: jest.fn(),
      registrar: jest.fn(),
      restablecerContraseña: jest.fn(),
    });

    const { unmount } = render(<Pantalla navigation={{ popToTop: jest.fn() }} />);
    expect(limpiarError).not.toHaveBeenCalled();

    unmount();
    expect(limpiarError).toHaveBeenCalledTimes(1);
  });
});

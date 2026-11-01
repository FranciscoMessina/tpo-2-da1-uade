import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../hooks/useAuth';
import useAuth from '../../hooks/useAuth';
import {
  BIOMETRIA_STORAGE_KEY,
  leerBiometriaActiva,
} from '../../hooks/useConfiguracion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

afterEach(() => jest.restoreAllMocks());

describe('cerrar sesión y biometría', () => {
  test('al cerrar sesión se descarta la preferencia de desbloqueo biométrico', async () => {
    await AsyncStorage.setItem(BIOMETRIA_STORAGE_KEY, 'true');
    jest.spyOn(api, 'post').mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(await leerBiometriaActiva()).toBe(true);

    await act(async () => {
      await result.current.cerrarSesion();
    });

    expect(await leerBiometriaActiva()).toBe(false);
    expect(await AsyncStorage.getItem(BIOMETRIA_STORAGE_KEY)).toBeNull();
  });

  test('también se descarta si el servidor no pudo revocar la sesión', async () => {
    await AsyncStorage.setItem(BIOMETRIA_STORAGE_KEY, 'true');
    jest.spyOn(api, 'post').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.cerrarSesion();
    });

    expect(await leerBiometriaActiva()).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AxiosError } from 'axios';
import useRegistroPush, { ESPERA_INICIAL_MS } from '../../hooks/useRegistroPush';
import {
  obtenerCuentaPush,
  obtenerEstadoRegistroPush,
  reiniciarEstadoPush,
} from '../../services/notificacionesPush';
import * as conexion from '../../services/conexion';
import { api } from '../../services/api';
import { controlarAppState, restaurarAppState } from './entorno';

jest.mock('../../services/api', () => ({
  api: { post: jest.fn() },
}));

const errorDeRed = () => new AxiosError('Network Error', 'ERR_NETWORK');

async function esperar(ms = 0) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

let appState;
let avisarConexion;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  reiniciarEstadoPush();
  appState = controlarAppState('active');
  avisarConexion = null;
  jest.spyOn(conexion, 'suscribirConexion').mockImplementation((oyente) => {
    avisarConexion = oyente;
    return () => { avisarConexion = null; };
  });
  api.post.mockResolvedValue({ data: {} });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[t1]' });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restaurarAppState();
});

describe('useRegistroPush', () => {
  test('registra al ingresar y no reintenta si el servidor confirmó', async () => {
    renderHook(() => useRegistroPush('u1'));
    await esperar();

    expect(obtenerEstadoRegistroPush()).toMatchObject({ cuenta: 'u1', estado: 'registrado' });
    await esperar(ESPERA_INICIAL_MS * 4);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('si el servidor no confirma, reintenta con espera creciente hasta lograrlo', async () => {
    api.post.mockRejectedValueOnce(errorDeRed()).mockRejectedValueOnce(errorDeRed());
    renderHook(() => useRegistroPush('u1'));
    await esperar();
    expect(obtenerEstadoRegistroPush().estado).toBe('error_servidor');

    await esperar(ESPERA_INICIAL_MS);
    expect(api.post).toHaveBeenCalledTimes(2);
    // La segunda espera es el doble
    await esperar(ESPERA_INICIAL_MS);
    expect(api.post).toHaveBeenCalledTimes(2);
    await esperar(ESPERA_INICIAL_MS);
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(obtenerEstadoRegistroPush().estado).toBe('registrado');
  });

  test('al volver la conexión reintenta enseguida', async () => {
    api.post.mockRejectedValueOnce(errorDeRed());
    renderHook(() => useRegistroPush('u1'));
    await esperar();

    await act(async () => { avisarConexion(true); });
    await esperar();

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(obtenerEstadoRegistroPush().estado).toBe('registrado');
  });

  test('al volver a primer plano reintenta si faltaba el permiso, sin volver a pedirlo', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ status: 'denied' });
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ status: 'denied' });
    renderHook(() => useRegistroPush('u1'));
    await esperar();
    expect(obtenerEstadoRegistroPush().estado).toBe('sin_permiso');

    // La persona habilitó las notificaciones en Ajustes
    await act(async () => { appState.emitir('active'); });
    await esperar();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(obtenerEstadoRegistroPush().estado).toBe('registrado');
  });

  test('si el sistema renueva el token del dispositivo, vuelve a registrar', async () => {
    renderHook(() => useRegistroPush('u1'));
    await esperar();
    const oyenteToken = jest.mocked(Notifications.addPushTokenListener).mock.calls.at(-1)[0];

    // El primer aviso trae el valor que acompañó al registro; uno distinto es una renovación
    await act(async () => { oyenteToken({ type: 'android', data: 'fcm-1' }); });
    await esperar();
    await act(async () => { oyenteToken({ type: 'android', data: 'fcm-1' }); });
    await esperar();
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[t2]' });
    await act(async () => { oyenteToken({ type: 'android', data: 'fcm-2' }); });
    await esperar();

    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post).toHaveBeenLastCalledWith('/me/push-token', { token: 'ExponentPushToken[t2]' });
  });

  test('al cerrar sesión deja de reintentar y descarta la cuenta', async () => {
    api.post.mockRejectedValue(errorDeRed());
    const { rerender } = renderHook(({ uid }) => useRegistroPush(uid), { initialProps: { uid: 'u1' } });
    await esperar();

    rerender({ uid: null });
    await esperar(ESPERA_INICIAL_MS * 10);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(obtenerCuentaPush()).toBeNull();
    expect(obtenerEstadoRegistroPush().estado).toBe('inactivo');
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
  });
});

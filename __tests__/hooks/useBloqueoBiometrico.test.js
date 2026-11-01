import { act, renderHook, waitFor } from '@testing-library/react-native';
import useBloqueoBiometrico from '../../hooks/useBloqueoBiometrico';
import { leerBiometriaActiva, verificarDisponibilidadBiometrica } from '../../hooks/useConfiguracion';
import * as LocalAuthentication from 'expo-local-authentication';
import { conActividadExterna } from '../../services/actividadExterna';
import { controlarAppState, diferida, restaurarAppState } from './entorno';

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(),
}));

jest.mock('../../hooks/useConfiguracion', () => ({
  leerBiometriaActiva: jest.fn(),
  verificarDisponibilidadBiometrica: jest.fn(),
}));

async function montarDesbloqueado() {
  const appState = controlarAppState('active');
  const hook = renderHook(() => useBloqueoBiometrico());
  await waitFor(() => expect(hook.result.current.bloqueado).toBe(false));
  return { appState, hook };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(leerBiometriaActiva).mockResolvedValue(true);
  jest.mocked(verificarDisponibilidadBiometrica).mockResolvedValue(true);
  jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
});

afterEach(() => {
  restaurarAppState();
  jest.restoreAllMocks();
});

describe('useBloqueoBiometrico', () => {
  test('al salir de la app y volver, pide la biometría otra vez', async () => {
    const { appState, hook } = await montarDesbloqueado();

    await act(async () => appState.emitir('background'));
    expect(hook.result.current.bloqueado).toBe(true);

    await act(async () => appState.emitir('active'));
    await waitFor(() => expect(hook.result.current.bloqueado).toBe(false));
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
  });

  test('abrir la cámara o la galería no bloquea la app ni vuelve a pedir la biometría', async () => {
    const { appState, hook } = await montarDesbloqueado();
    const selector = diferida();
    let abierto;

    await act(async () => {
      abierto = conActividadExterna(() => selector.promesa);
      appState.emitir('background');
    });

    expect(hook.result.current.bloqueado).toBe(false);

    // Android puede avisar que la app volvió antes o después de que responda el selector
    await act(async () => {
      selector.resolver({ canceled: true });
      await abierto;
      appState.emitir('active');
    });

    expect(hook.result.current.bloqueado).toBe(false);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('si la app vuelve antes de que responda el selector tampoco se bloquea', async () => {
    const { appState, hook } = await montarDesbloqueado();
    const selector = diferida();
    let abierto;

    await act(async () => {
      abierto = conActividadExterna(() => selector.promesa);
      appState.emitir('background');
      appState.emitir('active');
      selector.resolver({ canceled: true });
      await abierto;
    });

    expect(hook.result.current.bloqueado).toBe(false);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('después del selector, una salida real de la app vuelve a bloquear', async () => {
    const { appState, hook } = await montarDesbloqueado();

    await act(async () => {
      await conActividadExterna(async () => appState.emitir('background'));
      appState.emitir('active');
    });

    await act(async () => appState.emitir('background'));
    expect(hook.result.current.bloqueado).toBe(true);
  });
});

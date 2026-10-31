import { act, renderHook } from '@testing-library/react-native';
import useActualizacionVisible from '../../hooks/useActualizacionVisible';
import { controlarAppState, restaurarAppState } from './entorno';

// Conexión que ve el hook: las pruebas la cambian y vuelven a renderizar.
let mockConexion;
jest.mock('../../context/ConexionContext', () => ({ useConexion: () => mockConexion }));

const nav = require('@react-navigation/native');

let enFoco;
let appState;

function montar(alActualizar, opciones) {
  return renderHook(
    ({ accion, ajustes }) => useActualizacionVisible(accion, ajustes),
    { initialProps: { accion: alActualizar, ajustes: opciones } }
  );
}

async function avanzar(ms) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

beforeEach(() => {
  jest.useFakeTimers();
  appState = controlarAppState('active');
  mockConexion = { hayConexion: true };
  enFoco = true;
  jest.spyOn(nav, 'useIsFocused').mockImplementation(() => enFoco);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restaurarAppState();
});

describe('useActualizacionVisible', () => {
  test('dispara cada 20 s y no al montar', async () => {
    const accion = jest.fn();
    montar(accion);
    expect(accion).not.toHaveBeenCalled();

    await avanzar(19999);
    expect(accion).not.toHaveBeenCalled();
    await avanzar(1);
    expect(accion).toHaveBeenCalledTimes(1);
    await avanzar(40000);
    expect(accion).toHaveBeenCalledTimes(3);
  });

  test('sin foco no dispara, y al recuperarlo el ciclo vuelve a empezar', async () => {
    const accion = jest.fn();
    const { rerender } = montar(accion);
    await avanzar(10000);

    enFoco = false;
    rerender({ accion });
    await avanzar(120000);
    expect(accion).not.toHaveBeenCalled();

    enFoco = true;
    rerender({ accion });
    // Enfocar no dispara por sí solo (la carga al enfocar es de la pantalla): espera el ciclo
    expect(accion).not.toHaveBeenCalled();
    await avanzar(20000);
    expect(accion).toHaveBeenCalledTimes(1);
  });

  test('en segundo plano o inactiva no dispara, y al volver al primer plano dispara de inmediato', async () => {
    const accion = jest.fn();
    montar(accion);

    await act(async () => { appState.emitir('background'); });
    await avanzar(120000);
    await act(async () => { appState.emitir('inactive'); });
    await avanzar(120000);
    expect(accion).not.toHaveBeenCalled();

    await act(async () => { appState.emitir('active'); });
    expect(accion).toHaveBeenCalledTimes(1);
    await avanzar(20000);
    expect(accion).toHaveBeenCalledTimes(2);
  });

  test('si arranca en segundo plano espera a que la app esté activa', async () => {
    appState = controlarAppState('background');
    const accion = jest.fn();
    montar(accion);
    await avanzar(60000);
    expect(accion).not.toHaveBeenCalled();

    await act(async () => { appState.emitir('active'); });
    expect(accion).toHaveBeenCalledTimes(1);
  });

  test('sin conexión no dispara, y al reconectar dispara de inmediato', async () => {
    const accion = jest.fn();
    const { rerender } = montar(accion);

    mockConexion = { hayConexion: false };
    rerender({ accion });
    await avanzar(120000);
    expect(accion).not.toHaveBeenCalled();

    mockConexion = { hayConexion: true };
    rerender({ accion });
    expect(accion).toHaveBeenCalledTimes(1);
    await avanzar(20000);
    expect(accion).toHaveBeenCalledTimes(2);
  });

  test('volver al primer plano o reconectar sin foco no dispara', async () => {
    const accion = jest.fn();
    enFoco = false;
    const { rerender } = montar(accion);

    await act(async () => { appState.emitir('background'); });
    mockConexion = { hayConexion: false };
    rerender({ accion });
    await act(async () => { appState.emitir('active'); });
    mockConexion = { hayConexion: true };
    rerender({ accion });

    expect(accion).not.toHaveBeenCalled();
  });

  test('usa siempre la última función recibida', async () => {
    const primera = jest.fn();
    const segunda = jest.fn();
    const { rerender } = montar(primera);

    rerender({ accion: segunda });
    await avanzar(20000);

    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });

  test('cambiar de alcance reinicia el ciclo de 20 s', async () => {
    const accion = jest.fn();
    const { rerender } = montar(accion, { alcance: 'u1' });
    await avanzar(15000);

    rerender({ accion, ajustes: { alcance: 'u2' } });
    await avanzar(15000);
    expect(accion).not.toHaveBeenCalled();
    await avanzar(5000);
    expect(accion).toHaveBeenCalledTimes(1);
  });

  test('acepta otro intervalo', async () => {
    const accion = jest.fn();
    montar(accion, { intervaloMs: 5000 });
    await avanzar(10000);
    expect(accion).toHaveBeenCalledTimes(2);
  });

  test('al desmontar se da de baja del estado de la app y deja de disparar', async () => {
    const accion = jest.fn();
    const { unmount } = montar(accion);
    expect(appState.suscripciones()).toBe(1);

    unmount();
    expect(appState.suscripciones()).toBe(0);
    await avanzar(120000);
    expect(accion).not.toHaveBeenCalled();
  });
});

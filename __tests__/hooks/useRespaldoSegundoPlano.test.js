import { renderHook, waitFor } from '@testing-library/react-native';
import * as BackgroundTask from 'expo-background-task';
import useRespaldoSegundoPlano, { useEstadoRespaldo } from '../../hooks/useRespaldoSegundoPlano';
import {
  TAREA_RESPALDO,
  leerEstadoRespaldo,
  reiniciarRespaldo,
} from '../../services/respaldoSegundoPlano';

jest.mock('../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  reiniciarRespaldo();
});

describe('useRespaldoSegundoPlano', () => {
  it('mientras se restaura la sesión no registra ni da de baja', async () => {
    renderHook(() => useRespaldoSegundoPlano(undefined, true));
    await waitFor(async () => expect(await leerEstadoRespaldo()).toMatchObject({ activo: false }));
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it('activa para la cuenta con sesión, cambia de cuenta y se da de baja al salir', async () => {
    const { rerender } = renderHook(
      ({ id, restaurando }) => useRespaldoSegundoPlano(id, restaurando),
      { initialProps: { id: 7, restaurando: false } }
    );
    await waitFor(async () => expect(await leerEstadoRespaldo()).toMatchObject({ cuenta: '7', activo: true, registrada: true }));
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREA_RESPALDO, { minimumInterval: 15 });

    rerender({ id: 8, restaurando: false });
    await waitFor(async () => expect(await leerEstadoRespaldo()).toMatchObject({ cuenta: '8', activo: true }));

    rerender({ id: undefined, restaurando: false });
    await waitFor(async () => expect(await leerEstadoRespaldo()).toMatchObject({ cuenta: null, activo: false }));
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_RESPALDO);
  });
});

describe('useEstadoRespaldo', () => {
  it('lee el estado guardado', async () => {
    renderHook(() => useRespaldoSegundoPlano('u1', false));
    await waitFor(async () => expect(await leerEstadoRespaldo()).toMatchObject({ registrada: true }));
    const { result } = renderHook(() => useEstadoRespaldo());
    await waitFor(() => expect(result.current.estado).toMatchObject({ cuenta: 'u1', registrada: true }));
  });
});

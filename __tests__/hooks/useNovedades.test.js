import { act, renderHook } from '@testing-library/react-native';
import useNovedades from '../../hooks/useNovedades';
import { marcarNotificacionLeida, obtenerNotificaciones } from '../../services/notificaciones';
import { controlarAppState, diferida, restaurarAppState } from './entorno';

// La API se reemplaza: ninguna prueba toca la red.
jest.mock('../../services/notificaciones');

const pagina = (...items) => ({ items, totalPages: 1 });
const publicacion = (id, publicacionId, extra = {}) => ({
  id, tipo: 'publicacion', publicacionId, leidaEn: null, ...extra,
});

// Llamada n (desde 0) a la API: permite resolverla cuando la prueba lo decida.
function pedidos() {
  return obtenerNotificaciones.mock.calls;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(obtenerNotificaciones).mockReset();
  jest.mocked(marcarNotificacionLeida).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restaurarAppState();
});

describe('useNovedades: carga y cuentas', () => {
  test('muestra las novedades sin leer de la cuenta cuando responde la API', async () => {
    controlarAppState();
    obtenerNotificaciones.mockResolvedValue(
      pagina(publicacion('n1', 'p1'), publicacion('n2', 'p1'), publicacion('n3', 'p2', { leidaEn: 'ayer' }))
    );

    const { result } = renderHook(() => useNovedades('u1'));
    expect(result.current.loading).toBe(true);
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.porPublicacion.get('p1')).toBe(2);
    expect(result.current.porPublicacion.has('p2')).toBe(false);
  });

  test('cambiar de cuenta durante una petición no muestra datos de la cuenta anterior', async () => {
    controlarAppState();
    const deUno = diferida();
    const deDos = diferida();
    obtenerNotificaciones
      .mockReturnValueOnce(deUno.promesa)
      .mockReturnValueOnce(deDos.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    rerender({ uid: 'u2' });
    expect(pedidos()).toHaveLength(2);
    // La petición de la cuenta anterior se cancela al cambiar de cuenta
    expect(pedidos()[0][0].signal.aborted).toBe(true);
    expect(pedidos()[1][0].signal.aborted).toBe(false);

    // La respuesta tardía de u1 llega cuando ya está activa u2: se descarta
    await act(async () => { deUno.resolver(pagina(publicacion('n1', 'p-de-u1'))); });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(true);

    await act(async () => { deDos.resolver(pagina(publicacion('n9', 'p-de-u2'))); });
    expect(result.current.loading).toBe(false);
    expect([...result.current.porPublicacion.keys()]).toEqual(['p-de-u2']);
  });

  test('al pasar a otra cuenta no queda a la vista lo ya cargado de la anterior', async () => {
    controlarAppState();
    const deDos = diferida();
    obtenerNotificaciones
      .mockResolvedValueOnce(pagina(publicacion('n1', 'p-de-u1')))
      .mockReturnValueOnce(deDos.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    await act(async () => {});
    expect(result.current.porPublicacion.get('p-de-u1')).toBe(1);

    rerender({ uid: 'u2' });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(true);

    await act(async () => { deDos.resolver(pagina()); });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  test('el error de la petición de una cuenta anterior no se muestra en la actual', async () => {
    controlarAppState();
    const deUno = diferida();
    obtenerNotificaciones
      .mockReturnValueOnce(deUno.promesa)
      .mockResolvedValueOnce(pagina(publicacion('n9', 'p-de-u2')));

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    rerender({ uid: 'u2' });
    await act(async () => { deUno.rechazar(new Error('fallo de u1')); });
    await act(async () => {});

    expect(result.current.error).toBe('');
    expect(result.current.porPublicacion.get('p-de-u2')).toBe(1);
  });

  test('al cerrar sesión descarta la respuesta pendiente y no muestra novedades', async () => {
    controlarAppState();
    const deUno = diferida();
    obtenerNotificaciones.mockReturnValueOnce(deUno.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    rerender({ uid: null });
    await act(async () => { deUno.resolver(pagina(publicacion('n1', 'p-de-u1'))); });

    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(pedidos()).toHaveLength(1);
  });
});

describe('useNovedades: desmontaje', () => {
  test('desmontar cancela la petición, descarta la respuesta y libera temporizador y AppState', async () => {
    const appState = controlarAppState();
    const pendiente = diferida();
    obtenerNotificaciones.mockReturnValue(pendiente.promesa);

    const { unmount } = renderHook(() => useNovedades('u1'));
    expect(appState.suscripciones()).toBe(1);
    expect(jest.getTimerCount()).toBe(1);

    unmount();
    expect(pedidos()[0][0].signal.aborted).toBe(true);
    expect(appState.suscripciones()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    // Responder tarde no rompe nada ni dispara nuevas consultas
    const errores = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { pendiente.resolver(pagina(publicacion('n1', 'p1'))); });
    jest.advanceTimersByTime(60000);
    expect(pedidos()).toHaveLength(1);
    expect(errores).not.toHaveBeenCalled();
  });
});

describe('useNovedades: actualización periódica y AppState', () => {
  test('refresca cada 20 s con la app en primer plano y no en segundo plano', async () => {
    const appState = controlarAppState();
    obtenerNotificaciones.mockResolvedValue(pagina());

    renderHook(() => useNovedades('u1'));
    await act(async () => {});
    expect(pedidos()).toHaveLength(1);

    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(pedidos()).toHaveLength(2);

    act(() => appState.emitir('background'));
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(pedidos()).toHaveLength(2);

    // Al volver a primer plano se actualiza enseguida
    await act(async () => { appState.emitir('active'); });
    expect(pedidos()).toHaveLength(3);
  });

  test('si el servidor falla muestra el mensaje de error de la API', async () => {
    controlarAppState();
    obtenerNotificaciones.mockRejectedValue({
      response: { status: 500, data: { error: { message: 'Servidor en mantenimiento' } } },
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    expect(result.current.error).toBe('Servidor en mantenimiento');
    expect(result.current.loading).toBe(false);
  });
});

describe('useNovedades: marcar como leídas', () => {
  test('marca las novedades de la publicación y actualiza el conteo', async () => {
    controlarAppState();
    obtenerNotificaciones.mockResolvedValue(
      pagina(publicacion('n1', 'p1'), publicacion('n2', 'p2'))
    );
    marcarNotificacionLeida.mockResolvedValue({});

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    let resultado;
    await act(async () => { resultado = await result.current.marcarPublicacionLeida('p1'); });

    expect(resultado).toBe(true);
    expect(marcarNotificacionLeida).toHaveBeenCalledTimes(1);
    expect(marcarNotificacionLeida).toHaveBeenCalledWith('n1');
    expect(result.current.porPublicacion.has('p1')).toBe(false);
    expect(result.current.porPublicacion.get('p2')).toBe(1);
  });

  test('si la cuenta cambia mientras se marca, no se sigue ni se muestra el resultado', async () => {
    controlarAppState();
    const primera = diferida();
    obtenerNotificaciones
      .mockResolvedValueOnce(pagina(publicacion('n1', 'p1'), publicacion('n2', 'p1')))
      .mockReturnValueOnce(new Promise(() => {}));
    marcarNotificacionLeida.mockReturnValueOnce(primera.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    await act(async () => {});

    let marcado;
    await act(async () => {
      marcado = result.current.marcarPublicacionLeida('p1');
    });
    rerender({ uid: 'u2' });
    await act(async () => { primera.resolver({}); });

    expect(await marcado).toBe(false);
    // Solo se alcanzó a marcar la primera; la segunda no se envía porque la sesión terminó
    expect(marcarNotificacionLeida).toHaveBeenCalledTimes(1);
    expect(result.current.porPublicacion.size).toBe(0);
  });
});

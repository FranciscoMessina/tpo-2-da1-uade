import { act, renderHook } from '@testing-library/react-native';
import useNovedades from '../../hooks/useNovedades';
import { marcarGrupoLeido, obtenerResumenNotificaciones } from '../../services/notificaciones';
import { controlarAppState, diferida, restaurarAppState } from './entorno';

// La API se reemplaza: ninguna prueba toca la red.
jest.mock('../../services/notificaciones');

// Resumen del servidor: solo contadores por alerta, publicación y reclamo, más el corte de lectura.
const resumen = ({ alertas = [], publicaciones = [], reclamos = [], corte = 'c1' } = {}) => ({
  sinLeer: 0,
  corte,
  alertas: alertas.map(([alertaId, sinLeer]) => ({ alertaId, sinLeer })),
  publicaciones: publicaciones.map(([publicacionId, sinLeer]) => ({ publicacionId, sinLeer })),
  reclamos: reclamos.map(([reclamoId, sinLeer, mensajes = 0]) => ({ reclamoId, sinLeer, mensajes })),
});
const deUnaPublicacion = (id, cantidad = 1) => resumen({ publicaciones: [[id, cantidad]] });

// Llamada n (desde 0) a la API: permite resolverla cuando la prueba lo decida.
function pedidos() {
  return obtenerResumenNotificaciones.mock.calls;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(obtenerResumenNotificaciones).mockReset();
  jest.mocked(marcarGrupoLeido).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restaurarAppState();
});

describe('useNovedades: carga y cuentas', () => {
  test('muestra las novedades sin leer de la cuenta cuando responde la API', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(resumen({
      alertas: [['a1', 2]],
      publicaciones: [['p1', 2]],
      reclamos: [['r1', 3]],
    }));

    const { result } = renderHook(() => useNovedades('u1'));
    expect(result.current.loading).toBe(true);
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.porAlerta.get('a1')).toBe(2);
    expect(result.current.porPublicacion.get('p1')).toBe(2);
    expect(result.current.porReclamo.get('r1')).toBe(3);
    expect(result.current.porPublicacion.has('p2')).toBe(false);
  });

  test('porReclamo cuenta todo lo nuevo del reclamo y mensajesPorReclamo solo los mensajes del chat', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(resumen({
      reclamos: [['r1', 4, 3], ['r2', 2, 0], ['r3', 1, 1]],
    }));

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    expect(Object.fromEntries(result.current.porReclamo)).toEqual({ r1: 4, r2: 2, r3: 1 });
    expect(Object.fromEntries(result.current.mensajesPorReclamo)).toEqual({ r1: 3, r3: 1 });
    expect(result.current.mensajesPorReclamo.has('r2')).toBe(false);
  });

  test('si el servidor no informa mensajes, mensajesPorReclamo queda vacío', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue({
      corte: 'c1',
      reclamos: [{ reclamoId: 'r1', sinLeer: 2 }],
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    expect(result.current.porReclamo.get('r1')).toBe(2);
    expect(result.current.mensajesPorReclamo.size).toBe(0);
  });

  test('cambiar de cuenta durante una petición no muestra datos de la cuenta anterior', async () => {
    controlarAppState();
    const deUno = diferida();
    const deDos = diferida();
    obtenerResumenNotificaciones
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
    await act(async () => { deUno.resolver(deUnaPublicacion('p-de-u1')); });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(true);

    await act(async () => { deDos.resolver(deUnaPublicacion('p-de-u2')); });
    expect(result.current.loading).toBe(false);
    expect([...result.current.porPublicacion.keys()]).toEqual(['p-de-u2']);
  });

  test('al pasar a otra cuenta no queda a la vista lo ya cargado de la anterior', async () => {
    controlarAppState();
    const deDos = diferida();
    obtenerResumenNotificaciones
      .mockResolvedValueOnce(deUnaPublicacion('p-de-u1'))
      .mockReturnValueOnce(deDos.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    await act(async () => {});
    expect(result.current.porPublicacion.get('p-de-u1')).toBe(1);

    rerender({ uid: 'u2' });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(true);

    await act(async () => { deDos.resolver(resumen()); });
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  test('el error de la petición de una cuenta anterior no se muestra en la actual', async () => {
    controlarAppState();
    const deUno = diferida();
    obtenerResumenNotificaciones
      .mockReturnValueOnce(deUno.promesa)
      .mockResolvedValueOnce(deUnaPublicacion('p-de-u2'));

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
    obtenerResumenNotificaciones.mockReturnValueOnce(deUno.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    rerender({ uid: null });
    await act(async () => { deUno.resolver(deUnaPublicacion('p-de-u1')); });

    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(pedidos()).toHaveLength(1);
  });
});

describe('useNovedades: desmontaje', () => {
  test('desmontar cancela la petición, descarta la respuesta y libera temporizador y AppState', async () => {
    const appState = controlarAppState();
    const pendiente = diferida();
    obtenerResumenNotificaciones.mockReturnValue(pendiente.promesa);

    const { unmount } = renderHook(() => useNovedades('u1'));
    expect(appState.suscripciones()).toBe(1);
    expect(jest.getTimerCount()).toBe(1);

    unmount();
    expect(pedidos()[0][0].signal.aborted).toBe(true);
    expect(appState.suscripciones()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);

    // Responder tarde no rompe nada ni dispara nuevas consultas
    const errores = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { pendiente.resolver(deUnaPublicacion('p1')); });
    jest.advanceTimersByTime(60000);
    expect(pedidos()).toHaveLength(1);
    expect(errores).not.toHaveBeenCalled();
  });
});

describe('useNovedades: actualización periódica y AppState', () => {
  test('refresca cada 20 s con la app en primer plano y no en segundo plano', async () => {
    const appState = controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(resumen());

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
    obtenerResumenNotificaciones.mockRejectedValue({
      response: { status: 500, data: { error: { message: 'Servidor en mantenimiento' } } },
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    expect(result.current.error).toBe('Servidor en mantenimiento');
    expect(result.current.loading).toBe(false);
  });

  test('cada ciclo hace un solo GET del resumen, sin paginar ni pedir historial', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(deUnaPublicacion('p1', 400));

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});
    expect(pedidos()).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(20000); });
    await act(async () => { jest.advanceTimersByTime(20000); });

    expect(pedidos()).toHaveLength(3);
    pedidos().forEach(([opciones]) => {
      expect(Object.keys(opciones)).toEqual(['signal']);
    });
    expect(result.current.porPublicacion.get('p1')).toBe(400);
  });

  test('un error en un ciclo conserva lo ya mostrado y el siguiente ciclo lo recupera', async () => {
    controlarAppState();
    obtenerResumenNotificaciones
      .mockResolvedValueOnce(deUnaPublicacion('p1', 1))
      .mockRejectedValueOnce({ response: { status: 500, data: { error: { message: 'Caído' } } } })
      .mockResolvedValueOnce(deUnaPublicacion('p1', 2));

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(result.current.error).toBe('Caído');
    expect(result.current.porPublicacion.get('p1')).toBe(1);

    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(result.current.error).toBe('');
    expect(result.current.porPublicacion.get('p1')).toBe(2);
  });
});

describe('useNovedades: marcar como leídas', () => {
  test('marca el grupo con una sola escritura y muestra el resumen que devuelve el servidor', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(
      resumen({ publicaciones: [['p1', 2], ['p2', 1]], corte: '7@t7' })
    );
    marcarGrupoLeido.mockResolvedValue({
      marcadas: 2,
      resumen: resumen({ publicaciones: [['p2', 1]], corte: '7@t7' }),
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    let resultado;
    await act(async () => { resultado = await result.current.marcarPublicacionLeida('p1'); });

    expect(resultado).toBe(true);
    expect(marcarGrupoLeido).toHaveBeenCalledTimes(1);
    expect(marcarGrupoLeido).toHaveBeenCalledWith({ tipo: 'publicacion', id: 'p1', corte: '7@t7' });
    // Reconciliar no pide otro GET: el resumen viene en la misma respuesta
    expect(pedidos()).toHaveLength(1);
    expect(result.current.porPublicacion.has('p1')).toBe(false);
    expect(result.current.porPublicacion.get('p2')).toBe(1);
  });

  test('un evento llegado después de lo mostrado no se borra al marcar', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(
      resumen({ alertas: [['a1', 2]], publicaciones: [['p1', 1]], corte: '3@t3' })
    );
    // El servidor dejó sin leer lo que llegó tras el corte: la alerta conserva 1 y aparece otra alerta
    marcarGrupoLeido.mockResolvedValue({
      marcadas: 1,
      resumen: resumen({ alertas: [['a1', 1], ['a2', 1]], publicaciones: [['p1', 1]], corte: '9@t9' }),
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});
    await act(async () => { await result.current.marcarAlertaLeida('a1'); });

    expect(marcarGrupoLeido).toHaveBeenCalledWith({ tipo: 'alerta', id: 'a1', corte: '3@t3' });
    expect(result.current.porAlerta.get('a1')).toBe(1);
    expect(result.current.porAlerta.get('a2')).toBe(1);
    expect(result.current.porPublicacion.get('p1')).toBe(1);

    // La siguiente marca usa el corte nuevo
    marcarGrupoLeido.mockResolvedValue({ marcadas: 1, resumen: resumen({ alertas: [['a2', 1]], corte: '9@t9' }) });
    await act(async () => { await result.current.marcarAlertaLeida('a1'); });
    expect(marcarGrupoLeido).toHaveBeenLastCalledWith({ tipo: 'alerta', id: 'a1', corte: '9@t9' });
  });

  test('los reclamos se marcan con el tipo reclamo', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(resumen({ reclamos: [['r1', 3]], corte: '4@t4' }));
    marcarGrupoLeido.mockResolvedValue({ marcadas: 3, resumen: resumen({ corte: '4@t4' }) });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});
    await act(async () => { await result.current.marcarReclamoLeido('r1'); });

    expect(marcarGrupoLeido).toHaveBeenCalledWith({ tipo: 'reclamo', id: 'r1', corte: '4@t4' });
    expect(result.current.porReclamo.size).toBe(0);
    expect(result.current.mensajesPorReclamo.size).toBe(0);
  });

  test('si el grupo no tiene pendientes no escribe nada', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(deUnaPublicacion('p1'));

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    let resultado;
    await act(async () => { resultado = await result.current.marcarPublicacionLeida('p-sin-pendientes'); });

    expect(resultado).toBe(true);
    expect(marcarGrupoLeido).not.toHaveBeenCalled();
  });

  test('si la escritura falla conserva los contadores, muestra el error y devuelve false', async () => {
    controlarAppState();
    obtenerResumenNotificaciones.mockResolvedValue(deUnaPublicacion('p1', 2));
    marcarGrupoLeido.mockRejectedValue({
      response: { status: 500, data: { error: { message: 'No se pudo marcar' } } },
    });

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    let resultado;
    await act(async () => { resultado = await result.current.marcarPublicacionLeida('p1'); });

    expect(resultado).toBe(false);
    expect(result.current.error).toBe('No se pudo marcar');
    expect(result.current.porPublicacion.get('p1')).toBe(2);
    expect(result.current.guardando).toBe(false);
  });

  test('mientras se marca no se consulta el resumen y después se retoma el ciclo', async () => {
    controlarAppState();
    const escritura = diferida();
    obtenerResumenNotificaciones.mockResolvedValue(deUnaPublicacion('p1'));
    marcarGrupoLeido.mockReturnValueOnce(escritura.promesa);

    const { result } = renderHook(() => useNovedades('u1'));
    await act(async () => {});

    let marcado;
    await act(async () => { marcado = result.current.marcarPublicacionLeida('p1'); });
    expect(result.current.guardando).toBe(true);
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(pedidos()).toHaveLength(1);

    await act(async () => { escritura.resolver({ marcadas: 1, resumen: resumen() }); });
    expect(await marcado).toBe(true);
    expect(result.current.guardando).toBe(false);

    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(pedidos()).toHaveLength(2);
  });

  test('si la cuenta cambia mientras se marca, no se muestra el resultado de la anterior', async () => {
    controlarAppState();
    const escritura = diferida();
    obtenerResumenNotificaciones
      .mockResolvedValueOnce(deUnaPublicacion('p1', 2))
      .mockReturnValueOnce(new Promise(() => {}));
    marcarGrupoLeido.mockReturnValueOnce(escritura.promesa);

    const { result, rerender } = renderHook(({ uid }) => useNovedades(uid), {
      initialProps: { uid: 'u1' },
    });
    await act(async () => {});

    let marcado;
    await act(async () => {
      marcado = result.current.marcarPublicacionLeida('p1');
    });
    rerender({ uid: 'u2' });
    await act(async () => {
      escritura.resolver({ marcadas: 2, resumen: deUnaPublicacion('p-de-u1', 5) });
    });

    expect(await marcado).toBe(false);
    expect(marcarGrupoLeido).toHaveBeenCalledTimes(1);
    expect(result.current.porPublicacion.size).toBe(0);
    expect(result.current.guardando).toBe(false);
  });
});

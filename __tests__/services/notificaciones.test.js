import { api } from '../../services/api';
import {
  marcarGrupoLeido,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerNotificaciones,
  obtenerResumenNotificaciones,
} from '../../services/notificaciones';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('services/notificaciones: resumen', () => {
  test('pide el resumen con una sola petición GET sin paginar y propaga la cancelación', async () => {
    const resumen = { sinLeer: 0, corte: null, alertas: [], publicaciones: [], reclamos: [] };
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: resumen });
    const { signal } = new AbortController();

    await expect(obtenerResumenNotificaciones({ signal })).resolves.toBe(resumen);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/notificaciones/resumen', { signal });
  });

  test('marca un grupo con un solo POST que lleva tipo, id y corte', async () => {
    const respuesta = { marcadas: 2, resumen: { sinLeer: 0 } };
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: respuesta });

    await expect(
      marcarGrupoLeido({ tipo: 'alerta', id: 'a/1', corte: '12@2026-03-01T00:00:00.000Z' })
    ).resolves.toBe(respuesta);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/notificaciones/grupo/leida', {
      tipo: 'alerta',
      id: 'a/1',
      corte: '12@2026-03-01T00:00:00.000Z',
    });
  });

  test('el listado paginado anterior sigue disponible y pide páginas de 100', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { items: [], totalPages: 0 } });

    await obtenerNotificaciones({ pagina: 3 });

    expect(get).toHaveBeenCalledWith('/notificaciones', {
      params: { page: 3, pageSize: 100 },
      signal: undefined,
    });
  });
});

describe('services/notificaciones: bandeja', () => {
  test('pide el historial con el tamaño de página indicado', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { items: [], totalPages: 0 } });

    await obtenerNotificaciones({ pagina: 2, tamanoPagina: 20 });

    expect(get).toHaveBeenCalledWith('/notificaciones', {
      params: { page: 2, pageSize: 20 },
      signal: undefined,
    });
  });

  test('marca una y todas como leídas', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ data: { message: 'ok' } });

    await marcarNotificacionLeida('n/1');
    await marcarTodasLeidas();

    expect(post).toHaveBeenNthCalledWith(1, '/notificaciones/n%2F1/leida');
    expect(post).toHaveBeenNthCalledWith(2, '/notificaciones/leidas');
  });
});

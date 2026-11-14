import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotificacionesScreen, { fechaNotificacion, TAMANO_PAGINA } from '../../screens/NotificacionesScreen';
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerNotificaciones,
} from '../../services/notificaciones';
import { __navegacion as navegacion } from '@react-navigation/native';
import { diferida } from '../hooks/entorno';

// La API se reemplaza: la prueba no toca la red.
jest.mock('../../services/notificaciones');

let mockConexion;
let mockBusqueda;
jest.mock('../../context/ConexionContext', () => ({ useConexion: () => mockConexion }));
jest.mock('../../context/SearchContext', () => ({ useSearch: () => mockBusqueda }));

const aviso = (id, extra = {}) => ({
  id,
  tipo: 'coincidencia',
  mensaje: `Aviso ${id}`,
  publicacionId: `p${id}`,
  reclamoId: null,
  alertaId: 'a1',
  creadaEn: '2026-11-10T15:30:00.000Z',
  leidaEn: null,
  ...extra,
});
const pagina = (items, { page = 1, totalPages = 1, sinLeer } = {}) => ({
  items,
  page,
  totalPages,
  total: items.length,
  sinLeer: sinLeer ?? items.filter((n) => !n.leidaEn).length,
});

beforeEach(() => {
  mockConexion = { hayConexion: true };
  mockBusqueda = { recargarNovedades: jest.fn() };
  jest.mocked(obtenerNotificaciones).mockReset();
  jest.mocked(marcarNotificacionLeida).mockReset().mockResolvedValue({});
  jest.mocked(marcarTodasLeidas).mockReset().mockResolvedValue({});
});

describe('NotificacionesScreen', () => {
  test('muestra el historial y distingue las sin leer de las leídas', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([
      aviso('1'),
      aviso('2', { tipo: 'reclamo', mensaje: 'Aceptaron tu reclamo', leidaEn: '2026-11-11T00:00:00.000Z' }),
    ]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});

    expect(obtenerNotificaciones).toHaveBeenCalledWith({ pagina: 1, tamanoPagina: TAMANO_PAGINA });
    expect(screen.getByText('1 sin leer')).toBeTruthy();
    expect(screen.getAllByText('Sin leer')).toHaveLength(1);
    expect(screen.getByLabelText(/^Sin leer\. Aviso 1\. Alerta\./)).toBeTruthy();
    expect(screen.getByLabelText(/^Leída\. Aceptaron tu reclamo\. Reclamo\./)).toBeTruthy();
  });

  test('al tocar una sin leer la marca, actualiza los contadores y abre la publicación', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([aviso('1')]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByLabelText(/Aviso 1/)); });

    expect(marcarNotificacionLeida).toHaveBeenCalledWith('1');
    expect(mockBusqueda.recargarNovedades).toHaveBeenCalled();
    expect(navegacion.navigate).toHaveBeenCalledWith('DetallePublicacion', { publicacionId: 'p1' });
    expect(screen.getByText('Todo leído')).toBeTruthy();
    expect(screen.queryByText('Sin leer')).toBeNull();
  });

  test('si el servidor no la marca, vuelve a mostrarse sin leer', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([aviso('1')]));
    marcarNotificacionLeida.mockRejectedValueOnce(new Error('falló'));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByLabelText(/Aviso 1/)); });

    expect(screen.getByText('1 sin leer')).toBeTruthy();
    expect(screen.getByText('Sin leer')).toBeTruthy();
  });

  test('una leída no se vuelve a marcar y los avisos de reclamos llevan a la pestaña Reclamos', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([
      aviso('1', { tipo: 'mensaje', reclamoId: 'r1', leidaEn: '2026-11-11T00:00:00.000Z' }),
    ]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByLabelText(/Aviso 1/)); });

    expect(marcarNotificacionLeida).not.toHaveBeenCalled();
    expect(navegacion.popTo).toHaveBeenCalledWith('Principal', { screen: 'MisReclamos' });
  });

  test('las valoraciones llevan al historial de devoluciones', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([aviso('1', { tipo: 'valoracion' })]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByLabelText(/Aviso 1/)); });

    expect(navegacion.navigate).toHaveBeenCalledWith('Historial');
  });

  test('marca todas como leídas', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([aviso('1'), aviso('2')]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    expect(screen.getByText('2 sin leer')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByText('Marcar todas como leídas')); });

    expect(marcarTodasLeidas).toHaveBeenCalledTimes(1);
    expect(mockBusqueda.recargarNovedades).toHaveBeenCalled();
    expect(screen.getByText('Todo leído')).toBeTruthy();
    expect(screen.queryByText('Sin leer')).toBeNull();
  });

  test('carga la página siguiente sin repetir avisos', async () => {
    obtenerNotificaciones
      .mockResolvedValueOnce(pagina([aviso('1'), aviso('2')], { totalPages: 2 }))
      .mockResolvedValueOnce(pagina([aviso('2'), aviso('3')], { page: 2, totalPages: 2 }));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByText('Ver más')); });

    expect(obtenerNotificaciones).toHaveBeenLastCalledWith({ pagina: 2, tamanoPagina: TAMANO_PAGINA });
    expect(screen.getAllByText('Aviso 2')).toHaveLength(1);
    expect(screen.getByText('Aviso 3')).toBeTruthy();
    expect(screen.queryByText('Ver más')).toBeNull();
  });

  test('muestra el estado vacío', async () => {
    obtenerNotificaciones.mockResolvedValueOnce(pagina([]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});

    expect(screen.getByText('No tenés notificaciones')).toBeTruthy();
  });

  test('muestra el error y permite reintentar', async () => {
    obtenerNotificaciones
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Servidor caído' } } } })
      .mockResolvedValueOnce(pagina([aviso('1')]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    expect(screen.getByText('Servidor caído')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByText('Reintentar')); });

    expect(screen.getByText('Aviso 1')).toBeTruthy();
  });

  test('sin conexión no intenta marcar, pero abre el destino', async () => {
    mockConexion = { hayConexion: false };
    obtenerNotificaciones.mockResolvedValueOnce(pagina([aviso('1')]));

    render(<NotificacionesScreen navigation={navegacion} />);
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByLabelText(/Aviso 1/)); });

    expect(marcarNotificacionLeida).not.toHaveBeenCalled();
    expect(navegacion.navigate).toHaveBeenCalledWith('DetallePublicacion', { publicacionId: 'p1' });
    expect(screen.getByText('1 sin leer')).toBeTruthy();
  });

  test('descarta una respuesta que llega después de desmontar', async () => {
    const pendiente = diferida();
    obtenerNotificaciones.mockReturnValueOnce(pendiente.promesa);
    const errores = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<NotificacionesScreen navigation={navegacion} />);
    unmount();
    await act(async () => { pendiente.resolver(pagina([aviso('1')])); });

    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
  });
});

describe('fechaNotificacion', () => {
  const ahora = new Date(2026, 10, 14, 18, 0);

  test('dice Hoy, Ayer o la fecha completa', () => {
    expect(fechaNotificacion(new Date(2026, 10, 14, 9, 5).toISOString(), ahora)).toBe('Hoy, 09:05');
    expect(fechaNotificacion(new Date(2026, 10, 13, 22, 40).toISOString(), ahora)).toBe('Ayer, 22:40');
    expect(fechaNotificacion(new Date(2026, 10, 2, 7, 0).toISOString(), ahora)).toMatch(/^02\/11\/2026, 07:00$/);
    expect(fechaNotificacion('no es fecha', ahora)).toBe('');
  });
});

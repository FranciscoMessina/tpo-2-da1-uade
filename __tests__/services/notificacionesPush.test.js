import * as Notifications from 'expo-notifications';
import { AxiosError } from 'axios';
import {
  avisosLocalesActivos,
  configurarOyentesNotificaciones,
  ejecutarNavegacionPendiente,
  esEventoPushRelevante,
  establecerCuentaPush,
  navegarADestino,
  obtenerEstadoRegistroPush,
  obtenerNotificacionPendiente,
  obtenerYRegistrarTokenPush,
  reiniciarEstadoPush,
  sincronizarAvisosNativos,
  suscribirNovedadesPush,
} from '../../services/notificacionesPush';
import { reiniciarCacheAvisos } from '../../services/registroAvisos';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: { post: jest.fn() },
}));

// El módulo instala su manejador al importarse: se guarda antes de que se limpien los dobles
const manejador = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0];

const errorDeRed = () => new AxiosError('Network Error', 'ERR_NETWORK');
const errorHttp = (status) => Object.assign(new AxiosError(`HTTP ${status}`), { response: { status } });

// Notificación tal como la entrega expo-notifications
function notificacion({ id, tipo = 'reclamo', push = true, identificador = `req-${id}` }) {
  return {
    date: 1,
    request: {
      identifier: identificador,
      content: { title: 'Reclamo', body: 'x', data: { id, notificationId: id, tipo, claimId: 'r1', reclamoId: 'r1' } },
      trigger: push ? { type: 'push' } : null,
    },
  };
}
const respuesta = (datos, identificador = 'resp-1') => ({
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  notification: { date: 1, request: { identifier: identificador, content: { data: datos } } },
});
const item = (id, extra = {}) => ({ id, tipo: 'reclamo', mensaje: `Aviso ${id}`, leidaEn: null, ...extra });

async function mostrar(notif) {
  return (await manejador.handleNotification(notif)).shouldShowBanner;
}

// Deja la cuenta con el respaldo local activo (el servidor no confirmó el registro)
async function cuentaSinPush(cuenta = 'u1') {
  establecerCuentaPush(cuenta);
  api.post.mockRejectedValueOnce(errorDeRed());
  await obtenerYRegistrarTokenPush();
  expect(avisosLocalesActivos(cuenta)).toBe(true);
}

const programadas = () => jest.mocked(Notifications.scheduleNotificationAsync).mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  reiniciarEstadoPush();
  reiniciarCacheAvisos();
  api.post.mockResolvedValue({ data: { message: 'ok' } });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  jest.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('local-1');
  jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue([]);
});

describe('esEventoPushRelevante', () => {
  test('reclamo, encuentro y devolución salen como aviso; el resto no', () => {
    expect(esEventoPushRelevante({ tipo: 'reclamo' })).toBe(true);
    expect(esEventoPushRelevante({ tipo: 'encuentro' })).toBe(true);
    expect(esEventoPushRelevante({ tipo: 'devolucion' })).toBe(true);
    expect(esEventoPushRelevante({ tipo: 'mensaje' })).toBe(false);
    expect(esEventoPushRelevante(null)).toBe(false);
  });
});

describe('registro del token', () => {
  test('queda registrado solo cuando el servidor confirma', async () => {
    establecerCuentaPush('u1');
    const resultado = await obtenerYRegistrarTokenPush();

    expect(api.post).toHaveBeenCalledWith('/me/push-token', { token: 'ExponentPushToken[abc]' });
    expect(resultado).toMatchObject({ cuenta: 'u1', estado: 'registrado', token: 'ExponentPushToken[abc]' });
    expect(avisosLocalesActivos('u1')).toBe(false);
  });

  test('si el servidor no responde no se informa como registrado y se activa el respaldo', async () => {
    establecerCuentaPush('u1');
    api.post.mockRejectedValueOnce(errorDeRed());

    const resultado = await obtenerYRegistrarTokenPush();

    expect(resultado.estado).toBe('error_servidor');
    expect(avisosLocalesActivos('u1')).toBe(true);
    // El reintento confirma y apaga el respaldo
    expect((await obtenerYRegistrarTokenPush()).estado).toBe('registrado');
    expect(avisosLocalesActivos('u1')).toBe(false);
  });

  test('un 422 del servidor queda como rechazado y un 503 como reintentable', async () => {
    establecerCuentaPush('u1');
    api.post.mockRejectedValueOnce(errorHttp(422));
    expect((await obtenerYRegistrarTokenPush()).estado).toBe('rechazado');
    api.post.mockRejectedValueOnce(errorHttp(503));
    expect((await obtenerYRegistrarTokenPush()).estado).toBe('error_servidor');
  });

  test('sin token de Expo (sin projectId o en Expo Go) no llama al servidor', async () => {
    establecerCuentaPush('u1');
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('No projectId'));

    const resultado = await obtenerYRegistrarTokenPush();

    expect(resultado.estado).toBe('no_disponible');
    expect(resultado.error).toMatch(/No projectId/);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('sin permiso no pide el token; un reintento silencioso no vuelve a mostrar el diálogo', async () => {
    establecerCuentaPush('u1');
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' });
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({ status: 'denied' });

    expect((await obtenerYRegistrarTokenPush()).estado).toBe('sin_permiso');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);

    await obtenerYRegistrarTokenPush({ pedirPermiso: false });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  test('llamadas simultáneas comparten un solo intento', async () => {
    establecerCuentaPush('u1');
    const [a, b] = await Promise.all([obtenerYRegistrarTokenPush(), obtenerYRegistrarTokenPush()]);
    expect(a).toBe(b);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('si la cuenta cambia durante el registro, el resultado no se aplica a la nueva', async () => {
    establecerCuentaPush('u1');
    let resolver;
    api.post.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    const enCurso = obtenerYRegistrarTokenPush();
    await Promise.resolve();
    await new Promise(setImmediate);

    establecerCuentaPush('u2');
    resolver({ data: {} });
    await enCurso;

    expect(obtenerEstadoRegistroPush()).toMatchObject({ cuenta: 'u2', estado: 'inactivo' });
  });
});

describe('push y consulta periódica sin duplicados', () => {
  test('con el push registrado la consulta periódica no genera avisos locales', async () => {
    establecerCuentaPush('u1');
    await obtenerYRegistrarTokenPush();

    await sincronizarAvisosNativos([item('n1')], 'u1');
    await sincronizarAvisosNativos([item('n1'), item('n2')], 'u1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('la primera consulta de la cuenta solo toma punto de partida: no repite avisos viejos', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('viejo')], 'u1');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    await sincronizarAvisosNativos([item('nuevo', { reclamoId: 'r1' }), item('viejo')], 'u1');
    expect(programadas()).toHaveLength(1);
    expect(programadas()[0][0].content.data).toMatchObject({ id: 'nuevo', reclamoId: 'r1' });
  });

  test('si el aviso local salió primero, el push con el mismo id no se vuelve a mostrar', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');
    await sincronizarAvisosNativos([item('n1', { reclamoId: 'r1' })], 'u1');
    expect(programadas()).toHaveLength(1);

    expect(await mostrar(notificacion({ id: 'n1' }))).toBe(false);
    // Otro push distinto sí se muestra
    expect(await mostrar(notificacion({ id: 'n2' }))).toBe(true);
  });

  test('si el push llegó primero, la consulta no genera el aviso local', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');

    expect(await mostrar(notificacion({ id: 'n1' }))).toBe(true);
    await sincronizarAvisosNativos([item('n1')], 'u1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('push recibido en segundo plano (oyente) y luego consulta: sin aviso local', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');
    const desuscribir = configurarOyentesNotificaciones({ navigate: jest.fn() }, () => 'lista');
    const oyente = jest.mocked(Notifications.addNotificationReceivedListener).mock.calls.at(-1)[0];

    oyente(notificacion({ id: 'n1' }));
    await new Promise(setImmediate);
    await sincronizarAvisosNativos([item('n1')], 'u1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    desuscribir();
  });

  test('una notificación que ya está en la bandeja del sistema no se repite', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');
    jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue([notificacion({ id: 'n1' })]);

    await sincronizarAvisosNativos([item('n1')], 'u1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('si mostrar el aviso falla no queda marcado y se intenta en el ciclo siguiente', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error('canal'));

    await sincronizarAvisosNativos([item('n1')], 'u1');
    await sincronizarAvisosNativos([item('n1')], 'u1');

    expect(programadas()).toHaveLength(2);
    expect(await mostrar(notificacion({ id: 'n1' }))).toBe(false);
  });

  test('las devoluciones también generan aviso y las leídas no', async () => {
    await cuentaSinPush();
    await sincronizarAvisosNativos([item('base')], 'u1');

    await sincronizarAvisosNativos([
      item('d1', { tipo: 'devolucion', mensaje: 'Se confirmó la devolución' }),
      item('l1', { leidaEn: '2026-11-15T00:00:00Z' }),
      item('m1', { tipo: 'mensaje' }),
    ], 'u1');

    expect(programadas()).toHaveLength(1);
    expect(programadas()[0][0].content).toMatchObject({ title: 'Devolución' });
  });

  test('las cuentas no comparten estado y sin sesión no se muestran pushes', async () => {
    await cuentaSinPush('u1');
    await sincronizarAvisosNativos([item('base')], 'u1');
    await sincronizarAvisosNativos([item('n1')], 'u1');

    establecerCuentaPush(null);
    await new Promise(setImmediate);
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
    expect(await mostrar(notificacion({ id: 'n9' }))).toBe(false);
    // Lo pedido por la cuenta anterior ya no se muestra
    await sincronizarAvisosNativos([item('n2')], 'u1');
    expect(programadas()).toHaveLength(1);

    // La otra cuenta empieza su propio registro (primera consulta = punto de partida)
    await cuentaSinPush('u2');
    await sincronizarAvisosNativos([item('n1')], 'u2');
    expect(programadas()).toHaveLength(1);
  });

  test('un push recibido avisa a los suscriptores para refrescar contadores', async () => {
    establecerCuentaPush('u1');
    const oyenteNovedad = jest.fn();
    suscribirNovedadesPush(oyenteNovedad);
    const desuscribir = configurarOyentesNotificaciones({ navigate: jest.fn() }, () => 'lista');
    const oyente = jest.mocked(Notifications.addNotificationReceivedListener).mock.calls.at(-1)[0];

    oyente(notificacion({ id: 'n1' }));
    await new Promise(setImmediate);
    // Un aviso local no cuenta como novedad del servidor
    oyente(notificacion({ id: 'n2', push: false }));
    await new Promise(setImmediate);

    expect(oyenteNovedad).toHaveBeenCalledTimes(1);
    desuscribir();
  });
});

describe('navegación al tocar', () => {
  const navLista = () => ({
    navigate: jest.fn(),
    popTo: jest.fn(),
    isReady: () => true,
    getRootState: () => ({ routeNames: ['Principal', 'Configuracion'] }),
  });

  function tocar(datos, identificador) {
    const oyente = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls.at(-1)[0];
    oyente(respuesta(datos, identificador));
  }

  test('lleva al reclamo con su id (reclamo, encuentro y devolución)', () => {
    const nav = navLista();
    navegarADestino(nav, { tipo: 'devolucion', claimId: 'r9' });
    expect(nav.popTo).toHaveBeenCalledWith('Principal', { screen: 'MisReclamos', params: { reclamoId: 'r9' } });
  });

  test('otros destinos: historial, publicación y bandeja', () => {
    const nav = navLista();
    navegarADestino(nav, { tipo: 'valoracion' });
    navegarADestino(nav, { tipo: 'coincidencia', publicacionId: 'p1' });
    navegarADestino(nav, {});
    expect(nav.navigate.mock.calls).toEqual([
      ['Historial'],
      ['DetallePublicacion', { publicacionId: 'p1' }],
      ['Notificaciones'],
    ]);
  });

  test('con la sesión bloqueada por biometría retiene el destino hasta desbloquear', () => {
    const nav = navLista();
    let estado = 'bloqueada';
    const desuscribir = configurarOyentesNotificaciones(nav, () => estado);

    tocar({ tipo: 'reclamo', reclamoId: 'r1' });
    expect(nav.popTo).not.toHaveBeenCalled();
    expect(obtenerNotificacionPendiente()).toEqual({ tipo: 'reclamo', reclamoId: 'r1' });

    estado = 'lista';
    expect(ejecutarNavegacionPendiente(nav)).toBe(true);
    expect(nav.popTo).toHaveBeenCalledWith('Principal', { screen: 'MisReclamos', params: { reclamoId: 'r1' } });
    expect(obtenerNotificacionPendiente()).toBeNull();
    desuscribir();
  });

  test('mientras se restaura la sesión retiene; sin sesión descarta el destino', () => {
    const nav = navLista();
    let estado = 'cargando';
    const desuscribir = configurarOyentesNotificaciones(nav, () => estado);

    tocar({ tipo: 'reclamo', reclamoId: 'r1' }, 'a');
    expect(obtenerNotificacionPendiente()).toEqual({ tipo: 'reclamo', reclamoId: 'r1' });

    estado = 'sin_sesion';
    establecerCuentaPush('u1');
    establecerCuentaPush(null);
    tocar({ tipo: 'reclamo', reclamoId: 'r2' }, 'b');
    expect(obtenerNotificacionPendiente()).toBeNull();
    desuscribir();
  });

  test('cerrar sesión o cambiar de cuenta descarta la navegación pendiente', () => {
    establecerCuentaPush('u1');
    navegarADestino({ navigate: jest.fn(), getRootState: () => ({ routeNames: ['Login'] }) }, { tipo: 'reclamo', reclamoId: 'r1' });
    expect(obtenerNotificacionPendiente()).not.toBeNull();

    establecerCuentaPush('u2');
    expect(obtenerNotificacionPendiente()).toBeNull();
  });

  test('la respuesta con que se abrió la app se procesa una sola vez aunque se reconfigure', async () => {
    jest.mocked(Notifications.getLastNotificationResponseAsync)
      .mockResolvedValue(respuesta({ tipo: 'reclamo', reclamoId: 'r1' }, 'inicial'));
    const nav = navLista();

    const primero = configurarOyentesNotificaciones(nav, () => 'lista');
    await new Promise(setImmediate);
    primero();
    const segundo = configurarOyentesNotificaciones(nav, () => 'lista');
    await new Promise(setImmediate);
    // El mismo toque repetido por el oyente tampoco navega dos veces
    tocar({ tipo: 'reclamo', reclamoId: 'r1' }, 'inicial');

    expect(nav.popTo).toHaveBeenCalledTimes(1);
    expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
    segundo();
  });
});

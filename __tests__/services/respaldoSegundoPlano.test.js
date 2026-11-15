import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError } from 'axios';
import { Platform } from 'react-native';
import { api } from '../../services/api';
import {
  CLAVE_ESTADO,
  INTERVALO_MINUTOS,
  MARGEN_PUSH_MS,
  PREFIJO_CURSOR,
  TAREA_PUSH_SEGUNDO_PLANO,
  TAREA_RESPALDO,
  activarRespaldo,
  anotarPushSegundoPlano,
  desactivarRespaldo,
  ejecutarRespaldo,
  leerEstadoRespaldo,
  reiniciarRespaldo,
} from '../../services/respaldoSegundoPlano';
import {
  anotarPush,
  reiniciarCacheAvisos,
  reservarLocales,
} from '../../services/registroAvisos';
import {
  establecerCuentaPush,
  obtenerEstadoRegistroPush,
  obtenerYRegistrarTokenPush,
  reiniciarEstadoPush,
} from '../../services/notificacionesPush';

jest.mock('../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

// Doble de expo-task-manager (jest.setup.js): guarda los ejecutores definidos
const TaskManager = jest.requireMock('expo-task-manager');

const CLAVE_TOKEN = 'hallado.session.token';
const CLAVE_PERFIL = 'hallado.session.perfil';
const T0 = Date.parse('2026-11-15T12:00:00.000Z');
const MIN = 60 * 1000;

// Servidor simulado: notificaciones de la más nueva a la más vieja, paginadas por desplazamiento,
// y solo el token vigente es válido (otro token responde 401)
let servidor;
let reloj;
const ahora = () => reloj;

function iso(ms) {
  return new Date(ms).toISOString();
}

function evento(id, creadaMs, extra = {}) {
  return {
    id, tipo: 'reclamo', mensaje: `Aviso ${id}`, reclamoId: 'r1', publicacionId: 'p1',
    creadaEn: iso(creadaMs), leidaEn: null, ...extra,
  };
}

function publicar(...eventos) {
  servidor.items = [...eventos, ...servidor.items]
    .sort((a, b) => Date.parse(b.creadaEn) - Date.parse(a.creadaEn));
}

function responderGet(url, config) {
  if (url !== '/notificaciones') return Promise.reject(new Error(`URL inesperada ${url}`));
  servidor.pedidos.push({ ...config.params, auth: config.headers?.Authorization });
  if (servidor.falla) return Promise.reject(servidor.falla);
  if (config.headers?.Authorization !== `Bearer ${servidor.token}`) {
    return Promise.reject(Object.assign(new AxiosError('401'), {
      response: { status: 401, data: { error: { code: 'INVALID_SESSION' } } },
    }));
  }
  const { page, pageSize } = config.params;
  const items = servidor.items.slice((page - 1) * pageSize, page * pageSize);
  return Promise.resolve({
    data: {
      items, page, pageSize, total: servidor.items.length,
      totalPages: Math.ceil(servidor.items.length / pageSize), sinLeer: 0,
    },
  });
}

async function sesion(cuenta = 'u1', token = `tok-${cuenta}`) {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
  await SecureStore.setItemAsync(CLAVE_PERFIL, JSON.stringify({ id: cuenta, name: 'Ana' }));
  servidor.token = token;
}

const avisos = () => jest.mocked(Notifications.scheduleNotificationAsync).mock.calls
  .map(([pedido]) => pedido.content);
const idsAvisados = () => avisos().map((c) => c.data.id);

// Corre la tarea como lo hace el sistema: el ejecutor que quedó definido al cargar el módulo
function correrTarea() {
  return TaskManager.__definidas.get(TAREA_RESPALDO)({ data: null, error: null, executionInfo: {} });
}

async function listoConBase(cuenta = 'u1') {
  await sesion(cuenta);
  await activarRespaldo(cuenta);
  const base = await ejecutarRespaldo({ ahora });
  expect(base.detalle).toBe('Punto de partida tomado.');
}

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = 'ios';
});

beforeEach(() => {
  jest.clearAllMocks();
  reiniciarRespaldo();
  reiniciarCacheAvisos();
  reiniciarEstadoPush();
  servidor = { items: [], pedidos: [], token: null, falla: null };
  reloj = T0;
  // La tarea usa Date.now: se fija al reloj de la prueba (sin temporizadores reales)
  jest.spyOn(Date, 'now').mockImplementation(() => reloj);
  jest.mocked(api.get).mockImplementation(responderGet);
  jest.mocked(api.post).mockResolvedValue({ data: {} });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
  jest.mocked(Notifications.scheduleNotificationAsync).mockResolvedValue('local-1');
  jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue([]);
  jest.mocked(BackgroundTask.getStatusAsync).mockResolvedValue(2);
});

describe('alta y baja de la tarea', () => {
  it('define las tareas al cargar el módulo, sin montar nada', () => {
    expect(TaskManager.__definidas.has(TAREA_RESPALDO)).toBe(true);
    expect(TaskManager.__definidas.has(TAREA_PUSH_SEGUNDO_PLANO)).toBe(true);
  });

  it('registra la tarea con el mínimo de 15 minutos y no la re-registra al reabrir', async () => {
    const estado = await activarRespaldo('u1');
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(TAREA_RESPALDO, { minimumInterval: INTERVALO_MINUTOS });
    expect(INTERVALO_MINUTOS).toBe(15);
    expect(estado).toMatchObject({ cuenta: 'u1', activo: true, registrada: true, disponible: true, errorRegistro: '' });

    await activarRespaldo('u1');
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledTimes(1);
  });

  it('en Android registra además la tarea que anota los push recibidos en segundo plano', async () => {
    Platform.OS = 'android';
    await activarRespaldo('u1');
    expect(Notifications.registerTaskAsync).toHaveBeenCalledWith(TAREA_PUSH_SEGUNDO_PLANO);
  });

  it('al salir da de baja ambas tareas y deja el estado inactivo', async () => {
    Platform.OS = 'android';
    await activarRespaldo('u1');
    await desactivarRespaldo();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_RESPALDO);
    expect(Notifications.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_PUSH_SEGUNDO_PLANO);
    expect(await leerEstadoRespaldo()).toMatchObject({ cuenta: null, activo: false });
  });

  it('informa cuando el sistema no permite tareas en segundo plano', async () => {
    jest.mocked(BackgroundTask.getStatusAsync).mockResolvedValueOnce(1);
    const estado = await activarRespaldo('u1');
    expect(estado).toMatchObject({ activo: true, disponible: false, registrada: false });
    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('en iOS no registra la tarea de push (requiere push silencioso)', async () => {
    await activarRespaldo('u1');
    expect(Notifications.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('anota el error si no se pudo programar y lo reintenta en la próxima apertura', async () => {
    jest.mocked(BackgroundTask.registerTaskAsync).mockRejectedValueOnce(new Error('WorkManager no disponible'));
    expect(await activarRespaldo('u1')).toMatchObject({ registrada: false, errorRegistro: 'WorkManager no disponible' });

    expect(await activarRespaldo('u1')).toMatchObject({ registrada: true, errorRegistro: '' });
  });

  it('logout y nuevo ingreso rápidos se aplican en orden', async () => {
    activarRespaldo('u1');
    desactivarRespaldo();
    await activarRespaldo('u2');
    expect(await leerEstadoRespaldo()).toMatchObject({ cuenta: 'u2', activo: true });
  });
});

describe('ejecución headless', () => {
  it('sin estado en memoria: lee cuenta y token guardados, toma punto de partida y luego avisa lo nuevo', async () => {
    publicar(evento('viejo-1', T0 - 60 * MIN), evento('viejo-2', T0 - 30 * MIN));
    await sesion('u1');
    // Estado persistido por una ejecución anterior de la app (otro proceso)
    await AsyncStorage.setItem(CLAVE_ESTADO, JSON.stringify({ cuenta: 'u1', activo: true, registrada: true }));

    let tarea;
    let respaldo;
    jest.isolateModules(() => {
      // Módulos recién cargados: ni React ni notificacionesPush inicializados
      respaldo = require('../../services/respaldoSegundoPlano');
      tarea = require('expo-task-manager').__definidas.get(respaldo.TAREA_RESPALDO);
    });
    const BT = require('expo-background-task');

    expect(await tarea({})).toBe(BT.BackgroundTaskResult.Success);
    expect(avisos()).toHaveLength(0);

    publicar(evento('nuevo', T0 + 5 * MIN));
    reloj = T0 + 20 * MIN;
    expect(await tarea({})).toBe(BT.BackgroundTaskResult.Success);
    expect(idsAvisados()).toEqual(['nuevo']);
    expect(avisos()[0]).toMatchObject({
      title: 'Reclamo',
      body: 'Aviso nuevo',
      data: { id: 'nuevo', tipo: 'reclamo', reclamoId: 'r1', publicacionId: 'p1' },
    });
    expect(servidor.pedidos.every((p) => p.auth === 'Bearer tok-u1')).toBe(true);
  });

  it('nunca marca como leído en el servidor', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1']);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('corre aunque el push esté registrado (y aunque no haya Firebase configurado)', async () => {
    establecerCuentaPush('u1');
    await obtenerYRegistrarTokenPush();
    expect(obtenerEstadoRegistroPush().estado).toBe('registrado');

    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1']);

    // Sin proyecto EAS / FCM no hay token: el respaldo no depende de eso
    reiniciarEstadoPush();
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('No projectId'));
    establecerCuentaPush('u1');
    await obtenerYRegistrarTokenPush();
    expect(obtenerEstadoRegistroPush().estado).toBe('no_disponible');
    publicar(evento('n2', T0 + 21 * MIN));
    reloj = T0 + 40 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1', 'n2']);
  });

  it('solo avisa reclamos, encuentros y devoluciones sin leer', async () => {
    await listoConBase();
    publicar(
      evento('leida', T0 + MIN, { leidaEn: iso(T0 + 2 * MIN) }),
      evento('mensaje', T0 + MIN, { tipo: 'mensaje' }),
      evento('enc', T0 + MIN, { tipo: 'encuentro' }),
      evento('dev', T0 + MIN, { tipo: 'devolucion' }),
    );
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados().sort()).toEqual(['dev', 'enc']);
  });

  it('ejecuciones simultáneas comparten una sola pasada', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    reloj = T0 + 20 * MIN;
    const [a, b] = await Promise.all([ejecutarRespaldo({ ahora }), ejecutarRespaldo({ ahora })]);
    expect(a).toBe(b);
    expect(idsAvisados()).toEqual(['n1']);
  });

  it('guarda la última ejecución y su resultado para Configuración', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(await leerEstadoRespaldo()).toMatchObject({
      ultimoResultado: 'ok', avisosGenerados: 1, ultimaEjecucion: expect.any(String),
    });
  });
});

describe('primer arranque y paginación', () => {
  it('la primera ejecución de una cuenta no repite el historial', async () => {
    publicar(...Array.from({ length: 80 }, (_, i) => evento(`h${i}`, T0 - (i + 1) * MIN)));
    await listoConBase();
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
    // La primera vez solo lee la primera página
    expect(servidor.pedidos.filter((p) => p.page > 1)).toHaveLength(0);
  });

  it('sin eventos previos, lo primero que llega se avisa', async () => {
    await listoConBase();
    publicar(evento('primero', T0 + MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['primero']);
  });

  it('recorre varias páginas hasta el cursor y resume lo que no entra uno por uno', async () => {
    publicar(evento('base', T0 - MIN));
    await listoConBase();
    publicar(...Array.from({ length: 120 }, (_, i) => evento(`n${i}`, T0 + (i + 1) * 1000)));
    reloj = T0 + 30 * MIN;
    await correrTarea();

    expect(servidor.pedidos.filter((p) => p.page === 3)).toHaveLength(1);
    const contenidos = avisos();
    expect(contenidos).toHaveLength(5);
    expect(contenidos.slice(0, 4).map((c) => c.data.id)).toEqual(['n119', 'n118', 'n117', 'n116']);
    expect(contenidos[4]).toMatchObject({ body: 'Tenés 116 novedades más en tus reclamos.', data: { tipo: 'resumen' } });

    // Nada se repite en la siguiente pasada, ni el evento de partida
    jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
    reloj = T0 + 50 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
  });

  it('con más eventos que el tope por pasada, lo dice en el resumen', async () => {
    await listoConBase();
    publicar(...Array.from({ length: 260 }, (_, i) => evento(`n${i}`, T0 + (i + 1) * 1000)));
    reloj = T0 + 60 * MIN;
    await correrTarea();
    expect(servidor.pedidos.filter((p) => p.page === 5)).toHaveLength(0);
    expect(avisos().at(-1).body).toMatch(/y posiblemente otras/);
  });

  it('un evento nuevo que corre la paginación no produce avisos repetidos', async () => {
    await listoConBase();
    publicar(...Array.from({ length: 60 }, (_, i) => evento(`n${i}`, T0 + (i + 1) * 1000)));
    reloj = T0 + 30 * MIN;
    let primera = true;
    jest.mocked(api.get).mockImplementation((url, config) => {
      if (config.params.page === 2 && primera) {
        primera = false;
        publicar(evento('intruso', T0 + 29 * MIN));
      }
      return responderGet(url, config);
    });
    await correrTarea();
    const ids = idsAvisados();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sin duplicados con el push y la consulta en primer plano', () => {
  it('no repite un id que llegó por push (anotado por el oyente o por la tarea de push)', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN), evento('n2', T0 + MIN));
    await anotarPush('u1', 'n1');
    await anotarPushSegundoPlano({ data: { dataString: JSON.stringify({ id: 'n2', tipo: 'reclamo' }) } });
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
  });

  it('no repite lo que está en la bandeja del sistema y lo anota como push', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue([
      { request: { content: { data: { id: 'n1' } }, trigger: { type: 'push' } } },
    ]);
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
    expect(await anotarPush('u1', 'n1')).toBe('push');
  });

  it('no repite un aviso local de la consulta en primer plano, y el push posterior se suprime', async () => {
    await listoConBase();
    publicar(evento('fg', T0 + MIN), evento('bg', T0 + MIN));
    await reservarLocales('u1', ['fg']);
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['bg']);
    // El push de 'bg' que llegue tarde encuentra el aviso local ya presentado
    expect(await anotarPush('u1', 'bg')).toBe('local');
  });

  it('la deduplicación es por cuenta: el mismo id en otra cuenta se avisa', async () => {
    await anotarPush('u2', 'n1');
    await listoConBase('u1');
    publicar(evento('n1', T0 + MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1']);
  });

  it('espera el margen para darle tiempo al push y no pierde el evento diferido', async () => {
    await listoConBase();
    publicar(evento('viejo', T0 + MIN), evento('reciente', T0 + 19 * MIN));
    reloj = T0 + 20 * MIN;
    expect(MARGEN_PUSH_MS).toBe(2 * MIN);
    await correrTarea();
    expect(idsAvisados()).toEqual(['viejo']);

    // Llegó el push del reciente antes de la próxima pasada: no se repite
    await anotarPush('u1', 'reciente');
    publicar(evento('otro', T0 + 21 * MIN));
    reloj = T0 + 40 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['viejo', 'otro']);
  });

  it('el evento diferido sin push se avisa en la pasada siguiente', async () => {
    await listoConBase();
    publicar(evento('reciente', T0 + 19 * MIN));
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
    reloj = T0 + 40 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['reciente']);
  });
});

describe('fallos y recuperación', () => {
  it('un aviso que no se pudo mostrar no queda anotado y se reintenta', async () => {
    await listoConBase();
    publicar(evento('ok', T0 + 2 * MIN), evento('falla', T0 + MIN));
    jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async (pedido) => {
      if (pedido.content.data.id === 'falla') throw new Error('canal');
      return 'local-ok';
    });
    reloj = T0 + 20 * MIN;
    expect(await correrTarea()).toBe(BackgroundTask.BackgroundTaskResult.Failed);

    jest.mocked(Notifications.scheduleNotificationAsync).mockReset().mockResolvedValue('local-2');
    reloj = T0 + 40 * MIN;
    expect(await correrTarea()).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(idsAvisados()).toEqual(['falla']);
  });

  it('un error de red no mueve el cursor: la pasada siguiente recupera lo pendiente', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    servidor.falla = new AxiosError('Network Error', 'ERR_NETWORK');
    reloj = T0 + 20 * MIN;
    expect(await correrTarea()).toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(await leerEstadoRespaldo()).toMatchObject({ activo: true, ultimoResultado: 'error' });

    servidor.falla = null;
    reloj = T0 + 40 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1']);
  });

  it('sin permiso de notificaciones no consume eventos: se avisan al habilitarlo', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' });
    reloj = T0 + 20 * MIN;
    expect((await ejecutarRespaldo({ ahora })).resultado).toBe('omitido');

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
    reloj = T0 + 40 * MIN;
    await correrTarea();
    expect(idsAvisados()).toEqual(['n1']);
  });

  it('un cursor ilegible vuelve a tomar punto de partida sin repetir historial', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    await AsyncStorage.setItem(`${PREFIJO_CURSOR}u1`, '{roto');
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
  });
});

describe('sesión', () => {
  it('un 401 da de baja el respaldo sin avisar ni borrar la sesión guardada', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    servidor.token = 'otro';
    reloj = T0 + 20 * MIN;
    const salida = await ejecutarRespaldo({ ahora });
    expect(salida.resultado).toBe('sesion_invalida');
    expect(avisos()).toHaveLength(0);
    expect(await leerEstadoRespaldo()).toMatchObject({ activo: false, cuenta: null, ultimoResultado: 'sesion_invalida' });
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(TAREA_RESPALDO);
    expect(await SecureStore.getItemAsync(CLAVE_TOKEN)).toBe('tok-u1');
  });

  it('logout durante la consulta: no muestra nada ni avanza el cursor', async () => {
    await listoConBase();
    publicar(evento('n1', T0 + MIN));
    const cursorAntes = await AsyncStorage.getItem(`${PREFIJO_CURSOR}u1`);
    jest.mocked(api.get).mockImplementationOnce(async (url, config) => {
      const respuesta = await responderGet(url, config);
      await SecureStore.deleteItemAsync(CLAVE_TOKEN);
      await desactivarRespaldo();
      return respuesta;
    });
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
    expect(await AsyncStorage.getItem(`${PREFIJO_CURSOR}u1`)).toBe(cursorAntes);
  });

  it('cambio de cuenta durante la consulta: no avisa a la cuenta nueva lo de la anterior', async () => {
    await listoConBase('u1');
    publicar(evento('de-u1', T0 + MIN));
    jest.mocked(api.get).mockImplementationOnce(async (url, config) => {
      const respuesta = await responderGet(url, config);
      await sesion('u2');
      await activarRespaldo('u2');
      return respuesta;
    });
    reloj = T0 + 20 * MIN;
    await correrTarea();
    expect(avisos()).toHaveLength(0);
  });

  it('cambio de cuenta entre avisos: corta y libera lo que no mostró', async () => {
    await listoConBase('u1');
    publicar(evento('a', T0 + 2 * MIN), evento('b', T0 + MIN));
    jest.mocked(Notifications.scheduleNotificationAsync).mockImplementationOnce(async () => {
      await SecureStore.setItemAsync(CLAVE_TOKEN, 'tok-u2');
      return 'local-a';
    });
    reloj = T0 + 20 * MIN;
    const salida = await ejecutarRespaldo({ ahora });
    expect(salida.avisos).toBe(1);
    expect(idsAvisados()).toEqual(['a']);
    // 'b' quedó libre: si u1 vuelve, se puede avisar
    expect(await anotarPush('u1', 'b')).toBeNull();
  });

  it('sin token guardado se da de baja (logout que no llegó a desregistrar)', async () => {
    await activarRespaldo('u1');
    const salida = await ejecutarRespaldo({ ahora });
    expect(salida.resultado).toBe('omitido');
    expect(await leerEstadoRespaldo()).toMatchObject({ activo: false });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('si la sesión guardada es de otra cuenta no consulta ni avisa', async () => {
    await sesion('u2');
    await activarRespaldo('u1');
    const salida = await ejecutarRespaldo({ ahora });
    expect(salida.detalle).toBe('La sesión guardada es de otra cuenta.');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('si no se puede leer el almacén seguro (iOS bloqueado) omite sin darse de baja', async () => {
    await listoConBase();
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('locked'));
    const salida = await ejecutarRespaldo({ ahora });
    expect(salida.resultado).toBe('omitido');
    expect(await leerEstadoRespaldo()).toMatchObject({ activo: true });
  });

  it('inactivo no hace nada', async () => {
    await sesion('u1');
    expect((await correrTarea())).toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('tarea de push en segundo plano', () => {
  it('anota el id del push para la cuenta activa', async () => {
    Platform.OS = 'android';
    await activarRespaldo('u1');
    // El ejecutor recibe { data: NotificationTaskPayload }; en Android data.dataString es el JSON
    await TaskManager.__definidas.get(TAREA_PUSH_SEGUNDO_PLANO)({
      data: { data: { dataString: JSON.stringify({ id: 'p9', tipo: 'encuentro' }) }, notification: null },
      executionInfo: {},
    });
    expect(await anotarPush('u1', 'p9')).toBe('push');
  });

  it('ignora el toque de acciones y payloads sin id o sin cuenta activa', async () => {
    await anotarPushSegundoPlano({ data: { dataString: JSON.stringify({ id: 'x' }) } });
    expect(await anotarPush('u1', 'x')).toBeNull();
    await activarRespaldo('u1');
    await anotarPushSegundoPlano({ actionIdentifier: 'default', notification: {} });
    await anotarPushSegundoPlano({ data: { dataString: 'no-json' } });
    await anotarPushSegundoPlano(null);
    expect(await anotarPush('u1', 'y')).toBeNull();
  });
});

describe('registroAvisos para el respaldo', () => {
  it('reservarNuevos no toma punto de partida y no devuelve repetidos', async () => {
    const { reservarNuevos, marcarBase } = require('../../services/registroAvisos');
    expect(await reservarNuevos('u9', ['a', 'a', 'b'])).toEqual(['a', 'b']);
    expect(await reservarNuevos('u9', ['a', 'c'])).toEqual(['c']);
    await marcarBase('u9', ['h1']);
    expect(await reservarNuevos('u9', ['h1'])).toEqual([]);
    // Un push de un id histórico se sigue mostrando (no es 'local')
    expect(await anotarPush('u9', 'h1')).toBe('base');
  });

  it('marcarBase hace que la consulta en primer plano no tome los históricos como nuevos', async () => {
    const { marcarBase } = require('../../services/registroAvisos');
    await marcarBase('u9', ['h1', 'h2']);
    expect(await reservarLocales('u9', ['h1', 'h2', 'n1'])).toEqual(['n1']);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { api } from './api';
import { leerPerfilMinimo, leerToken } from './sesion';
import { anotarPush, liberarLocal, marcarBase, reservarNuevos } from './registroAvisos';
import {
  TIPOS_AVISO,
  datosDeAviso,
  emitirNotificacionNativa,
  idDeNotificacionPush,
  idsEnBandeja,
  tituloDeAviso,
} from './notificacionesPush';

/**
 * Respaldo en segundo plano de los avisos de reclamos, encuentros y devoluciones.
 *
 * El push del backend puede no llegar aunque el token figure registrado (FCM sin credenciales,
 * token vencido, el outbox que falla). Esta tarea consulta GET /notificaciones de forma periódica
 * con la app minimizada o cerrada por el sistema y genera avisos LOCALES de lo que nadie mostró.
 *
 * - Planificación: expo-background-task (WorkManager en Android, BGTaskScheduler en iOS). El
 *   intervalo es un mínimo de 15 minutos y el sistema decide cuándo corre (red disponible,
 *   batería, Doze, fabricante). No corre con la app en primer plano (ahí está la consulta de
 *   useNovedades) ni después de «Forzar detención» hasta que se vuelva a abrir la app.
 * - Sin React ni estado en memoria: corre en un arranque headless del bundle. La cuenta y el
 *   token se leen de SecureStore (services/sesion) y la cuenta activa del respaldo de
 *   AsyncStorage (sin secretos). Antes de mostrar cada aviso revalida que la sesión siga siendo
 *   la misma: logout, cambio de cuenta o un 401 cortan la ejecución sin avisar.
 * - Sin duplicados: comparte `registroAvisos` (por cuenta) con el push y la consulta en primer
 *   plano, y además mira la bandeja del sistema. Los eventos más nuevos que MARGEN_PUSH_MS se
 *   dejan para la próxima ejecución, para darle tiempo al push de llegar primero.
 * - Cursor: por cuenta se guarda la marca temporal (`creadaEn`) hasta donde se revisó. Cada
 *   ejecución recorre páginas hasta alcanzarla (con tope), así no se pierden eventos por
 *   quedar fuera de la primera página. La primera ejecución de una cuenta solo toma punto de
 *   partida: no muestra el historial.
 * - Mostrar no es leer: nunca marca nada como leído en el servidor.
 */

export const TAREA_RESPALDO = 'hallado-respaldo-avisos';
export const TAREA_PUSH_SEGUNDO_PLANO = 'hallado-push-segundo-plano';
export const INTERVALO_MINUTOS = 15;
export const MARGEN_PUSH_MS = 2 * 60 * 1000;
export const TAMANO_PAGINA = 50;
export const MAXIMO_PAGINAS = 4;
export const MAXIMO_INDIVIDUALES = 4;
const TIMEOUT_MS = 15000;

export const CLAVE_ESTADO = 'hallado_respaldo_estado';
export const PREFIJO_CURSOR = 'hallado_respaldo_cursor:';

const ESTADO_INICIAL = {
  cuenta: null,
  activo: false,
  registrada: false,
  disponible: null,
  errorRegistro: '',
  ultimaEjecucion: null,
  ultimoResultado: null,
  ultimoDetalle: '',
  avisosGenerados: 0,
};

// ---------------------------------------------------------------------------------------------
// Estado persistente (sin datos sensibles: id de cuenta, marcas de tiempo y resultados)

export async function leerEstadoRespaldo() {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_ESTADO);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (datos && typeof datos === 'object') return { ...ESTADO_INICIAL, ...datos };
  } catch {
    // Ilegible: se considera inactivo
  }
  return { ...ESTADO_INICIAL };
}

async function guardarEstado(estado) {
  try {
    await AsyncStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento el respaldo queda como estaba
  }
}

/** Actualiza el resultado de la última ejecución solo si sigue siendo la misma cuenta. */
async function anotarResultado(cuenta, cambios) {
  const estado = await leerEstadoRespaldo();
  if (estado.cuenta !== cuenta) return;
  await guardarEstado({ ...estado, ...cambios });
}

async function leerCursor(cuenta) {
  try {
    const crudo = await AsyncStorage.getItem(PREFIJO_CURSOR + cuenta);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (datos && typeof datos === 'object' && datos.base === true) {
      return {
        base: true,
        marca: typeof datos.marca === 'string' ? datos.marca : null,
        ids: Array.isArray(datos.ids) ? datos.ids.map(String) : [],
      };
    }
  } catch {
    // Ilegible: se vuelve a tomar punto de partida (no muestra historial)
  }
  return null;
}

async function guardarCursor(cuenta, cursor) {
  await AsyncStorage.setItem(PREFIJO_CURSOR + cuenta, JSON.stringify(cursor));
}

// ---------------------------------------------------------------------------------------------
// Ejecución

function tiempo(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function esSesionInvalida(error) {
  return error?.response?.status === 401;
}

async function obtenerPagina(token, pagina) {
  const { data } = await api.get('/notificaciones', {
    params: { page: pagina, pageSize: TAMANO_PAGINA },
    headers: { Authorization: `Bearer ${token}` },
    timeout: TIMEOUT_MS,
  });
  return data;
}

/**
 * Recorre GET /notificaciones de la más nueva a la más vieja hasta alcanzar la marca del cursor
 * (o el final). Sin cursor solo lee la primera página (punto de partida). Devuelve los items y si quedó
 * truncado por el tope de páginas.
 */
async function recorrer(token, cursor) {
  const marca = cursor?.marca ? tiempo(cursor.marca) : null;
  const items = [];
  const vistos = new Set();
  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina += 1) {
    const datos = await obtenerPagina(token, pagina);
    const lista = Array.isArray(datos?.items) ? datos.items : [];
    let alcanzada = false;
    for (const n of lista) {
      if (!n || n.id === undefined || n.id === null) continue;
      const t = tiempo(n.creadaEn);
      if (marca !== null && t !== null && t < marca) {
        alcanzada = true;
        break;
      }
      // La paginación es por desplazamiento: un evento nuevo corre la lista y repite items
      const id = String(n.id);
      if (vistos.has(id)) continue;
      vistos.add(id);
      items.push(n);
    }
    const ultima = lista.length < TAMANO_PAGINA
      || (Number.isFinite(datos?.totalPages) && pagina >= datos.totalPages);
    // Sin cursor (primera vez) alcanza la primera página: todo es historial y solo se anota.
    // Con cursor sin marca (no había eventos al tomar el punto de partida) todo es nuevo
    if (alcanzada || ultima || !cursor) {
      return { items, truncado: false };
    }
  }
  return { items, truncado: true };
}

async function permisoConcedido() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function nuevaMarca(items, marcaPrevia) {
  let mayor = marcaPrevia ? tiempo(marcaPrevia) : null;
  let iso = marcaPrevia;
  for (const n of items) {
    const t = tiempo(n.creadaEn);
    if (t !== null && (mayor === null || t > mayor)) {
      mayor = t;
      iso = n.creadaEn;
    }
  }
  if (!iso) return { marca: null, ids: [] };
  const ids = items.filter((n) => tiempo(n.creadaEn) === mayor).map((n) => String(n.id));
  return { marca: iso, ids };
}

let ejecucionEnCurso = null;

/**
 * Una pasada del respaldo. Pensada para el arranque headless de la tarea, pero se puede llamar
 * desde la app (prueba manual en desarrollo). Ejecuciones simultáneas comparten la misma.
 * Devuelve `{ resultado, avisos, detalle }` con resultado: ok | omitido | error | sesion_invalida.
 */
export function ejecutarRespaldo({ ahora = Date.now } = {}) {
  if (ejecucionEnCurso) return ejecucionEnCurso;
  const promesa = ejecutar(ahora)
    .catch((error) => ({ resultado: 'error', avisos: 0, detalle: error?.message || 'Error inesperado.' }))
    .finally(() => {
      if (ejecucionEnCurso === promesa) ejecucionEnCurso = null;
    });
  ejecucionEnCurso = promesa;
  return promesa;
}

async function ejecutar(ahora) {
  const estado = await leerEstadoRespaldo();
  if (!estado.activo || !estado.cuenta) {
    return { resultado: 'omitido', avisos: 0, detalle: 'Respaldo inactivo (sin sesión).' };
  }
  const cuenta = estado.cuenta;
  const terminar = async (salida) => {
    await anotarResultado(cuenta, {
      ultimaEjecucion: new Date(ahora()).toISOString(),
      ultimoResultado: salida.resultado,
      ultimoDetalle: salida.detalle ?? '',
      avisosGenerados: salida.avisos ?? 0,
    });
    return salida;
  };

  let token;
  let perfil;
  try {
    token = await leerToken();
    perfil = await leerPerfilMinimo();
  } catch {
    // iOS: el llavero puede no estar accesible con el equipo bloqueado. Se reintenta la próxima vez
    return terminar({ resultado: 'omitido', avisos: 0, detalle: 'No se pudo leer la sesión guardada.' });
  }
  if (!token) {
    // La sesión se cerró sin que el respaldo se diera de baja (p. ej. proceso cortado en el logout)
    await desactivarRespaldo();
    return { resultado: 'omitido', avisos: 0, detalle: 'Sin sesión guardada.' };
  }
  if (!perfil || String(perfil.id) !== cuenta) {
    return terminar({ resultado: 'omitido', avisos: 0, detalle: 'La sesión guardada es de otra cuenta.' });
  }

  // La sesión que inició esta pasada tiene que seguir vigente para mostrar cada aviso
  const vigente = async () => {
    try {
      const [actual, estadoActual] = await Promise.all([leerToken(), leerEstadoRespaldo()]);
      return actual === token && estadoActual.activo && estadoActual.cuenta === cuenta;
    } catch {
      return false;
    }
  };

  if (!(await permisoConcedido())) {
    return terminar({ resultado: 'omitido', avisos: 0, detalle: 'Notificaciones desactivadas en el sistema.' });
  }

  const cursor = await leerCursor(cuenta);
  let recorrido;
  try {
    recorrido = await recorrer(token, cursor);
  } catch (error) {
    if (esSesionInvalida(error)) {
      // No se borra la sesión desde acá: la app lo hace al abrirse (GET /me). Solo se deja de
      // consultar para no seguir usando un token inválido
      if (await vigente()) await desactivarRespaldo({ motivo: 'sesion_invalida' });
      return { resultado: 'sesion_invalida', avisos: 0, detalle: 'La sesión ya no es válida.' };
    }
    return terminar({
      resultado: 'error',
      avisos: 0,
      detalle: error?.response?.status
        ? `El servidor respondió HTTP ${error.response.status}.`
        : 'No se pudo consultar el servidor.',
    });
  }

  if (!(await vigente())) {
    return { resultado: 'omitido', avisos: 0, detalle: 'La sesión cambió durante la consulta.' };
  }

  const { items, truncado } = recorrido;

  if (!cursor) {
    // Primera vez de esta cuenta: lo que hay es historial. Se anota sin mostrar nada
    await marcarBase(cuenta, items.map((n) => String(n.id)));
    const { marca, ids } = nuevaMarca(items, null);
    await guardarCursor(cuenta, { base: true, marca, ids });
    return terminar({ resultado: 'ok', avisos: 0, detalle: 'Punto de partida tomado.' });
  }

  const marcaPrevia = cursor.marca ? tiempo(cursor.marca) : null;
  const yaVistosEnMarca = new Set(cursor.ids);
  const limite = ahora() - MARGEN_PUSH_MS;
  const candidatas = [];
  const diferidas = [];
  for (const n of items) {
    const id = String(n.id);
    const t = tiempo(n.creadaEn);
    if (marcaPrevia !== null && t === marcaPrevia && yaVistosEnMarca.has(id)) continue;
    if (n.leidaEn || !TIPOS_AVISO.has(n.tipo)) continue;
    // Muy reciente: el push puede estar en camino. Queda para la próxima pasada
    if (t !== null && t > limite) diferidas.push(n);
    else candidatas.push(n);
  }

  // Lo que ya está en la bandeja llegó por push (o por un aviso previo): se anota y no se repite
  const enBandeja = await idsEnBandeja();
  for (const n of candidatas) {
    if (enBandeja.has(String(n.id))) await anotarPush(cuenta, String(n.id));
  }

  const reservados = new Set((await reservarNuevos(cuenta, candidatas.map((n) => String(n.id)))) || []);
  const aMostrar = candidatas
    .filter((n) => reservados.has(String(n.id)))
    .sort((a, b) => (tiempo(b.creadaEn) ?? 0) - (tiempo(a.creadaEn) ?? 0));
  const individuales = aMostrar.slice(0, MAXIMO_INDIVIDUALES);
  const resto = aMostrar.slice(MAXIMO_INDIVIDUALES);
  const fallidas = [];
  let avisos = 0;
  let interrumpida = false;

  const liberar = async (lista) => {
    for (const n of lista) await liberarLocal(cuenta, String(n.id));
  };

  for (let i = 0; i < individuales.length; i += 1) {
    const n = individuales[i];
    if (!(await vigente())) {
      await liberar(individuales.slice(i).concat(resto));
      interrumpida = true;
      break;
    }
    const emitido = await emitirNotificacionNativa({
      titulo: tituloDeAviso(n.tipo),
      mensaje: n.mensaje,
      datos: datosDeAviso(n),
    });
    if (emitido) avisos += 1;
    else {
      await liberarLocal(cuenta, String(n.id));
      fallidas.push(n);
    }
  }

  if (!interrumpida && (resto.length > 0 || (truncado && aMostrar.length > 0))) {
    // Más eventos de los que conviene mostrar uno por uno: un solo aviso que lleva a la bandeja
    let emitido = null;
    if (await vigente()) {
      const cantidad = resto.length;
      emitido = await emitirNotificacionNativa({
        titulo: 'Hallado',
        mensaje: cantidad > 0
          ? `Tenés ${cantidad} novedad${cantidad === 1 ? '' : 'es'} más en tus reclamos${truncado ? ' y posiblemente otras' : ''}.`
          : 'Tenés más novedades en tus reclamos.',
        datos: { id: `resumen-${ahora()}`, tipo: 'resumen' },
      });
    } else {
      interrumpida = true;
    }
    if (emitido) avisos += 1;
    else {
      await liberar(resto);
      fallidas.push(...resto);
    }
  }

  if (interrumpida) {
    return { resultado: 'omitido', avisos, detalle: 'La sesión cambió durante la ejecución.' };
  }

  // El cursor avanza hasta lo revisado, salvo lo que falló o quedó diferido: desde ahí se vuelve
  // a mirar en la próxima pasada (lo ya mostrado está en registroAvisos y no se repite)
  const pendientes = fallidas.concat(diferidas)
    .map((n) => tiempo(n.creadaEn))
    .filter((t) => t !== null);
  let siguiente;
  if (pendientes.length > 0) {
    const menor = Math.min(...pendientes);
    siguiente = { base: true, marca: new Date(menor).toISOString(), ids: [] };
  } else {
    siguiente = { base: true, ...nuevaMarca(items, cursor.marca) };
  }
  if (await vigente()) await guardarCursor(cuenta, siguiente);

  const detalle = [
    `${avisos} aviso${avisos === 1 ? '' : 's'} generado${avisos === 1 ? '' : 's'}`,
    fallidas.length ? `${fallidas.length} sin poder mostrar (se reintenta)` : '',
    diferidas.length ? `${diferidas.length} muy reciente${diferidas.length === 1 ? '' : 's'} (próxima pasada)` : '',
    truncado ? 'más eventos que el tope por pasada' : '',
  ].filter(Boolean).join(', ');
  return terminar({ resultado: fallidas.length ? 'error' : 'ok', avisos, detalle: `${detalle}.` });
}

// ---------------------------------------------------------------------------------------------
// Tareas: se definen al cargar el módulo (lo importa index.js), como pide expo-task-manager

/** Push recibido con la app en segundo plano: se anota para que el respaldo no lo repita. */
export async function anotarPushSegundoPlano(payload) {
  if (!payload || typeof payload !== 'object' || 'actionIdentifier' in payload) return;
  const id = idDeNotificacionPush(payload);
  if (!id) return;
  const estado = await leerEstadoRespaldo();
  if (!estado.activo || !estado.cuenta) return;
  await anotarPush(estado.cuenta, id);
}

try {
  if (!TaskManager.isTaskDefined(TAREA_RESPALDO)) {
    TaskManager.defineTask(TAREA_RESPALDO, async () => {
      const { resultado } = await ejecutarRespaldo();
      return resultado === 'error'
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    });
  }
  if (!TaskManager.isTaskDefined(TAREA_PUSH_SEGUNDO_PLANO)) {
    TaskManager.defineTask(TAREA_PUSH_SEGUNDO_PLANO, async ({ data }) => {
      try {
        await anotarPushSegundoPlano(data);
      } catch {
        // Solo deduplicación: si falla, el respaldo mira la bandeja
      }
    });
  }
} catch {
  // Entornos sin el módulo nativo (web, Expo Go en Android)
}

// ---------------------------------------------------------------------------------------------
// Alta y baja (desde la app, al ingresar y al salir)

let cola = Promise.resolve();
function encolar(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

async function tareaRegistrada(nombre) {
  try {
    return await TaskManager.isTaskRegisteredAsync(nombre);
  } catch {
    return false;
  }
}

/**
 * Activa el respaldo para la cuenta. Re-registrar reinicia la espera del WorkManager, así que
 * solo se registra si no estaba.
 */
export function activarRespaldo(cuenta) {
  const id = cuenta === null || cuenta === undefined ? null : String(cuenta);
  if (!id) return desactivarRespaldo();
  return encolar(async () => {
    const previo = await leerEstadoRespaldo();
    const misma = previo.cuenta === id;
    const estado = {
      ...ESTADO_INICIAL,
      ...(misma ? {
        ultimaEjecucion: previo.ultimaEjecucion,
        ultimoResultado: previo.ultimoResultado,
        ultimoDetalle: previo.ultimoDetalle,
        avisosGenerados: previo.avisosGenerados,
      } : {}),
      cuenta: id,
      activo: true,
    };
    await guardarEstado(estado);

    let disponible = false;
    try {
      disponible = (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
    } catch {
      disponible = false;
    }
    if (!disponible) {
      await anotarResultado(id, { disponible: false, registrada: false, errorRegistro: 'El sistema no permite tareas en segundo plano para esta app.' });
      return leerEstadoRespaldo();
    }

    let errorRegistro = '';
    try {
      if (!(await tareaRegistrada(TAREA_RESPALDO))) {
        await BackgroundTask.registerTaskAsync(TAREA_RESPALDO, { minimumInterval: INTERVALO_MINUTOS });
      }
    } catch (error) {
      errorRegistro = error?.message || 'No se pudo programar la tarea.';
    }
    // Solo Android: en iOS esta tarea requiere el modo remote-notification y push silencioso
    if (Platform.OS === 'android') {
      try {
        if (!(await tareaRegistrada(TAREA_PUSH_SEGUNDO_PLANO))) {
          await Notifications.registerTaskAsync(TAREA_PUSH_SEGUNDO_PLANO);
        }
      } catch {
        // Opcional: sin ella el respaldo igual mira la bandeja
      }
    }
    const registrada = !errorRegistro && (await tareaRegistrada(TAREA_RESPALDO));
    await anotarResultado(id, {
      disponible: true,
      registrada,
      errorRegistro: errorRegistro || (registrada ? '' : 'La tarea no quedó registrada.'),
    });
    return leerEstadoRespaldo();
  });
}

/** Da de baja el respaldo (logout, sesión inválida). Lo que esté en curso deja de mostrar avisos. */
export function desactivarRespaldo({ motivo = '' } = {}) {
  return encolar(async () => {
    await guardarEstado({
      ...ESTADO_INICIAL,
      ultimoResultado: motivo || null,
    });
    try {
      if (await tareaRegistrada(TAREA_RESPALDO)) await BackgroundTask.unregisterTaskAsync(TAREA_RESPALDO);
    } catch {
      // El estado inactivo ya impide que la tarea haga algo si llegara a correr
    }
    try {
      if (await tareaRegistrada(TAREA_PUSH_SEGUNDO_PLANO)) {
        await Notifications.unregisterTaskAsync(TAREA_PUSH_SEGUNDO_PLANO);
      }
    } catch {
      // Sin acción
    }
  });
}

/** Solo desarrollo: corre la misma pasada desde la app. No valida la planificación del sistema. */
export async function probarRespaldoAhora() {
  if (!__DEV__) throw new Error('Solo disponible en desarrollo.');
  return ejecutarRespaldo();
}

/** Solo para pruebas. */
export function reiniciarRespaldo() {
  ejecucionEnCurso = null;
  cola = Promise.resolve();
}

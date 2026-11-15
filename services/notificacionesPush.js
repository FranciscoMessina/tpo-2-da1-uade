import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isAxiosError } from 'axios';
import { api } from './api';
import { anotarPush, liberarLocal, reservarLocales } from './registroAvisos';

/**
 * Avisos del sistema (punto 12). Cómo funciona:
 * - Fuente principal: el push de Expo que envía el backend para las notificaciones de tipo
 *   `reclamo`, `encuentro` y `devolucion`. El token se registra con POST /me/push-token y queda
 *   atado a la sesión (logout lo desvincula en el servidor).
 * - Respaldo en primer plano: solo si el registro falló de forma definitiva o el servidor no lo
 *   confirmó, la consulta periódica (useNovedades, cada 20 s con la app abierta) genera un aviso local.
 * - Respaldo en segundo plano (services/respaldoSegundoPlano): con la app minimizada o cerrada por
 *   el sistema, una tarea periódica (mínimo 15 min, cuando el sistema decida) consulta el servidor
 *   aunque el push figure registrado, por si la entrega falló después del registro.
 * - Sin duplicados: cada aviso se identifica por el `id` de GET /notificaciones (en el push viene
 *   como `data.id`) y se anota por cuenta en `registroAvisos`, que comparten las tres vías.
 */

export const CANAL_NOTIFICACIONES_ID = 'hallado-notificaciones';
export const TIPOS_AVISO = new Set(['reclamo', 'encuentro', 'devolucion']);
const TITULOS = { reclamo: 'Reclamo', encuentro: 'Punto de encuentro', devolucion: 'Devolución' };

// Estados del registro en los que el servidor no tiene el token de esta sesión: solo ahí
// corresponde el aviso local de respaldo
const ESTADOS_SIN_PUSH = new Set(['sin_permiso', 'no_disponible', 'error_servidor', 'rechazado']);
// Estados que pueden resolverse solos (red que vuelve, servidor que se recupera, permiso concedido)
export const ESTADOS_REINTENTABLES = new Set(['sin_permiso', 'no_disponible', 'error_servidor']);

let cuentaActual = null;
let notificacionPendiente = null;
let refNavegacionActual = null;
const oyentesNovedad = new Set();
const oyentesRegistro = new Set();
const REGISTRO_INICIAL = { cuenta: null, estado: 'inactivo', token: null, error: '' };
let registro = REGISTRO_INICIAL;
let registroEnCurso = null;
let generacion = 0;

// ---------------------------------------------------------------------------------------------
// Cuenta activa

/**
 * Fija la cuenta que recibe los avisos. Al cerrar sesión o cambiar de cuenta se descarta lo que era
 * de la anterior: navegación pendiente, estado del registro y avisos que siguen en la bandeja.
 */
export function establecerCuentaPush(cuenta) {
  const nueva = cuenta ?? null;
  const anterior = cuentaActual;
  if (anterior === nueva) return;
  cuentaActual = nueva;
  generacion += 1;
  registroEnCurso = null;
  actualizarRegistro({ ...REGISTRO_INICIAL, cuenta: nueva });
  if (anterior !== null) {
    notificacionPendiente = null;
    Promise.resolve()
      .then(() => Notifications.dismissAllNotificationsAsync?.())
      .catch(() => {});
  }
}

export function obtenerCuentaPush() {
  return cuentaActual;
}

// ---------------------------------------------------------------------------------------------
// Presentación en primer plano

/**
 * Decide si se muestra una notificación que llega con la app abierta. Un push cuyo `id` ya se
 * mostró como aviso local (la consulta periódica se adelantó) no se repite, y sin sesión no se
 * muestra nada.
 */
export async function debeMostrarse(notificacion) {
  const request = notificacion?.request;
  if (request?.trigger?.type !== 'push') return true;
  if (!cuentaActual) return false;
  const datos = request?.content?.data ?? {};
  const id = datos.id ?? datos.notificationId;
  if (!id) return true;
  const previo = await anotarPush(cuentaActual, String(id));
  return previo !== 'local';
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async (notificacion) => {
      let mostrar = true;
      try {
        mostrar = await debeMostrarse(notificacion);
      } catch {
        mostrar = true;
      }
      return {
        shouldPlaySound: mostrar,
        shouldSetBadge: mostrar,
        shouldShowBanner: mostrar,
        shouldShowList: mostrar,
      };
    },
  });
} catch {
  // En entornos sin soporte se ignora
}

/** Avisa cuando llega un push con la app en ejecución, para refrescar contadores. */
export function suscribirNovedadesPush(oyente) {
  oyentesNovedad.add(oyente);
  return () => oyentesNovedad.delete(oyente);
}

/** Atiende un push recibido con la app en ejecución (primer o segundo plano). */
export async function procesarNotificacionRecibida(notificacion) {
  const request = notificacion?.request;
  if (request?.trigger?.type !== 'push' || !cuentaActual) return;
  const datos = request?.content?.data ?? {};
  const id = datos.id ?? datos.notificationId;
  if (id) await anotarPush(cuentaActual, String(id));
  oyentesNovedad.forEach((oyente) => {
    try { oyente(datos); } catch { /* un oyente no frena a los demás */ }
  });
}

// ---------------------------------------------------------------------------------------------
// Permisos, canal y registro del token

export async function configurarCanalNotificaciones() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL_NOTIFICACIONES_ID, {
      name: 'Avisos y reclamos de Hallado',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });
  } catch {
    // Ignorar si el entorno nativo no lo soporta
  }
}

/** Consulta el permiso y, si `pedir`, lo solicita. */
export async function solicitarPermisoNotificaciones({ pedir = true } = {}) {
  try {
    const { status: existente } = await Notifications.getPermissionsAsync();
    if (existente === 'granted' || !pedir) return existente === 'granted';
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function actualizarRegistro(nuevo) {
  registro = nuevo;
  oyentesRegistro.forEach((oyente) => {
    try { oyente(registro); } catch { /* sin acción */ }
  });
}

export function obtenerEstadoRegistroPush() {
  return registro;
}

export function suscribirEstadoRegistroPush(oyente) {
  oyentesRegistro.add(oyente);
  return () => oyentesRegistro.delete(oyente);
}

/** true si la consulta periódica debe generar avisos locales para esta cuenta. */
export function avisosLocalesActivos(cuenta = cuentaActual) {
  return !!cuenta && cuenta === cuentaActual && ESTADOS_SIN_PUSH.has(registro.estado);
}

function clasificarErrorServidor(error) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return { estado: 'rechazado', error: `El servidor rechazó el token (HTTP ${status}).` };
  }
  return {
    estado: 'error_servidor',
    error: 'No se pudo confirmar el registro con el servidor. Se reintentará.',
  };
}

async function registrar(cuenta, gen, { pedirPermiso }) {
  const vigente = () => gen === generacion && cuenta === cuentaActual;
  const terminar = (cambios) => {
    if (vigente()) actualizarRegistro({ ...registro, cuenta, ...cambios });
    return vigente() ? registro : { ...REGISTRO_INICIAL, cuenta, ...cambios };
  };

  actualizarRegistro({ ...registro, cuenta, estado: 'registrando', error: '' });

  const permitido = await solicitarPermisoNotificaciones({ pedir: pedirPermiso });
  if (!vigente()) return terminar({});
  if (!permitido) {
    return terminar({ estado: 'sin_permiso', token: null, error: 'Las notificaciones están desactivadas para Hallado.' });
  }

  await configurarCanalNotificaciones();

  let token = null;
  try {
    const respuesta = await Notifications.getExpoPushTokenAsync();
    token = respuesta?.data ?? null;
  } catch (error) {
    // Sin projectId de EAS, sin credenciales FCM o en Expo Go (Android) no hay token remoto
    return terminar({
      estado: 'no_disponible',
      token: null,
      error: `Este dispositivo no pudo obtener un token push${error?.message ? `: ${error.message}` : '.'}`,
    });
  }
  if (!vigente()) return terminar({});
  if (!token) {
    return terminar({ estado: 'no_disponible', token: null, error: 'Expo no devolvió un token push.' });
  }

  try {
    await api.post('/me/push-token', { token });
  } catch (error) {
    return terminar({ token, ...clasificarErrorServidor(error) });
  }
  return terminar({ estado: 'registrado', token, error: '' });
}

/**
 * Obtiene el token de Expo y lo registra para la sesión actual. Devuelve el estado final:
 * `registrado` solo cuando el servidor confirmó; cualquier falla queda en el estado y nunca
 * interrumpe el ingreso. Llamadas simultáneas comparten el mismo intento.
 */
export function obtenerYRegistrarTokenPush({ pedirPermiso = true } = {}) {
  const cuenta = cuentaActual;
  if (!cuenta) return Promise.resolve({ ...REGISTRO_INICIAL });
  if (registroEnCurso && registroEnCurso.cuenta === cuenta && registroEnCurso.gen === generacion) {
    return registroEnCurso.promesa;
  }
  const gen = generacion;
  const promesa = registrar(cuenta, gen, { pedirPermiso })
    .catch(() => terminarConError(cuenta, gen))
    .finally(() => {
      if (registroEnCurso?.promesa === promesa) registroEnCurso = null;
    });
  registroEnCurso = { cuenta, gen, promesa };
  return promesa;
}

function terminarConError(cuenta, gen) {
  if (gen === generacion && cuenta === cuentaActual) {
    actualizarRegistro({ ...registro, cuenta, estado: 'error_servidor', error: 'No se pudo registrar el dispositivo.' });
  }
  return registro;
}

// ---------------------------------------------------------------------------------------------
// Avisos locales de respaldo

export function esEventoPushRelevante(notificacion) {
  if (!notificacion || typeof notificacion !== 'object') return false;
  return TIPOS_AVISO.has(notificacion.tipo);
}

export function tituloDeAviso(tipo) {
  return TITULOS[tipo] ?? 'Hallado';
}

/** Datos del aviso local: los mismos campos que trae el push, para navegar igual al tocarlo. */
export function datosDeAviso(notif) {
  const id = String(notif.id);
  const claimId = notif.claimId || notif.reclamoId;
  const publicationId = notif.publicationId || notif.publicacionId;
  return {
    id,
    notificationId: id,
    tipo: notif.tipo,
    ...(claimId ? { claimId, reclamoId: claimId } : {}),
    ...(publicationId ? { publicationId, publicacionId: publicationId } : {}),
  };
}

function idDeDatos(datos) {
  if (!datos || typeof datos !== 'object') return null;
  const id = datos.id ?? datos.notificationId;
  return id === undefined || id === null || id === '' ? null : String(id);
}

/**
 * Id de la notificación del servidor dentro del payload que recibe la tarea de push en segundo
 * plano. En Android `data.dataString` es el JSON de `data` del mensaje de Expo.
 */
export function idDeNotificacionPush(payload) {
  const datos = payload?.data;
  for (const texto of [datos?.dataString, datos?.body]) {
    if (typeof texto !== 'string') continue;
    try {
      const id = idDeDatos(JSON.parse(texto));
      if (id) return id;
    } catch {
      // No era JSON
    }
  }
  return idDeDatos(datos) ?? idDeDatos(payload?.notification?.data);
}

/**
 * Muestra un aviso local inmediato. Devuelve el identificador o null si no se pudo mostrar.
 */
export async function emitirNotificacionNativa({ titulo = 'Hallado', mensaje = '', datos = {} }) {
  try {
    await configurarCanalNotificaciones();
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: mensaje, data: datos, sound: 'default' },
      trigger: Platform.OS === 'android' ? { channelId: CANAL_NOTIFICACIONES_ID } : null,
    });
    return id || null;
  } catch {
    return null;
  }
}

/** Ids (de GET /notificaciones) de los avisos que siguen en la bandeja del sistema. */
export async function idsEnBandeja() {
  try {
    const presentes = await Notifications.getPresentedNotificationsAsync?.();
    return new Set((presentes ?? [])
      .map((n) => n?.request?.content?.data?.id)
      .filter(Boolean)
      .map(String));
  } catch {
    return new Set();
  }
}

/**
 * Respaldo de la consulta periódica: genera avisos locales para las notificaciones relevantes sin
 * leer que nadie mostró todavía. No hace nada si el push de esta sesión está registrado, si la
 * cuenta cambió o si la notificación ya está en la bandeja del sistema (llegó por push).
 */
export async function sincronizarAvisosNativos(notificaciones = [], cuenta = cuentaActual) {
  if (!Array.isArray(notificaciones) || notificaciones.length === 0) return;
  if (!avisosLocalesActivos(cuenta)) return;

  const candidatas = notificaciones.filter(
    (n) => n && n.id && !n.leidaEn && esEventoPushRelevante(n)
  );
  if (candidatas.length === 0) return;

  const enBandeja = await idsEnBandeja();
  for (const n of candidatas) {
    if (enBandeja.has(String(n.id))) await anotarPush(cuenta, String(n.id));
  }

  const reservados = new Set((await reservarLocales(cuenta, candidatas.map((n) => String(n.id)))) || []);
  for (const notif of candidatas) {
    const id = String(notif.id);
    if (!reservados.has(id)) continue;
    // Si la cuenta cambió o el push quedó registrado mientras tanto, lo reservado no se muestra
    if (!avisosLocalesActivos(cuenta)) {
      await liberarLocal(cuenta, id);
      continue;
    }
    const emitido = await emitirNotificacionNativa({
      titulo: tituloDeAviso(notif.tipo),
      mensaje: notif.mensaje,
      datos: datosDeAviso(notif),
    });
    if (!emitido) await liberarLocal(cuenta, id);
  }
}

/**
 * Solo desarrollo: programa un aviso LOCAL en este dispositivo. No pasa por el backend ni por
 * Expo, así que no valida la entrega remota; sirve para probar el canal y la navegación al tocar.
 */
export async function simularNotificacionLocal({
  segundos = 5,
  titulo = 'Aviso local de prueba',
  mensaje = 'Notificación generada en el dispositivo (no es un push remoto).',
  datos = { tipo: 'prueba_local' },
} = {}) {
  await solicitarPermisoNotificaciones();
  await configurarCanalNotificaciones();
  return Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: mensaje, data: datos, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, segundos),
      repeats: false,
      channelId: CANAL_NOTIFICACIONES_ID,
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Navegación al tocar

export function setRefNavegacion(ref) {
  refNavegacionActual = ref;
}

export function obtenerRefNavegacion() {
  return refNavegacionActual;
}

export function obtenerNotificacionPendiente() {
  return notificacionPendiente;
}

export function limpiarNotificacionPendiente() {
  notificacionPendiente = null;
}

/** Comprueba si el navegador tiene la ruta destino (p. ej. 'Principal' en sesión autenticada). */
export function puedeNavegar(navigation = refNavegacionActual, ruta = 'Principal') {
  const nav = navigation || refNavegacionActual;
  if (!nav || (typeof nav.isReady === 'function' && !nav.isReady())) return false;
  const state = typeof nav.getRootState === 'function' ? nav.getRootState() : null;
  if (state && Array.isArray(state.routeNames)) return state.routeNames.includes(ruta);
  return true;
}

/** Navega según los datos de la notificación tocada. */
export function navegarADestino(navigation = refNavegacionActual, datos = {}) {
  const nav = navigation || refNavegacionActual;
  if (!nav) return;

  if (!puedeNavegar(nav, 'Principal')) {
    notificacionPendiente = datos;
    return;
  }

  const tipo = datos.tipo;
  const claimId = datos.claimId || datos.reclamoId;
  const publicationId = datos.publicationId || datos.publicacionId;

  if (tipo === 'reclamo' || tipo === 'encuentro' || tipo === 'mensaje' || tipo === 'devolucion') {
    const params = { screen: 'MisReclamos', params: claimId ? { reclamoId: claimId } : undefined };
    if (typeof nav.popTo === 'function') {
      try {
        nav.popTo('Principal', params);
        return;
      } catch {
        // Continuar si popTo no aplica en la jerarquía actual
      }
    }
    nav.navigate('Principal', params);
  } else if (tipo === 'valoracion') {
    nav.navigate('Historial');
  } else if (publicationId) {
    nav.navigate('DetallePublicacion', { publicacionId: publicationId });
  } else {
    nav.navigate('Notificaciones');
  }
}

/** Ejecuta la navegación que quedó retenida (biometría, sesión restaurándose). */
export function ejecutarNavegacionPendiente(navigation = refNavegacionActual) {
  const nav = navigation || refNavegacionActual;
  if (notificacionPendiente && nav && puedeNavegar(nav, 'Principal')) {
    const destino = notificacionPendiente;
    notificacionPendiente = null;
    navegarADestino(nav, destino);
    return true;
  }
  return false;
}

// Respuestas ya atendidas (por identificador de la notificación y acción): la última respuesta
// nativa se revisa una sola vez por proceso, no en cada cambio de sesión.
const respuestasAtendidas = new Set();
let respuestaInicialRevisada = false;

function claveRespuesta(respuesta) {
  const request = respuesta?.notification?.request;
  return `${request?.identifier ?? ''}|${respuesta?.actionIdentifier ?? ''}|${respuesta?.notification?.date ?? ''}`;
}

/**
 * Configura los oyentes de notificaciones: el toque (con navegación retenida mientras la sesión
 * se restaura o está bloqueada por biometría) y la recepción con la app abierta.
 * `obtenerEstadoSesion` devuelve 'lista', 'bloqueada', 'cargando' o 'sin_sesion'.
 */
export function configurarOyentesNotificaciones(
  navigationRef = refNavegacionActual,
  obtenerEstadoSesion = () => 'lista'
) {
  const nav = navigationRef || refNavegacionActual;

  const procesar = (respuesta) => {
    const datos = respuesta?.notification?.request?.content?.data;
    if (!datos) return;
    const clave = claveRespuesta(respuesta);
    if (respuestasAtendidas.has(clave)) return;
    respuestasAtendidas.add(clave);

    // Un push tocado ya se mostró: el respaldo no lo vuelve a generar aunque no esté en la bandeja
    const request = respuesta?.notification?.request;
    const idPush = request?.trigger?.type === 'push' ? idDeDatos(datos) : null;
    if (idPush && cuentaActual) anotarPush(cuentaActual, idPush).catch(() => {});

    const estado = obtenerEstadoSesion();
    // Sin sesión no se guarda el destino: podría ser de la cuenta que salió
    if (estado === 'sin_sesion') return;
    if (estado !== 'lista' || !puedeNavegar(nav, 'Principal')) {
      notificacionPendiente = datos;
    } else {
      navegarADestino(nav, datos);
    }
  };

  if (!respuestaInicialRevisada) {
    respuestaInicialRevisada = true;
    Notifications.getLastNotificationResponseAsync()
      .then((respuesta) => {
        if (!respuesta) return;
        procesar(respuesta);
        return Notifications.clearLastNotificationResponseAsync?.();
      })
      .catch(() => {});
  }

  const respuestas = Notifications.addNotificationResponseReceivedListener(procesar);
  const recibidas = Notifications.addNotificationReceivedListener((notificacion) => {
    procesarNotificacionRecibida(notificacion).catch(() => {});
  });

  return () => {
    respuestas.remove();
    recibidas.remove();
  };
}

/** Solo para pruebas: vuelve el módulo a su estado inicial. */
export function reiniciarEstadoPush() {
  cuentaActual = null;
  notificacionPendiente = null;
  registro = REGISTRO_INICIAL;
  registroEnCurso = null;
  generacion += 1;
  respuestasAtendidas.clear();
  respuestaInicialRevisada = false;
  oyentesNovedad.clear();
  oyentesRegistro.clear();
}

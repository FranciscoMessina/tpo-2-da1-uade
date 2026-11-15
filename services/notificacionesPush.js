import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const CANAL_NOTIFICACIONES_ID = 'hallado-notificaciones';
export const CLAVE_STORAGE_NOTIFICADOS = 'hallado_notificaciones_emitidas_ids';

// Cómo se presentan las notificaciones si la app está en primer plano
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // En entornos de prueba o sin soporte se ignora
}

// Almacén en memoria de navegación pendiente cuando la app está bloqueada
let notificacionPendiente = null;
let refNavegacionActual = null;

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

/**
 * Configura el canal de alta importancia en Android para que las notificaciones
 * emitan sonido y se muestren como banner/heads-up.
 */
export async function configurarCanalNotificaciones() {
  if (Platform.OS === 'android') {
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
}

/**
 * Solicita permisos de notificación al sistema operativo.
 */
export async function solicitarPermisoNotificaciones() {
  try {
    const { status: existente } = await Notifications.getPermissionsAsync();
    let final = existente;
    if (existente !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    return final === 'granted';
  } catch {
    return false;
  }
}

/**
 * Intenta obtener el token push de Expo y lo registra en el backend.
 * Si falla (ej. emulador sin cuenta Expo configurada), continúa sin interrumpir.
 */
export async function obtenerYRegistrarTokenPush() {
  try {
    const permitido = await solicitarPermisoNotificaciones();
    if (!permitido) return null;

    await configurarCanalNotificaciones();

    const pushTokenObj = await Notifications.getExpoPushTokenAsync();
    const token = pushTokenObj?.data;

    if (token) {
      try {
        await api.post('/me/push-token', { token });
      } catch {
        // Si el backend no tiene la ruta activa, se ignora
      }
      return token;
    }
  } catch {
    // Falla esperable en emuladores locales sin projectId
  }
  return null;
}

/**
 * Evalúa si una notificación corresponde a los eventos del Punto 12:
 * - Nuevo reclamo o cambio de estado de un reclamo.
 * - Propuesta o modificación de punto de encuentro.
 */
export function esEventoPushRelevante(notificacion) {
  if (!notificacion || typeof notificacion !== 'object') return false;
  const tipo = notificacion.tipo;
  return tipo === 'reclamo' || tipo === 'encuentro';
}

/**
 * Emite una notificación nativa inmediata en la barra de estado del sistema.
 */
export async function emitirNotificacionNativa({
  titulo = 'Hallado',
  mensaje = '',
  datos = {},
}) {
  try {
    await configurarCanalNotificaciones();
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: mensaje,
        data: datos,
        sound: 'default',
      },
      trigger: {
        channelId: CANAL_NOTIFICACIONES_ID,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Programa una notificación con retraso en segundos para probar la llegada
 * con la aplicación minimizada o cerrada.
 */
export async function simularNotificacionNativa({
  segundos = 3,
  titulo = 'Hallado',
  mensaje = 'Recibiste un reclamo en Llaves encontradas en Plaza Italia',
  datos = { tipo: 'reclamo', claimId: 'demo145-reclamo-auriculares' },
}) {
  await solicitarPermisoNotificaciones();
  await configurarCanalNotificaciones();

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: titulo,
      body: mensaje,
      data: datos,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, segundos),
      repeats: false,
      channelId: CANAL_NOTIFICACIONES_ID,
    },
  });
}

/**
 * Compara las notificaciones del servidor con los IDs ya emitidos en el sistema.
 * Si hay notificaciones de reclamo o encuentro sin emitir, las dispara al sistema operativo.
 */
export async function sincronizarAvisosNativos(notificaciones = []) {
  if (!Array.isArray(notificaciones) || notificaciones.length === 0) return;

  try {
    const rawEmitidos = await AsyncStorage.getItem(CLAVE_STORAGE_NOTIFICADOS);
    const emitidos = new Set(rawEmitidos ? JSON.parse(rawEmitidos) : []);

    const pendientesDeAviso = notificaciones.filter(
      (n) => n && n.id && !n.leidaEn && !emitidos.has(n.id) && esEventoPushRelevante(n)
    );

    for (const notif of pendientesDeAviso) {
      await emitirNotificacionNativa({
        titulo: notif.tipo === 'encuentro' ? 'Punto de encuentro' : 'Reclamo',
        mensaje: notif.mensaje,
        datos: {
          id: notif.id,
          tipo: notif.tipo,
          claimId: notif.claimId || notif.reclamoId,
          publicationId: notif.publicationId || notif.publicacionId,
        },
      });
      emitidos.add(notif.id);
    }

    // Mantener los últimos 200 IDs para no sobrecargar el almacenamiento
    const lista = Array.from(emitidos).slice(-200);
    await AsyncStorage.setItem(CLAVE_STORAGE_NOTIFICADOS, JSON.stringify(lista));
  } catch {
    // Si falla el almacenamiento local, no bloquea el flujo principal
  }
}

/**
 * Comprueba si el navegador actual tiene disponible la ruta destino (p. ej. 'Principal' en sesión autenticada).
 */
export function puedeNavegar(navigation = refNavegacionActual, ruta = 'Principal') {
  const nav = navigation || refNavegacionActual;
  if (!nav || (typeof nav.isReady === 'function' && !nav.isReady())) {
    return false;
  }
  const state = typeof nav.getRootState === 'function' ? nav.getRootState() : null;
  if (state && Array.isArray(state.routeNames)) {
    return state.routeNames.includes(ruta);
  }
  return true;
}

/**
 * Resuelve la navegación directa según los datos de la notificación tocada.
 */
export function navegarADestino(navigation = refNavegacionActual, datos = {}) {
  const nav = navigation || refNavegacionActual;
  if (!nav) return;

  if (typeof nav.isReady === 'function' && !nav.isReady()) {
    setTimeout(() => navegarADestino(nav, datos), 300);
    return;
  }

  // Si la sesión aún no está en las pantallas principales (p. ej. cargando sesión o en Login), retener
  if (!puedeNavegar(nav, 'Principal')) {
    notificacionPendiente = datos;
    return;
  }

  const tipo = datos.tipo;
  const claimId = datos.claimId || datos.reclamoId;
  const publicationId = datos.publicationId || datos.publicacionId;

  if (tipo === 'reclamo' || tipo === 'encuentro' || tipo === 'mensaje' || tipo === 'devolucion') {
    if (typeof nav.popTo === 'function') {
      try {
        nav.popTo('Principal', {
          screen: 'MisReclamos',
          params: { reclamoId: claimId },
        });
        return;
      } catch {
        // Continuar si popTo no aplica en la jerarquía actual
      }
    }
    // Lleva a la pestaña Mis Reclamos
    nav.navigate('Principal', {
      screen: 'MisReclamos',
      params: { reclamoId: claimId },
    });
  } else if (tipo === 'valoracion') {
    nav.navigate('Historial');
  } else if (publicationId) {
    nav.navigate('DetallePublicacion', { publicacionId: publicationId });
  } else {
    nav.navigate('Notificaciones');
  }
}

/**
 * Ejecuta la navegación que haya quedado retenida durante el bloqueo biométrico.
 */
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

/**
 * Configura los oyentes para cuando el usuario toca una notificación nativa.
 * Si la app está bloqueada por biometría, guarda el destino para ejecutarlo post-desbloqueo.
 */
export function configurarOyenteRespuestaNotificaciones(navigationRef = refNavegacionActual, estaBloqueadoFn = () => false) {
  const nav = navigationRef || refNavegacionActual;
  const procesar = (datos) => {
    if (!datos) return;
    if (estaBloqueadoFn() || !puedeNavegar(nav, 'Principal')) {
      notificacionPendiente = datos;
    } else {
      navegarADestino(nav, datos);
    }
  };

  // Revisa si la app fue abierta originalmente por una notificación
  Notifications.getLastNotificationResponseAsync()
    .then((respuesta) => {
      if (respuesta?.notification?.request?.content?.data) {
        procesar(respuesta.notification.request.content.data);
      }
    })
    .catch(() => {});

  // Escucha cuando el usuario toca una notificación en la barra de Android
  const suscripcion = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    const datos = respuesta?.notification?.request?.content?.data;
    if (datos) {
      procesar(datos);
    }
  });

  return () => {
    suscripcion.remove();
  };
}

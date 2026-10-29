import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError, isCancel } from 'axios';
import {
  borrarDirectorio,
  conservarSoloArchivos,
  copiarALocal,
  existeArchivo,
} from './archivosLocales';

// Cola de publicaciones creadas sin conexión, una por cuenta. Cada ítem lleva los datos del
// formulario, las fotos copiadas a la carpeta de la app y un `clientId` fijo: reenviarlo
// (aunque se haya cortado la red a mitad del envío) no duplica la publicación porque el
// backend deduplica por (usuario, clientId).
//
// Cerrar sesión NO borra la cola: queda guardada y solo la procesa esa misma cuenta cuando
// vuelve a iniciar sesión. Vive fuera de la caché de lectura (@hallado:cache/), que sí se limpia.
const PREFIJO_COLA = '@hallado:cola/';

export const ESTADOS = {
  PENDIENTE: 'pendiente',
  ENVIANDO: 'enviando',
  ERROR: 'error',
};

// Tope de ítems por cuenta (cada uno guarda sus fotos en el dispositivo)
export const MAX_ITEMS_COLA = 20;

// Espera entre reintentos: 5 s, 10 s, 20 s... hasta 5 minutos
export const BACKOFF_BASE_MS = 5000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;

// Fallas seguidas del servidor (5xx, 429...) tras las cuales el ítem pasa a «con error».
// Las fallas de conectividad no cuentan: se reintentan mientras haga falta.
export const MAX_FALLOS_SERVIDOR = 5;

export function claveCola(uid) {
  return `${PREFIJO_COLA}${uid}`;
}

function carpetaItem(uid, clientId) {
  return ['cola', uid, clientId];
}

// ---------------------------------------------------------------------------
// Funciones puras: estado de la cola
// Todas devuelven una cola nueva (o el dato calculado) sin modificar la recibida.
// ---------------------------------------------------------------------------

/** Espera antes del reintento número `fallos` (1 = primer fallo), con tope. */
export function calcularBackoff(fallos, { base = BACKOFF_BASE_MS, maximo = BACKOFF_MAX_MS } = {}) {
  if (!Number.isFinite(fallos) || fallos <= 0) return 0;
  return Math.min(base * 2 ** (fallos - 1), maximo);
}

/** Crea un ítem pendiente. `id` es el propio `clientId`. */
export function crearItem({ datos, clientId, fotosSubidas = {}, ahora = Date.now() }) {
  return {
    id: clientId,
    clientId,
    datos,
    fotosSubidas: { ...fotosSubidas },
    estado: ESTADOS.PENDIENTE,
    intentos: 0,
    fallosServidor: 0,
    proximoIntentoAt: null,
    ultimoError: '',
    creadoAt: ahora,
    actualizadoAt: ahora,
  };
}

function itemValido(item) {
  return Boolean(
    item &&
      typeof item.clientId === 'string' &&
      item.clientId &&
      item.datos &&
      typeof item.datos === 'object' &&
      Object.values(ESTADOS).includes(item.estado)
  );
}

/** Interpreta lo leído del almacenamiento: descarta lo inválido y completa los campos faltantes. */
export function normalizarCola(crudo) {
  let lista;
  try {
    lista = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];

  return lista.filter(itemValido).map((item) => ({
    ...crearItem({ datos: item.datos, clientId: item.clientId, ahora: item.creadoAt }),
    ...item,
    id: item.clientId,
    fotosSubidas: item.fotosSubidas && typeof item.fotosSubidas === 'object' ? item.fotosSubidas : {},
  }));
}

function actualizarUno(cola, id, cambios) {
  return cola.map((item) => (item.id === id ? { ...item, ...cambios } : item));
}

/** True si todavía hay lugar para otro ítem. */
export function puedeEncolar(cola) {
  return cola.length < MAX_ITEMS_COLA;
}

/** Al abrir la app ningún envío puede estar en curso: los «enviando» vuelven a pendiente. */
export function reiniciarEnviando(cola, ahora = Date.now()) {
  if (!cola.some((item) => item.estado === ESTADOS.ENVIANDO)) return cola;
  return cola.map((item) =>
    item.estado === ESTADOS.ENVIANDO
      ? { ...item, estado: ESTADOS.PENDIENTE, actualizadoAt: ahora }
      : item
  );
}

/** Quita la espera de backoff de los pendientes (p. ej. cuando vuelve la conexión). */
export function liberarEspera(cola) {
  if (!cola.some((item) => item.proximoIntentoAt)) return cola;
  return cola.map((item) => (item.proximoIntentoAt ? { ...item, proximoIntentoAt: null } : item));
}

/**
 * Próximo ítem a enviar: el primero (en orden de creación) que no esté con error.
 * Si está en espera de backoff, no se adelanta a ninguno posterior para respetar el orden.
 * Si hay un envío en curso devuelve null.
 */
export function siguienteItem(cola, ahora = Date.now()) {
  if (cola.some((item) => item.estado === ESTADOS.ENVIANDO)) return null;

  const candidato = cola.find((item) => item.estado === ESTADOS.PENDIENTE);
  if (!candidato) return null;
  if (candidato.proximoIntentoAt && candidato.proximoIntentoAt > ahora) return null;
  return candidato;
}

/** Milisegundos hasta que el primer pendiente pueda reintentarse (null si no hay espera). */
export function proximaEspera(cola, ahora = Date.now()) {
  const candidato = cola.find((item) => item.estado === ESTADOS.PENDIENTE);
  if (!candidato || !candidato.proximoIntentoAt) return null;
  return Math.max(0, candidato.proximoIntentoAt - ahora);
}

export function marcarEnviando(cola, id, ahora = Date.now()) {
  return actualizarUno(cola, id, { estado: ESTADOS.ENVIANDO, actualizadoAt: ahora });
}

/** Anota una foto ya subida al servidor (uri local -> url) para no volver a subirla. */
export function registrarFotoSubida(cola, id, uri, url) {
  return cola.map((item) =>
    item.id === id ? { ...item, fotosSubidas: { ...item.fotosSubidas, [uri]: url } } : item
  );
}

/** Falla de conectividad: vuelve a pendiente con espera exponencial. No cuenta para el límite del servidor. */
export function marcarFalloConectividad(cola, id, ahora = Date.now()) {
  const item = cola.find((i) => i.id === id);
  if (!item) return cola;

  const intentos = item.intentos + 1;
  return actualizarUno(cola, id, {
    estado: ESTADOS.PENDIENTE,
    intentos,
    proximoIntentoAt: ahora + calcularBackoff(intentos),
    actualizadoAt: ahora,
  });
}

/** Falla del servidor (5xx, 429...): reintenta con espera hasta agotar el límite y luego pasa a error. */
export function marcarFalloServidor(cola, id, mensaje, ahora = Date.now()) {
  const item = cola.find((i) => i.id === id);
  if (!item) return cola;

  const intentos = item.intentos + 1;
  const fallosServidor = item.fallosServidor + 1;
  if (fallosServidor >= MAX_FALLOS_SERVIDOR) {
    return marcarError(cola, id, mensaje, ahora, { intentos, fallosServidor });
  }

  return actualizarUno(cola, id, {
    estado: ESTADOS.PENDIENTE,
    intentos,
    fallosServidor,
    proximoIntentoAt: ahora + calcularBackoff(intentos),
    ultimoError: mensaje || '',
    actualizadoAt: ahora,
  });
}

/** Rechazo definitivo (validación u otro 4xx): el ítem queda con error hasta que se edite o descarte. */
export function marcarError(cola, id, mensaje, ahora = Date.now(), extra = {}) {
  return actualizarUno(cola, id, {
    ...extra,
    estado: ESTADOS.ERROR,
    proximoIntentoAt: null,
    ultimoError: mensaje || 'No se pudo enviar la publicación.',
    actualizadoAt: ahora,
  });
}

/** Envío interrumpido sin culpa del ítem (cancelación, sesión): vuelve a pendiente sin sumar intentos. */
export function marcarInterrumpido(cola, id, ahora = Date.now()) {
  return actualizarUno(cola, id, {
    estado: ESTADOS.PENDIENTE,
    proximoIntentoAt: null,
    actualizadoAt: ahora,
  });
}

/** Pasa un ítem con error a pendiente para reintentarlo tal cual. */
export function reintentar(cola, id, ahora = Date.now()) {
  return cola.map((item) =>
    item.id === id && item.estado === ESTADOS.ERROR
      ? {
          ...item,
          estado: ESTADOS.PENDIENTE,
          intentos: 0,
          fallosServidor: 0,
          proximoIntentoAt: null,
          ultimoError: '',
          actualizadoAt: ahora,
        }
      : item
  );
}

/**
 * Reemplaza los datos de un ítem con error (tras editarlo) y lo deja pendiente.
 * Conserva el `clientId` y, de las fotos ya subidas, solo las que siguen en el formulario.
 */
export function reemplazarDatos(cola, id, { datos, fotosSubidas = {} }, ahora = Date.now()) {
  return cola.map((item) => {
    if (item.id !== id || item.estado === ESTADOS.ENVIANDO) return item;

    return {
      ...item,
      datos,
      fotosSubidas: Object.fromEntries(
        Object.entries(fotosSubidas).filter(([uri]) => (datos.fotos || []).includes(uri))
      ),
      estado: ESTADOS.PENDIENTE,
      intentos: 0,
      fallosServidor: 0,
      proximoIntentoAt: null,
      ultimoError: '',
      actualizadoAt: ahora,
    };
  });
}

/** Quita un ítem de la cola. */
export function quitarItem(cola, id) {
  return cola.filter((item) => item.id !== id);
}

/** Conteo por estado para mostrar en la interfaz. */
export function resumenCola(cola) {
  const cuenta = (estado) => cola.filter((item) => item.estado === estado).length;
  return {
    total: cola.length,
    pendientes: cuenta(ESTADOS.PENDIENTE),
    enviando: cuenta(ESTADOS.ENVIANDO),
    conError: cuenta(ESTADOS.ERROR),
  };
}

/** Resumen de una línea del estado de la cola (null si está vacía). */
export function textoResumenCola(resumen) {
  if (!resumen || resumen.total === 0) return null;

  const plural = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
  const partes = [];
  if (resumen.enviando > 0) partes.push(`Enviando ${plural(resumen.enviando, 'publicación', 'publicaciones')}`);
  if (resumen.pendientes > 0) partes.push(`${plural(resumen.pendientes, 'publicación pendiente', 'publicaciones pendientes')} de envío`);
  if (resumen.conError > 0) partes.push(`${plural(resumen.conError, 'publicación', 'publicaciones')} con error`);
  return partes.join(' · ');
}

/** Texto de estado de un ítem para mostrar al usuario. */
export function describirEstado(item, hayConexion = true) {
  if (item.estado === ESTADOS.ENVIANDO) return 'Enviando…';
  if (item.estado === ESTADOS.ERROR) {
    return `No se pudo enviar: ${item.ultimoError || 'la publicación fue rechazada.'}`;
  }
  if (!hayConexion) return 'Esperando conexión para enviarse.';
  return item.intentos > 0
    ? 'El envío falló y se reintentará automáticamente.'
    : 'Pendiente de envío.';
}

/**
 * Fotos locales del ítem que todavía no se subieron y cuyo archivo ya no existe
 * (`existe` se inyecta para poder probarlo).
 */
export function fotosFaltantes(item, existe = existeArchivo) {
  return (item.datos.fotos || []).filter(
    (uri) => !item.fotosSubidas[uri] && /^(file|content):\/\//i.test(uri) && !existe(uri)
  );
}

/**
 * Cómo tratar el error de un envío:
 *  - 'cancelado': se abortó a propósito (cierre de sesión, cambio de pantalla)
 *  - 'conectividad': sin respuesta del servidor (red caída, timeout)
 *  - 'sesion': 401, la sesión no es válida; se espera a que la app la resuelva
 *  - 'servidor': 5xx, 408, 425 o 429; vale la pena reintentar
 *  - 'rechazo': 4xx de validación u otro error que reintentar no arregla
 */
export function clasificarError(error) {
  if (isCancel(error) || error?.name === 'AbortError') return 'cancelado';
  if (!isAxiosError(error)) return 'rechazo';
  if (!error.response) return 'conectividad';

  const estado = error.response.status;
  if (estado === 401) return 'sesion';
  if (estado >= 500 || [408, 425, 429].includes(estado)) return 'servidor';
  return 'rechazo';
}

/** Valores iniciales del formulario a partir de los datos que se enviaron (para editar un ítem). */
export function valoresDesdeDatos(datos) {
  return {
    tipo: datos.tipo,
    titulo: datos.titulo,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    barrio: datos.barrio || '',
    coords: !datos.barrio && datos.ubicacion ? datos.ubicacion : null,
    fecha: datos.fecha,
    franja: datos.franja,
    direccionExacta: datos.direccionExacta || '',
    fotos: datos.fotos || [],
    preguntaVerificacion: datos.preguntaVerificacion || '',
    respuestaVerificacion: datos.respuestaVerificacion || '',
  };
}

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------

const oyentes = new Set();

/** Suscribe un oyente `(uid, cola)` a cada cambio de la cola. Devuelve la función para desuscribirse. */
export function suscribirCola(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// Las lecturas-modificaciones-escrituras se ejecutan de a una para no perder cambios
// cuando el procesador y la interfaz tocan la cola al mismo tiempo.
let colaOperaciones = Promise.resolve();

function serializar(tarea) {
  const resultado = colaOperaciones.then(tarea);
  colaOperaciones = resultado.catch(() => {});
  return resultado;
}

async function leerSinBloqueo(uid) {
  const crudo = await AsyncStorage.getItem(claveCola(uid));
  return crudo ? normalizarCola(crudo) : [];
}

/** Lee la cola de la cuenta. */
export function leerCola(uid) {
  if (!uid) return Promise.resolve([]);
  return serializar(() => leerSinBloqueo(uid)).catch(() => []);
}

/**
 * Aplica `cambio(cola)` (función pura que devuelve la cola nueva) sobre lo guardado,
 * lo persiste si cambió y avisa a los oyentes. Devuelve la cola resultante.
 */
export function modificarCola(uid, cambio) {
  return serializar(async () => {
    const actual = await leerSinBloqueo(uid);
    const nueva = cambio(actual);

    if (nueva !== actual) {
      if (nueva.length === 0) await AsyncStorage.removeItem(claveCola(uid));
      else await AsyncStorage.setItem(claveCola(uid), JSON.stringify(nueva));
      oyentes.forEach((oyente) => oyente(uid, nueva));
    }
    return nueva;
  });
}

/** Al iniciar: los envíos que quedaron «enviando» por un cierre de la app vuelven a pendiente. */
export function recuperarCola(uid) {
  return modificarCola(uid, (cola) => reiniciarEnviando(cola));
}

// Copia las fotos locales a la carpeta del ítem y devuelve datos y fotosSubidas apuntando a las copias
async function guardarFotosDelItem(uid, clientId, datos, fotosSubidas) {
  const carpeta = carpetaItem(uid, clientId);
  const nuevas = {};

  for (const uri of datos.fotos || []) {
    try {
      nuevas[uri] = await copiarALocal(uri, carpeta);
    } catch (e) {
      // Una foto ya subida al servidor no hace falta en el dispositivo para enviar
      if (!fotosSubidas[uri]) {
        throw new Error('No pudimos guardar una de las fotos en el dispositivo. Volvé a elegirla.');
      }
      nuevas[uri] = uri;
    }
  }

  return {
    datos: { ...datos, fotos: (datos.fotos || []).map((uri) => nuevas[uri]) },
    fotosSubidas: Object.fromEntries(
      Object.entries(fotosSubidas).map(([uri, url]) => [nuevas[uri] || uri, url])
    ),
  };
}

/**
 * Agrega una publicación a la cola de la cuenta. Copia las fotos a la carpeta de la app.
 * Si ya existe un ítem con ese `clientId` no lo duplica.
 */
export async function encolarPublicacion(uid, { datos, clientId, fotosSubidas = {} }) {
  if (!uid) throw new Error('No hay una sesión activa.');

  const actual = await leerCola(uid);
  const existente = actual.find((item) => item.clientId === clientId);
  if (existente) return existente;
  if (!puedeEncolar(actual)) {
    throw new Error(
      `Ya tenés ${MAX_ITEMS_COLA} publicaciones pendientes. Esperá a que se envíen o descartá alguna.`
    );
  }

  const guardado = await guardarFotosDelItem(uid, clientId, datos, fotosSubidas);
  const item = crearItem({ clientId, ...guardado });

  await modificarCola(uid, (cola) =>
    cola.some((i) => i.clientId === clientId) ? cola : [...cola, item]
  );
  return item;
}

/** Guarda los cambios de un ítem con error editado y lo deja pendiente. */
export async function actualizarEnCola(uid, id, { datos, fotosSubidas = {} }) {
  const actual = (await leerCola(uid)).find((item) => item.id === id);
  if (!actual || actual.estado === ESTADOS.ENVIANDO) {
    throw new Error('Esta publicación ya no se puede editar.');
  }

  const guardado = await guardarFotosDelItem(uid, actual.clientId, datos, fotosSubidas);
  await modificarCola(uid, (cola) => reemplazarDatos(cola, id, guardado));

  // Las fotos que se quitaron al editar ya no hacen falta
  conservarSoloArchivos(carpetaItem(uid, actual.clientId), guardado.datos.fotos);
}

/** Libera los archivos de un ítem que ya no está en la cola. */
export function liberarArchivosItem(uid, item) {
  if (item?.clientId) borrarDirectorio(...carpetaItem(uid, item.clientId));
}

/** Descarta un ítem (y sus fotos). No se descarta mientras se está enviando. */
export async function descartarDeCola(uid, id) {
  const item = (await leerCola(uid)).find((i) => i.id === id);
  if (!item || item.estado === ESTADOS.ENVIANDO) return false;

  await modificarCola(uid, (cola) => quitarItem(cola, id));
  liberarArchivosItem(uid, item);
  return true;
}

/** Pasa un ítem con error a pendiente para que el procesador lo reintente. */
export function reintentarEnCola(uid, id) {
  return modificarCola(uid, (cola) => reintentar(cola, id));
}

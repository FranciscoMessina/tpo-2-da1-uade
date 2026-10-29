import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  borrarArchivo,
  borrarDirectorio,
  copiarALocal,
  estaEnDirectorio,
  existeArchivo,
} from './archivosLocales';

// Un borrador por cuenta, con los campos del formulario de alta. Las fotos elegidas se
// copian a una carpeta de la app porque las URIs del selector pueden ser temporales.
// Vive fuera de la caché de lectura (@hallado:cache/): cerrar sesión no lo borra, pero
// solo se ofrece cuando esa misma cuenta vuelve a abrir el formulario.
const PREFIJO_BORRADOR = '@hallado:borrador/';
const VERSION = 1;

export function claveBorrador(uid) {
  return `${PREFIJO_BORRADOR}${uid}`;
}

function carpetaBorrador(uid) {
  return ['borradores', uid];
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

const texto = (valor) => (typeof valor === 'string' ? valor : '');

/**
 * Deja los valores del formulario con la forma esperada (campos de texto siempre
 * string, fotos como lista de strings, coords solo si tienen latitud y longitud).
 */
export function normalizarValores(valores) {
  const origen = valores && typeof valores === 'object' ? valores : {};
  const coords = origen.coords;

  return {
    tipo: origen.tipo === 'encontre' ? 'encontre' : 'perdi',
    titulo: texto(origen.titulo),
    categoria: texto(origen.categoria),
    descripcion: texto(origen.descripcion),
    barrio: texto(origen.barrio),
    coords:
      coords && typeof coords.latitud === 'number' && typeof coords.longitud === 'number'
        ? { latitud: coords.latitud, longitud: coords.longitud }
        : null,
    direccionExacta: texto(origen.direccionExacta),
    fecha: texto(origen.fecha),
    franja: texto(origen.franja),
    fotos: Array.isArray(origen.fotos)
      ? origen.fotos.filter((foto) => typeof foto === 'string' && foto)
      : [],
    preguntaVerificacion: texto(origen.preguntaVerificacion),
    respuestaVerificacion: texto(origen.respuestaVerificacion),
  };
}

/**
 * Un formulario sin nada que valga la pena conservar no se guarda como borrador.
 * El tipo y la fecha (que arranca en «hoy») no cuentan como contenido.
 */
export function borradorVacio(valores) {
  const v = normalizarValores(valores);

  return !(
    v.titulo.trim() ||
    v.categoria ||
    v.descripcion.trim() ||
    v.barrio ||
    v.coords ||
    v.direccionExacta.trim() ||
    v.franja ||
    v.fotos.length > 0 ||
    v.preguntaVerificacion.trim() ||
    v.respuestaVerificacion.trim()
  );
}

/**
 * Registro que se guarda: valores del formulario, `clientId` del intento de alta
 * (para que retomar el borrador no duplique la publicación) y las fotos que ya se
 * subieron al servidor (uri local -> url), para no volver a subirlas.
 */
export function armarBorrador({ valores, clientId, fotosSubidas = {}, ahora = Date.now() }) {
  const normalizados = normalizarValores(valores);

  return {
    version: VERSION,
    valores: normalizados,
    clientId: typeof clientId === 'string' && clientId ? clientId : null,
    fotosSubidas: Object.fromEntries(
      Object.entries(fotosSubidas || {}).filter(([uri]) => normalizados.fotos.includes(uri))
    ),
    guardadoAt: ahora,
  };
}

/**
 * Interpreta lo leído del almacenamiento. Descarta las fotos cuyo archivo ya no existe
 * (`existe` se inyecta para poder probarlo) y devuelve null si el registro es inválido
 * o quedó sin contenido.
 */
export function interpretarBorrador(crudo, existe = existeArchivo) {
  let registro;
  try {
    registro = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
  } catch {
    return null;
  }

  if (!registro || registro.version !== VERSION || !registro.valores) return null;

  const valores = normalizarValores(registro.valores);
  valores.fotos = valores.fotos.filter((uri) => existe(uri));
  if (borradorVacio(valores)) return null;

  return armarBorrador({
    valores,
    clientId: registro.clientId,
    fotosSubidas: registro.fotosSubidas,
    ahora: Number.isFinite(registro.guardadoAt) ? registro.guardadoAt : Date.now(),
  });
}

/** «hace 5 minutos», «hace 2 horas»… para mostrar cuándo se guardó el borrador. */
export function textoAntiguedad(guardadoAt, ahora = Date.now()) {
  const minutos = Math.max(0, Math.floor((ahora - guardadoAt) / 60000));
  if (minutos < 1) return 'hace instantes';
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------

// Las operaciones sobre el borrador se ejecutan de a una, en el orden en que se piden:
// así un guardado pendiente no resucita un borrador recién descartado.
let colaOperaciones = Promise.resolve();

function encolar(tarea) {
  const resultado = colaOperaciones.then(tarea);
  colaOperaciones = resultado.catch(() => {});
  return resultado;
}

/** Guarda (o reemplaza) el borrador de la cuenta. Un formulario vacío elimina el borrador. */
export function guardarBorrador(uid, { valores, clientId, fotosSubidas }) {
  if (!uid) return Promise.resolve();

  if (borradorVacio(valores)) return descartarBorrador(uid);

  return encolar(async () => {
    const registro = armarBorrador({ valores, clientId, fotosSubidas });
    await AsyncStorage.setItem(claveBorrador(uid), JSON.stringify(registro));
  });
}

/** Lee el borrador de la cuenta (null si no hay o está dañado). */
export async function leerBorrador(uid) {
  if (!uid) return null;

  return encolar(async () => {
    const crudo = await AsyncStorage.getItem(claveBorrador(uid));
    return crudo ? interpretarBorrador(crudo) : null;
  }).catch(() => null);
}

/** Elimina el borrador de la cuenta junto con las fotos copiadas. */
export function descartarBorrador(uid) {
  if (!uid) return Promise.resolve();

  return encolar(async () => {
    await AsyncStorage.removeItem(claveBorrador(uid));
    borrarDirectorio(...carpetaBorrador(uid));
  }).catch(() => {});
}

/**
 * Copia una foto elegida a la carpeta del borrador y devuelve su URI definitiva.
 * Si no se puede copiar, devuelve la URI original (se usa tal cual mientras exista).
 */
export async function copiarFotoABorrador(uid, uri) {
  if (!uid) return uri;
  try {
    return await copiarALocal(uri, carpetaBorrador(uid));
  } catch {
    return uri;
  }
}

/** Borra el archivo de una foto quitada del formulario (solo si es una copia del borrador). */
export function quitarFotoDeBorrador(uid, uri) {
  if (uid && estaEnDirectorio(uri, ...carpetaBorrador(uid))) borrarArchivo(uri);
}

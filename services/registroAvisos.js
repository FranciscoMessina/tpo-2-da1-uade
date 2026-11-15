import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Registro, por cuenta, de las notificaciones del servidor que ya se mostraron en el sistema
 * operativo y por qué vía: `push` (llegó por Expo) o `local` (la generó la app al consultar).
 * Es lo que evita el aviso doble cuando el push y la consulta periódica ven la misma notificación:
 * la clave es el `id` de GET /notificaciones, que el backend repite en `data.id` del push.
 *
 * Las operaciones se encadenan en una sola cola: leer, decidir y guardar ocurre sin que otra
 * operación (el push que llega mientras se consulta) se intercale.
 */

export const PREFIJO_CLAVE = 'hallado_avisos_presentados:';
const MAXIMO_IDS = 300;

let cola = Promise.resolve();
// Copia en memoria por cuenta para no leer el almacenamiento en cada push
const cache = new Map();

function encolar(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

function vacio() {
  return { base: false, ids: {} };
}

async function leer(cuenta) {
  if (cache.has(cuenta)) return cache.get(cuenta);
  let estado = vacio();
  try {
    const crudo = await AsyncStorage.getItem(PREFIJO_CLAVE + cuenta);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (datos && typeof datos === 'object' && datos.ids && typeof datos.ids === 'object') {
      estado = { base: !!datos.base, ids: { ...datos.ids } };
    }
  } catch {
    // Datos ilegibles: se empieza de cero
  }
  cache.set(cuenta, estado);
  return estado;
}

async function guardar(cuenta, estado) {
  const claves = Object.keys(estado.ids);
  if (claves.length > MAXIMO_IDS) {
    // Las claves conservan el orden de inserción: se descartan las más viejas
    claves.slice(0, claves.length - MAXIMO_IDS).forEach((id) => delete estado.ids[id]);
  }
  cache.set(cuenta, estado);
  try {
    await AsyncStorage.setItem(PREFIJO_CLAVE + cuenta, JSON.stringify(estado));
  } catch {
    // Queda en memoria hasta que la app se cierre
  }
}

/**
 * Anota que llegó un push con ese id. Devuelve la vía previa (`'local'`, `'push'` o null),
 * para que quien lo muestre sepa si ya había un aviso local de la misma notificación.
 */
export function anotarPush(cuenta, id) {
  if (!cuenta || !id) return Promise.resolve(null);
  return encolar(async () => {
    const estado = await leer(cuenta);
    const previo = estado.ids[id] ?? null;
    if (!previo) {
      estado.ids[id] = 'push';
      await guardar(cuenta, estado);
    }
    return previo;
  });
}

/**
 * Reserva ids para mostrarlos como aviso local: devuelve los que nadie mostró todavía y los marca
 * como `local` en la misma operación. La primera vez de cada cuenta solo toma los ids como punto
 * de partida, sin devolver ninguno, para no llenar el sistema de avisos viejos al ingresar.
 */
export function reservarLocales(cuenta, ids) {
  if (!cuenta || !Array.isArray(ids) || ids.length === 0) return Promise.resolve([]);
  return encolar(async () => {
    const estado = await leer(cuenta);
    const base = estado.base;
    const nuevos = ids.filter((id) => id && !estado.ids[id]);
    nuevos.forEach((id) => { estado.ids[id] = 'local'; });
    estado.base = true;
    if (nuevos.length > 0 || !base) await guardar(cuenta, estado);
    return base ? nuevos : [];
  });
}

/** Libera un id reservado cuyo aviso local no se pudo mostrar, para intentarlo en otro ciclo. */
export function liberarLocal(cuenta, id) {
  if (!cuenta || !id) return Promise.resolve();
  return encolar(async () => {
    const estado = await leer(cuenta);
    if (estado.ids[id] === 'local') {
      delete estado.ids[id];
      await guardar(cuenta, estado);
    }
  });
}

/** Solo para pruebas: olvida la copia en memoria. */
export function reiniciarCacheAvisos() {
  cache.clear();
  cola = Promise.resolve();
}

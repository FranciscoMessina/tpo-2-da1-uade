import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import {
  esErrorDeConectividad,
  estaConectado,
  reportarFalloConexion,
} from './conexion';
import { CATEGORIAS, ZONAS } from '../data/busqueda';

// Catálogo de categorías y barrios que usan los formularios de búsqueda y de publicación.
//
// Fuente: GET /categorias y GET /barrios del backend, que además declaran la versión en la
// cabecera `x-catalogo-version`. De cada barrio solo se usa el nombre (es lo que guardan las
// publicaciones y las alertas) y un centro: una referencia para ordenar por cercanía, no la
// posición exacta de un suceso. El barrio nunca se deduce del GPS.
//
// El catálogo que se muestra es siempre el último válido que se conoce, con su origen:
//  - 'api': traído del backend en esta sesión.
//  - 'cache': la última copia válida que quedó guardada en el dispositivo.
//  - 'incluido': el que trae la app (data/busqueda.js), cuando todavía no hay otro.
// Sin conexión (o ante una respuesta inválida) no se bloquea nada: se sigue con el vigente.

export const CLAVE_CATALOGO = '@hallado:catalogo';

const CABECERA_VERSION = 'x-catalogo-version';
const TIMEOUT_CATALOGO_MS = 5000;
// Mientras el catálogo esté fresco, abrir otro formulario no vuelve a pedirlo.
const VIGENCIA_MS = 10 * 60 * 1000;
const OPCIONES_PEDIDO = {
  timeout: TIMEOUT_CATALOGO_MS,
  // Catálogo público: no se envía el token de sesión.
  headers: { Authorization: false },
};

/**
 * Minúsculas y sin tildes: así se comparan nombres de barrio y de categoría. «Núñez» y «nunez»
 * son el mismo nombre; por eso un catálogo no puede traer los dos.
 */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Huella (FNV-1a de 32 bits sobre las unidades UTF-16 del JSON) del contenido del catálogo, en
 * hexadecimal de 8 dígitos. Es la misma que calcula el backend (src/types.ts, catalogVersion):
 * mismo contenido, misma versión, y cambia sola cuando cambia la lista.
 */
export function versionDeCatalogo(categorias, zonas) {
  const texto = JSON.stringify({
    categorias,
    zonas: zonas.map(({ nombre, latitud, longitud }) => ({ nombre, latitud, longitud })),
  });
  let huella = 0x811c9dc5;

  for (let i = 0; i < texto.length; i++) {
    huella = Math.imul(huella ^ texto.charCodeAt(i), 0x01000193) >>> 0;
  }

  return huella.toString(16).padStart(8, '0');
}

const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';

const coordenadaValida = (valor, limite) =>
  typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) <= limite;

function sinRepetidos(nombres) {
  return new Set(nombres.map(normalizar)).size === nombres.length;
}

/**
 * Devuelve `{ categorias, zonas }` limpio si el catálogo es usable y `null` si no: listas no
 * vacías, nombres de texto, coordenadas numéricas en rango y sin nombres que coincidan al
 * ignorar tildes y mayúsculas (dos barrios homónimos no se fusionan: se rechaza el catálogo).
 */
export function validarCatalogo(catalogo) {
  const { categorias, zonas } = catalogo ?? {};

  if (!Array.isArray(categorias) || categorias.length === 0 || !categorias.every(textoValido)) {
    return null;
  }

  if (
    !Array.isArray(zonas) ||
    zonas.length === 0 ||
    !zonas.every(
      (zona) =>
        zona &&
        textoValido(zona.nombre) &&
        coordenadaValida(zona.latitud, 90) &&
        coordenadaValida(zona.longitud, 180)
    )
  ) {
    return null;
  }

  if (!sinRepetidos(categorias) || !sinRepetidos(zonas.map((zona) => zona.nombre))) {
    return null;
  }

  return {
    categorias: [...categorias],
    zonas: zonas.map(({ nombre, latitud, longitud }) => ({ nombre, latitud, longitud })),
  };
}

function armarCatalogo({ categorias, zonas }, origen, version) {
  return { categorias, zonas, origen, version: version ?? versionDeCatalogo(categorias, zonas) };
}

const INCLUIDO = armarCatalogo(
  { categorias: CATEGORIAS, zonas: ZONAS },
  'incluido'
);

/** El catálogo que trae la app. Es el último recurso cuando no hay otro válido. */
export function catalogoIncluido() {
  return INCLUIDO;
}

// Estado compartido por todas las pantallas. `actual` cambia de identidad solo cuando cambia el
// catálogo, para que useSyncExternalStore no renderice de más.
let actual = INCLUIDO;
let ultimaActualizacion = 0;
let enCurso = null;
const oyentes = new Set();

/** Catálogo vigente (lectura sin red). */
export function catalogoActual() {
  return actual;
}

/** Suscribe un oyente a los cambios del catálogo. Devuelve la función para desuscribirse. */
export function suscribirCatalogo(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function mismoCatalogo(a, b) {
  return (
    a.origen === b.origen &&
    a.version === b.version &&
    JSON.stringify([a.categorias, a.zonas]) === JSON.stringify([b.categorias, b.zonas])
  );
}

function adoptar(catalogo) {
  if (mismoCatalogo(actual, catalogo)) return;
  actual = catalogo;
  oyentes.forEach((oyente) => oyente());
}

/** Vuelve al catálogo incluido y olvida el estado en memoria (para pruebas; no toca lo guardado). */
export function restablecerCatalogo() {
  actual = INCLUIDO;
  ultimaActualizacion = 0;
  enCurso = null;
}

/**
 * Lee la última copia válida guardada en el dispositivo y, si todavía no hay un catálogo mejor
 * (solo el incluido), pasa a usarla con origen 'cache'. Devuelve esa copia o `null`.
 */
export async function cargarCatalogoGuardado() {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_CATALOGO);
    const guardado = crudo ? JSON.parse(crudo) : null;
    const limpio = validarCatalogo(guardado);

    if (!limpio) return null;

    const catalogo = armarCatalogo(
      limpio,
      'cache',
      textoValido(guardado.version) ? guardado.version : undefined
    );

    if (actual.origen === 'incluido') adoptar(catalogo);

    return catalogo;
  } catch {
    return null;
  }
}

async function guardarCatalogo({ categorias, zonas, version }) {
  try {
    await AsyncStorage.setItem(
      CLAVE_CATALOGO,
      JSON.stringify({ version, categorias, zonas, guardadoEn: new Date().toISOString() })
    );
  } catch {
    // Sin copia guardada se sigue con el catálogo en memoria
  }
}

function versionDeclarada(respuesta) {
  const valor = respuesta?.headers?.[CABECERA_VERSION];

  return textoValido(valor) ? String(valor).trim() : null;
}

/**
 * Pide el catálogo al backend. Si la respuesta es válida lo adopta (origen 'api') y lo guarda
 * como última copia válida. Ante cualquier falla (sin conexión, error HTTP, respuesta inválida
 * o de versiones mezcladas) no lanza: deja el catálogo vigente y lo devuelve. Un error de
 * conectividad además queda registrado en el estado compartido de conexión.
 */
export async function actualizarCatalogo() {
  let categorias;
  let barrios;

  try {
    [categorias, barrios] = await Promise.all([
      api.get('/categorias', OPCIONES_PEDIDO),
      api.get('/barrios', OPCIONES_PEDIDO),
    ]);
  } catch (error) {
    if (esErrorDeConectividad(error)) reportarFalloConexion();
    return actual;
  }

  const limpio = validarCatalogo({ categorias: categorias.data, zonas: barrios.data });
  const versionCategorias = versionDeclarada(categorias);
  const versionBarrios = versionDeclarada(barrios);
  // Dos pedidos distintos podrían caer a ambos lados de un cambio de catálogo en el servidor.
  const mezcladas =
    versionCategorias !== null && versionBarrios !== null && versionCategorias !== versionBarrios;

  if (!limpio || mezcladas) return actual;

  const catalogo = armarCatalogo(limpio, 'api', versionCategorias ?? versionBarrios ?? undefined);

  ultimaActualizacion = Date.now();
  await guardarCatalogo(catalogo);
  adoptar(catalogo);

  return actual;
}

/**
 * Deja el catálogo listo para un formulario: restaura la copia guardada y, con conexión, lo
 * actualiza. Las llamadas simultáneas comparten el mismo pedido y, mientras el catálogo está
 * fresco, no se repite (`forzar` lo vuelve a pedir). Nunca lanza ni espera a la red cuando el
 * backend se sabe inalcanzable. Devuelve el catálogo vigente.
 */
export function iniciarCatalogo({ forzar = false } = {}) {
  if (enCurso) return enCurso;

  const tarea = (async () => {
    await cargarCatalogoGuardado();

    const fresco = Date.now() - ultimaActualizacion < VIGENCIA_MS;

    if ((fresco && !forzar) || !estaConectado()) return actual;

    return actualizarCatalogo();
  })().finally(() => {
    if (enCurso === tarea) enCurso = null;
  });

  enCurso = tarea;

  return tarea;
}

function zonaPorNombre(zonas, clave) {
  return zonas.find((zona) => normalizar(zona.nombre) === clave);
}

/**
 * Busca un barrio por nombre, sin distinguir tildes ni mayúsculas, y devuelve su nombre canónico
 * con el centro. Primero en el catálogo vigente y después en el incluido: las publicaciones y
 * alertas guardadas conservan los nombres de siempre aunque el catálogo nuevo ya no los liste.
 * Solo se busca por nombre: unas coordenadas nunca eligen un barrio.
 */
export function buscarZona(nombre, catalogo = actual) {
  if (typeof nombre !== 'string') return undefined;

  const clave = normalizar(nombre);

  if (!clave) return undefined;

  return zonaPorNombre(catalogo.zonas, clave) ?? zonaPorNombre(ZONAS, clave);
}

/**
 * Barrios que ofrece un formulario: los del catálogo, más el barrio histórico ya elegido si el
 * catálogo vigente ya no lo lista (para que una publicación o búsqueda guardada se pueda ver).
 */
export function opcionesZona(catalogo, seleccionada = '') {
  const zonas = catalogo.zonas;
  const clave = typeof seleccionada === 'string' ? normalizar(seleccionada) : '';

  if (!clave || zonaPorNombre(zonas, clave)) return zonas;

  const historica = zonaPorNombre(ZONAS, clave);

  return historica ? [...zonas, historica] : zonas;
}

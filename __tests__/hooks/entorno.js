// Utilidades compartidas por las pruebas de hooks y pantallas (no es una prueba: Jest solo
// ejecuta los archivos *.test.js). Complementan los dobles globales de jest.setup.js.
import { AppState } from 'react-native';
import * as conexion from '../../services/conexion';

/**
 * Promesa que se resuelve o rechaza a mano, para decidir cuándo «responde» la API
 * y así probar respuestas tardías sin red ni temporizadores reales.
 */
export function diferida() {
  const d = {};
  d.promesa = new Promise((resolver, rechazar) => {
    d.resolver = resolver;
    d.rechazar = rechazar;
  });
  return d;
}

let descriptorOriginal = null;

function fijarEstadoActual(valor) {
  if (!descriptorOriginal) {
    descriptorOriginal = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  }
  Object.defineProperty(AppState, 'currentState', {
    configurable: true, writable: true, value: valor,
  });
}

/**
 * Reemplaza AppState por un doble controlable: `emitir('background' | 'active')` dispara el
 * evento «change» y `suscripciones()` indica cuántos oyentes siguen activos (los que no se
 * dieron de baja con `remove`). Hay que llamar a `restaurarAppState()` en afterEach.
 */
export function controlarAppState(estadoInicial = 'active') {
  const oyentes = new Set();
  fijarEstadoActual(estadoInicial);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((evento, oyente) => {
    if (evento === 'change') oyentes.add(oyente);
    return { remove: () => oyentes.delete(oyente) };
  });
  return {
    emitir(valor) {
      fijarEstadoActual(valor);
      [...oyentes].forEach((oyente) => oyente(valor));
    },
    suscripciones: () => oyentes.size,
  };
}

/** Devuelve `AppState.currentState` a su valor original (los espías los restaura jest). */
export function restaurarAppState() {
  if (!descriptorOriginal) return;
  Object.defineProperty(AppState, 'currentState', descriptorOriginal);
  descriptorOriginal = null;
}

/** Fija la conectividad que ven hooks y pantallas (estado compartido de services/conexion). */
export function simularConectividad(hayConexion) {
  jest.spyOn(conexion, 'estaConectado').mockReturnValue(hayConexion);
  jest.spyOn(conexion, 'verificarConexion').mockResolvedValue(hayConexion);
}

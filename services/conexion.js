import { isAxiosError, isCancel } from 'axios';
import { AppState } from 'react-native';
import { api } from './api';

// Espera máxima de cada ping al backend y cada cuánto se repite con la app en primer plano.
const TIMEOUT_PING_MS = 3000;
const INTERVALO_SONDEO_MS = 12000;

// Estado compartido: "disponible" significa que el backend es alcanzable desde
// el dispositivo (no que haya salida a internet en general). Arranca en true
// hasta el primer chequeo para no mostrar avisos falsos al abrir la app.
let disponible = true;
let pingEnCurso = null;
const oyentes = new Set();

function actualizar(valor) {
  if (valor === disponible) return;
  disponible = valor;
  oyentes.forEach((oyente) => oyente(valor));
}

/**
 * Último estado conocido de disponibilidad del backend (lectura sin red).
 * Es lo que deben consultar los demás módulos en lugar de hacer su propio chequeo.
 */
export function estaConectado() {
  return disponible;
}

/**
 * Suscribe un oyente a los cambios de disponibilidad. Devuelve la función para desuscribirse.
 */
export function suscribirConexion(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/**
 * Indica si un error de axios corresponde a falta de conectividad o backend inalcanzable
 * (sin respuesta, timeout, red). Un error HTTP con respuesta (404, 401, 500...) no lo es.
 */
export function esErrorDeConectividad(error) {
  return isAxiosError(error) && !error.response && !isCancel(error);
}

/**
 * Registra que una petición real falló por conectividad, para reflejarlo
 * enseguida sin esperar al próximo sondeo.
 */
export function reportarFalloConexion() {
  actualizar(false);
}

/**
 * Comprueba que el backend responda, con un GET liviano a un endpoint público.
 * Cualquier respuesta HTTP cuenta como alcanzable; solo la falta de respuesta
 * (red caída, modo avión, timeout) marca el estado como sin conexión.
 * Si ya hay un chequeo en curso, se reutiliza su promesa.
 */
export function verificarConexion() {
  if (pingEnCurso) return pingEnCurso;

  pingEnCurso = (async () => {
    let alcanzable;
    try {
      // Authorization: false evita enviar el token de sesión en un ping público
      await api.get('/categorias', {
        timeout: TIMEOUT_PING_MS,
        headers: { Authorization: false },
      });
      alcanzable = true;
    } catch (error) {
      alcanzable = Boolean(error?.response);
    }
    actualizar(alcanzable);
    return alcanzable;
  })().finally(() => {
    pingEnCurso = null;
  });

  return pingEnCurso;
}

function enPrimerPlano(estado) {
  return estado !== 'background' && estado !== 'inactive';
}

/**
 * Inicia el sondeo periódico del backend, solo mientras la app está en primer plano.
 * Al volver a primer plano comprueba de inmediato. Devuelve la función para detenerlo.
 */
export function iniciarSondeo() {
  let intervalo = null;

  // Una petición real que falla por conectividad no espera al próximo sondeo: comprueba ya,
  // así los avisos y los botones bloqueados reflejan la falta de conexión enseguida.
  // Si el que falló es el propio ping, verificarConexion reutiliza el que está en curso.
  const interceptor = api.interceptors.response.use(undefined, (error) => {
    if (esErrorDeConectividad(error)) verificarConexion();
    return Promise.reject(error);
  });

  const arrancar = () => {
    if (intervalo) return;
    verificarConexion();
    intervalo = setInterval(verificarConexion, INTERVALO_SONDEO_MS);
  };

  const detener = () => {
    if (!intervalo) return;
    clearInterval(intervalo);
    intervalo = null;
  };

  if (enPrimerPlano(AppState.currentState)) arrancar();

  const suscripcion = AppState.addEventListener('change', (estado) => {
    if (enPrimerPlano(estado)) arrancar();
    else detener();
  });

  return () => {
    api.interceptors.response.eject(interceptor);
    suscripcion.remove();
    detener();
  };
}

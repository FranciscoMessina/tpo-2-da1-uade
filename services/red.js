import * as Network from 'expo-network';

// Estado de la red del dispositivo (no del backend). Sirve para distinguir «no hay internet»
// de «hay internet pero el servidor no responde», y para enterarse al instante de que se
// cortó la red (modo avión, sin señal) sin esperar al timeout de una petición.
//
// Solo se usa `isConnected`: `isInternetReachable` es falso en redes sin salida a internet
// (una Wi-Fi local, un portal cautivo) aunque el backend sea alcanzable, y bloquearía la app
// sin motivo. Ese caso lo resuelve el ping al backend (services/conexion.js).
//
// Arranca en true hasta la primera lectura para no mostrar avisos falsos al abrir la app.
let hayRed = true;
const oyentes = new Set();

function fijar(valor) {
  if (valor === hayRed) return;
  hayRed = valor;
  oyentes.forEach((oyente) => oyente(valor));
}

function conectada(estado) {
  return estado?.isConnected !== false;
}

/** Último estado conocido de la red del dispositivo (lectura sin consultar nada). */
export function hayInternet() {
  return hayRed;
}

/** Suscribe un oyente a los cambios de la red. Devuelve la función para desuscribirse. */
export function suscribirRed(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/**
 * Lee el estado actual y escucha los cambios del sistema. Devuelve la función para detenerlo.
 * Si el módulo nativo falla, la app sigue con el ping al backend como única fuente.
 */
export function iniciarMonitorRed() {
  let activo = true;
  // Un evento del sistema siempre es más reciente que una lectura que todavía no resolvió:
  // si llegó alguno, esa lectura quedó vieja y no debe pisarlo. Pertenece a cada monitor.
  let huboEvento = false;

  Network.getNetworkStateAsync()
    .then((estado) => {
      if (activo && !huboEvento) fijar(conectada(estado));
    })
    .catch(() => {});

  let suscripcion = null;
  try {
    suscripcion = Network.addNetworkStateListener((estado) => {
      if (!activo) return;
      huboEvento = true;
      fijar(conectada(estado));
    });
  } catch {
    suscripcion = null;
  }

  return () => {
    activo = false;
    suscripcion?.remove();
  };
}

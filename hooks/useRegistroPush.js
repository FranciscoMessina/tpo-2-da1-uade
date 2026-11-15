import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ESTADOS_REINTENTABLES,
  establecerCuentaPush,
  obtenerEstadoRegistroPush,
  obtenerYRegistrarTokenPush,
  suscribirEstadoRegistroPush,
} from '../services/notificacionesPush';
import { suscribirConexion } from '../services/conexion';

// Espera antes de reintentar un registro que el servidor no confirmó: se duplica en cada intento
export const ESPERA_INICIAL_MS = 30000;
export const ESPERA_MAXIMA_MS = 5 * 60000;

/**
 * Mantiene registrado el token push de la sesión actual. Registra al ingresar y reintenta cuando
 * el servidor no lo confirmó (con espera creciente), cuando vuelve la conexión, cuando la app
 * vuelve a primer plano (p. ej. tras habilitar el permiso en Ajustes) y cuando el sistema renueva
 * el token del dispositivo. Al cerrar sesión o cambiar de cuenta descarta lo de la anterior.
 */
export default function useRegistroPush(usuarioId) {
  useEffect(() => {
    const cuenta = usuarioId ?? null;
    establecerCuentaPush(cuenta);
    if (!cuenta) return undefined;

    let activo = true;
    let temporizador = null;
    let espera = ESPERA_INICIAL_MS;

    function programarReintento(resultado) {
      clearTimeout(temporizador);
      temporizador = null;
      if (!activo) return;
      if (resultado?.estado === 'registrado') {
        espera = ESPERA_INICIAL_MS;
        return;
      }
      if (resultado?.estado !== 'error_servidor') return;
      temporizador = setTimeout(() => intentar({ pedirPermiso: false }), espera);
      espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
    }

    function intentar(opciones) {
      if (!activo) return;
      obtenerYRegistrarTokenPush(opciones).then(programarReintento, () => {});
    }

    intentar({ pedirPermiso: true });

    const reintentable = () => ESTADOS_REINTENTABLES.has(obtenerEstadoRegistroPush().estado);

    const desuscribirConexion = suscribirConexion((disponible) => {
      if (disponible && obtenerEstadoRegistroPush().estado === 'error_servidor') {
        espera = ESPERA_INICIAL_MS;
        intentar({ pedirPermiso: false });
      }
    });

    const suscripcionApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && reintentable()) intentar({ pedirPermiso: false });
    });

    // El token de Expo deriva del token nativo: si este cambia, se vuelve a pedir y registrar.
    // Pedir el token también emite este evento con el mismo valor: solo un valor distinto cuenta.
    let suscripcionToken = null;
    let ultimoTokenDispositivo = null;
    try {
      suscripcionToken = Notifications.addPushTokenListener?.((token) => {
        const valor = token?.data ?? null;
        if (!valor || valor === ultimoTokenDispositivo) return;
        ultimoTokenDispositivo = valor;
        intentar({ pedirPermiso: false });
      }) ?? null;
    } catch {
      suscripcionToken = null;
    }

    return () => {
      activo = false;
      clearTimeout(temporizador);
      desuscribirConexion();
      suscripcionApp.remove();
      suscripcionToken?.remove();
    };
  }, [usuarioId]);
}

/** Estado del registro push para mostrarlo en pantalla. */
export function useEstadoRegistroPush() {
  return useSyncExternalStore(suscribirEstadoRegistroPush, obtenerEstadoRegistroPush);
}

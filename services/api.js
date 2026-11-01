import { create } from 'axios';
import { hayInternet } from './red';

// Expo reemplaza process.env.EXPO_PUBLIC_API_URL al empaquetar (ver .env.example).
// Si no está definida, se usa el backend del emulador Android.
export const API_URL = (
  (process.env.EXPO_PUBLIC_API_URL ?? '').trim() || 'http://10.0.2.2:3000'
).replace(/\/+$/, '');

export const api = create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

export function setupInterceptors(alExpirarSesion) {
  const id = api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const headers = error.config?.headers;
      const enviado =
        headers?.get?.('Authorization') ?? headers?.Authorization;
      const actual = api.defaults.headers.common.Authorization;

      const sesionInvalida =
        error.response?.status === 401 &&
        error.response?.data?.error?.code === 'INVALID_SESSION';

      if (sesionInvalida && actual && enviado === actual) {
        await alExpirarSesion();
      }

      return Promise.reject(error);
    }
  );

  return () => api.interceptors.response.eject(id);
}

// Cuando no hay respuesta del servidor hay dos causas con el mismo efecto para quien usa la
// app pero distinto remedio: el dispositivo sin red, o la red bien y el servidor caído. Toda la
// app usa estos dos mensajes y la interfaz los reconoce (motivoSinConexion) para mostrarlos como
// aviso de conexión y no como error.
export const MENSAJE_SIN_INTERNET = 'Sin conexión a internet. Revisá tu red e intentá de nuevo.';
export const MENSAJE_SERVIDOR_NO_DISPONIBLE =
  'No pudimos conectar con el servidor. Probá de nuevo en unos minutos.';

/** 'internet' | 'servidor' si el texto contiene un aviso de conexión; null si es otra cosa. */
export function motivoSinConexion(mensaje) {
  if (typeof mensaje !== 'string') return null;
  if (mensaje.includes(MENSAJE_SIN_INTERNET)) return 'internet';
  if (mensaje.includes(MENSAJE_SERVIDOR_NO_DISPONIBLE)) return 'servidor';
  return null;
}

export function esMensajeSinConexion(mensaje) {
  return motivoSinConexion(mensaje) !== null;
}

export function mensajeErrorApi(error) {
  const mensaje = error?.response?.data?.error?.message;

  if (typeof mensaje === 'string' && mensaje.trim()) {
    return mensaje;
  }

  if (
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT'
  ) {
    return 'El servidor tardó demasiado en responder. Intentá nuevamente.';
  }

  if (!error?.response) {
    return hayInternet() ? MENSAJE_SERVIDOR_NO_DISPONIBLE : MENSAJE_SIN_INTERNET;
  }

  return 'No pudimos completar la solicitud. Intentá nuevamente.';
}
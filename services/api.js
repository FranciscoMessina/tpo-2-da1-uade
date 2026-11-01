import { create } from 'axios';

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

// Mensaje único cuando no hay respuesta del servidor: lo usa toda la app y la interfaz lo
// reconoce (esMensajeSinConexion) para mostrarlo como aviso de conexión y no como error.
export const MENSAJE_SIN_CONEXION = 'Sin conexión. Revisá tu internet e intentá de nuevo.';

export function esMensajeSinConexion(mensaje) {
  return typeof mensaje === 'string' && mensaje.includes(MENSAJE_SIN_CONEXION);
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
    return MENSAJE_SIN_CONEXION;
  }

  return 'No pudimos completar la solicitud. Intentá nuevamente.';
}
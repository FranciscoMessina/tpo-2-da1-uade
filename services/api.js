import axios from 'axios';

export const API_URL = 'http://10.0.2.2:3000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

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
    return 'No pudimos conectar con el servidor. Revisá que el backend esté funcionando.';
  }

  return 'No pudimos completar la solicitud. Intentá nuevamente.';
}
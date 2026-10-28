import { api } from './api';

/**
 * Comprueba si el dispositivo tiene salida real a internet y conexión con el backend.
 * Al consultar un endpoint público ligero de conectividad (generate_204),
 * detecta de inmediato si el usuario activó el Modo Avión o apagó Wi-Fi/Datos móviles en Android.
 */
export async function verificarConexion() {
  // 1. Probar conectividad exterior (falla al instante en Modo Avión)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (res.status !== 204 && res.status !== 200) {
      return false;
    }
  } catch {
    // Si falla el ping al exterior (Modo Avión activo), no hay internet
    return false;
  }

  // 2. Verificar que además el backend responda
  try {
    await api.get('/categorias', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

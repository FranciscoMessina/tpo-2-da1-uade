import * as SecureStore from 'expo-secure-store';

const CLAVE_TOKEN = 'hallado.session.token';
// Perfil mínimo del último inicio exitoso: permite reabrir la app sin conexión
// y leer la caché de esa cuenta. Vive junto al token y se borra con él.
const CLAVE_PERFIL = 'hallado.session.perfil';

export async function guardarToken(token) {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function leerToken() {
  return await SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function borrarToken() {
  // El perfil se borra primero y sin bloquear: si falla, igual se intenta borrar el token
  await borrarPerfilMinimo();
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}

/**
 * Reduce al usuario a lo indispensable para identificar la cuenta sin conexión
 * (id y nombre). No incluye email, teléfono ni ningún otro dato del perfil.
 */
export function perfilMinimo(usuario) {
  if (!usuario || usuario.id === undefined || usuario.id === null) return null;
  return { id: usuario.id, name: typeof usuario.name === 'string' ? usuario.name : '' };
}

/** Interpreta lo guardado; devuelve null si no es un perfil mínimo válido. */
export function interpretarPerfilMinimo(texto) {
  try {
    return perfilMinimo(JSON.parse(texto));
  } catch {
    return null;
  }
}

export async function guardarPerfilMinimo(usuario) {
  const perfil = perfilMinimo(usuario);
  if (!perfil) return;

  try {
    await SecureStore.setItemAsync(CLAVE_PERFIL, JSON.stringify(perfil));
  } catch {
    // Mejor sin perfil que con el de otra cuenta: sin él, reabrir sin conexión pide ingresar
    await borrarPerfilMinimo();
  }
}

export async function leerPerfilMinimo() {
  try {
    const texto = await SecureStore.getItemAsync(CLAVE_PERFIL);
    return texto ? interpretarPerfilMinimo(texto) : null;
  } catch {
    return null;
  }
}

export async function borrarPerfilMinimo() {
  try {
    await SecureStore.deleteItemAsync(CLAVE_PERFIL);
  } catch {
    // Sin acción: un perfil huérfano solo se usa junto a un token válido
  }
}

import * as SecureStore from 'expo-secure-store';

const CLAVE_TOKEN = 'hallado.session.token';

export async function guardarToken(token) {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function leerToken() {
  return await SecureStore.getItemAsync(CLAVE_TOKEN);
}

export async function borrarToken() {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
import * as SecureStore from 'expo-secure-store';
import {
  borrarToken,
  guardarPerfilMinimo,
  guardarToken,
  interpretarPerfilMinimo,
  leerPerfilMinimo,
  leerToken,
  perfilMinimo,
} from '../../services/sesion';

describe('perfilMinimo', () => {
  test('deja solo el id y el nombre', () => {
    const usuario = {
      id: 7,
      name: 'Ana',
      email: 'ana@correo.test',
      phone: '1155551234',
      avatarUrl: '/uploads/a.jpg',
    };

    expect(perfilMinimo(usuario)).toEqual({ id: 7, name: 'Ana' });
  });

  test('un nombre que no es texto queda vacío', () => {
    expect(perfilMinimo({ id: 1, name: 42 })).toEqual({ id: 1, name: '' });
  });

  test('sin usuario o sin id no hay perfil', () => {
    expect(perfilMinimo(null)).toBeNull();
    expect(perfilMinimo(undefined)).toBeNull();
    expect(perfilMinimo({ name: 'Sin id' })).toBeNull();
    expect(perfilMinimo({ id: null, name: 'Sin id' })).toBeNull();
  });

  test('un id 0 es válido', () => {
    expect(perfilMinimo({ id: 0, name: 'Cero' })).toEqual({ id: 0, name: 'Cero' });
  });
});

describe('interpretarPerfilMinimo', () => {
  test('lee un perfil guardado y descarta cualquier campo extra', () => {
    const texto = JSON.stringify({ id: 3, name: 'Beto', email: 'beto@correo.test' });
    expect(interpretarPerfilMinimo(texto)).toEqual({ id: 3, name: 'Beto' });
  });

  test('texto dañado o sin id devuelve null', () => {
    expect(interpretarPerfilMinimo('{roto')).toBeNull();
    expect(interpretarPerfilMinimo('null')).toBeNull();
    expect(interpretarPerfilMinimo(JSON.stringify({ name: 'Sin id' }))).toBeNull();
  });
});

describe('almacenamiento de la sesión', () => {
  test('el perfil guardado no incluye datos de contacto', async () => {
    await guardarPerfilMinimo({ id: 5, name: 'Carla', email: 'c@correo.test', phone: '1100000000' });

    const [, guardado] = SecureStore.setItemAsync.mock.calls.at(-1);
    expect(guardado).not.toContain('c@correo.test');
    expect(guardado).not.toContain('1100000000');
    expect(await leerPerfilMinimo()).toEqual({ id: 5, name: 'Carla' });
  });

  test('borrar el token también borra el perfil', async () => {
    await guardarToken('token-123');
    await guardarPerfilMinimo({ id: 5, name: 'Carla' });
    expect(await leerToken()).toBe('token-123');

    await borrarToken();

    expect(await leerToken()).toBeNull();
    expect(await leerPerfilMinimo()).toBeNull();
  });

  test('si el perfil no se puede guardar, no queda el de otra cuenta', async () => {
    await guardarPerfilMinimo({ id: 1, name: 'Vieja' });
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('sin espacio'));

    await guardarPerfilMinimo({ id: 2, name: 'Nueva' });

    expect(await leerPerfilMinimo()).toBeNull();
  });

  test('si falla la lectura, no hay perfil', async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('keystore'));
    expect(await leerPerfilMinimo()).toBeNull();
  });
});

import { api, API_URL } from './api';

const BASE_URL = API_URL.replace(/\/+$/, '');

function prepararPerfil(perfil) {
  return {
    ...perfil,
    avatarUrl: perfil.avatarUrl?.startsWith('/')
      ? `${BASE_URL}${perfil.avatarUrl}`
      : perfil.avatarUrl || null,
  };
}

async function prepararAvatar(uri) {
  if (!uri) return null;

  if (uri.startsWith(`${BASE_URL}/uploads/`)) {
    return uri.slice(BASE_URL.length);
  }

  if (uri.startsWith('/uploads/')) return uri;

  if (!/^(file|content):\/\//i.test(uri)) {
    throw new Error('Seleccioná una foto desde el dispositivo.');
  }

  const extension =
    uri.match(/\.(png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'jpg';

  const formulario = new FormData();

  formulario.append('file', {
    uri,
    name: `perfil.${extension}`,
    type: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
  });

  const { data } = await api.post('/uploads/images', formulario);
  return data.url;
}

export async function obtenerPerfil() {
  const { data } = await api.get('/me');
  return prepararPerfil(data);
}

export async function actualizarPerfil(cambios) {
  const datos = {};
  const campos = ['name', 'zone', 'phone', 'sharePhone'];

  for (const campo of campos) {
    if (cambios[campo] !== undefined) {
      datos[campo] = cambios[campo];
    }
  }

  if (cambios.avatarUrl !== undefined) {
    datos.avatarUrl = await prepararAvatar(cambios.avatarUrl);
  }

  const { data } = await api.patch('/me', datos);
  return prepararPerfil(data);
}

export async function obtenerPerfilPublico(usuarioId) {
  if (!usuarioId) {
    throw new Error('No se indicó el usuario a consultar.');
  }

  const { data } = await api.get(
    `/usuarios/${encodeURIComponent(usuarioId)}`
  );

  return prepararPerfil(data);
}
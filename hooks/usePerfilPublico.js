import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERFIL_INICIAL, PERFIL_STORAGE_KEY } from './usePerfil';

// MOCK: usuarios de prueba. Reemplazar por GET /usuarios/:id en el backend
// (la respuesta pública nunca debe incluir teléfono ni historial).
const USUARIOS_MOCK = {
  u2: {
    id: 'u2',
    name: 'María Gómez',
    zone: 'Nueva Córdoba',
    avatarUrl: null,
    memberSince: '2026-08-15T12:00:00Z',
    reputation: { completedReturns: 12, positiveReviews: 11, negativeReviews: 0 },
    badges: [
      { id: 'vecino-solidario', name: 'Vecino solidario', description: 'Por concretar 5 devoluciones.' },
    ],
  },
  u3: {
    id: 'u3',
    name: 'Carlos Pérez',
    zone: 'Alberdi',
    avatarUrl: null,
    memberSince: '2026-09-20T12:00:00Z',
    reputation: { completedReturns: 1, positiveReviews: 1, negativeReviews: 0 },
    badges: [],
  },
};

function aPublico(u) {
  return {
    id: u.id,
    name: u.name,
    zone: u.zone,
    avatarUrl: u.avatarUrl ?? null,
    memberSince: u.memberSince,
    reputation: u.reputation,
    badges: u.badges ?? [],
  };
}

// usuarioId: id del usuario ('yo' = el propio perfil guardado).
export default function usePerfilPublico(usuarioId) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');

    async function cargar() {
      try {
        let datos = null;
        if (usuarioId === 'yo') {
          const guardado = await AsyncStorage.getItem(PERFIL_STORAGE_KEY);
          datos = guardado
            ? { ...PERFIL_INICIAL, ...JSON.parse(guardado) }
            : PERFIL_INICIAL;
        } else {
          datos = USUARIOS_MOCK[usuarioId] ?? null;
        }
        if (!activo) return;
        if (datos) {
          setUsuario(aPublico(datos));
        } else {
          setUsuario(null);
          setError('No se encontró el usuario.');
        }
      } catch {
        if (activo) setError('No se pudo cargar el perfil.');
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [usuarioId]);

  return { usuario, loading, error };
}

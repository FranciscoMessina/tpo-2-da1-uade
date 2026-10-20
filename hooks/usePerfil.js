import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// MOCK: la clave de AsyncStorage y el perfil inicial reemplazan al backend.
// Para conectar el backend, reemplazar cargar() por GET /me y
// guardarPerfil() por PUT/PATCH /me.
export const PERFIL_STORAGE_KEY = 'hallado:perfil';

export const PERFIL_INICIAL = {
  id: 'yo',
  name: 'Usuario de prueba',
  zone: 'Centro',
  phone: '',
  sharePhone: false,
  avatarUrl: null,
  memberSince: '2026-10-01T12:00:00Z',
  reputation: {
    completedReturns: 5,
    positiveReviews: 4,
    negativeReviews: 1,
  },
  badges: [
    {
      id: 'vecino-solidario',
      name: 'Vecino solidario',
      description: 'Por concretar 5 devoluciones.',
    },
  ],
};

export default function usePerfil() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const guardado = await AsyncStorage.getItem(PERFIL_STORAGE_KEY);
        const datos = guardado
          ? { ...PERFIL_INICIAL, ...JSON.parse(guardado) }
          : PERFIL_INICIAL;
        if (activo) setPerfil(datos);
      } catch {
        if (activo) {
          setPerfil(PERFIL_INICIAL);
          setError('No se pudo cargar el perfil.');
        }
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Recibe los campos editables (name, zone, phone, sharePhone, avatarUrl).
  // Devuelve true si se guardó correctamente.
  const guardarPerfil = useCallback(
    async (cambios) => {
      try {
        const nuevo = { ...(perfil ?? PERFIL_INICIAL), ...cambios };
        await AsyncStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(nuevo));
        setPerfil(nuevo);
        setError('');
        return true;
      } catch {
        setError('No se pudo guardar el perfil. Intentá nuevamente.');
        return false;
      }
    },
    [perfil]
  );

  return { perfil, loading, error, guardarPerfil };
}

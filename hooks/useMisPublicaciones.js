import { useCallback, useEffect, useState } from 'react';
import { tablaPublicaciones } from '../data/misPublicacionesDemo';

// Lista las publicaciones del usuario actual.
// BACKEND: reemplazar el cuerpo de `cargar` por un fetch (p. ej. GET /mis-publicaciones).
export default function useMisPublicaciones() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      await new Promise((resolver) => setTimeout(resolver, 300));
      setPublicaciones(tablaPublicaciones.map((p) => ({ ...p })));
    } catch {
      setError('No se pudieron cargar tus publicaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { publicaciones, loading, error, recargar: cargar };
}

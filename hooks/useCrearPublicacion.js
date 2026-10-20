import { useCallback, useState } from 'react';

// MOCK: reemplazar el cuerpo de `publicar` por un POST al backend
// (multipart con las fotos). Hoy simula latencia y devuelve un id local.
export default function useCrearPublicacion() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const publicar = useCallback(async (datos) => {
    setEnviando(true);
    setError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 900));

      return {
        id: `pub-${Date.now()}`,
        ...datos,
        creadaEn: new Date().toISOString(),
      };
    } catch (e) {
      setError('No pudimos publicar. Intentá de nuevo.');
      return null;
    } finally {
      setEnviando(false);
    }
  }, []);

  return { publicar, enviando, error };
}

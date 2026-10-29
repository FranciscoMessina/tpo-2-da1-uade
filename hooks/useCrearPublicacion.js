import { useCallback, useRef, useState } from 'react';
import {
  esErrorDeConectividad,
  reportarFalloConexion,
} from '../services/conexion';
import {
  crearPublicacion,
  generarClientId,
  mensajeErrorPublicacion,
} from '../services/publicaciones';

// Crea la publicación en el backend (fotos + POST /publicaciones).
// El clientId y las fotos ya subidas se conservan entre reintentos del mismo formulario
// para no duplicar la publicación ni volver a subir las imágenes.
export default function useCrearPublicacion() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const clientId = useRef(null);
  const fotosSubidas = useRef(new Map());
  const enCurso = useRef(false);

  const publicar = useCallback(async (datos) => {
    if (enCurso.current) return null;
    enCurso.current = true;

    setEnviando(true);
    setError('');

    if (!clientId.current) clientId.current = generarClientId();

    try {
      const publicacion = await crearPublicacion(datos, {
        clientId: clientId.current,
        fotosSubidas: fotosSubidas.current,
      });

      // Alta confirmada: un próximo formulario es otra publicación
      clientId.current = null;
      fotosSubidas.current = new Map();

      return publicacion;
    } catch (e) {
      if (esErrorDeConectividad(e)) reportarFalloConexion();
      setError(mensajeErrorPublicacion(e));
      return null;
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }, []);

  return { publicar, enviando, error };
}

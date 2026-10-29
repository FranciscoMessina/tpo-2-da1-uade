import { useCallback, useRef, useState } from 'react';
import useAuth from './useAuth';
import { useColaPublicaciones } from '../context/ColaPublicacionesContext';
import {
  esErrorDeConectividad,
  reportarFalloConexion,
} from '../services/conexion';
import {
  actualizarEnCola,
  descartarDeCola,
  encolarPublicacion,
} from '../services/colaPublicaciones';
import {
  crearPublicacion,
  generarClientId,
  mensajeErrorPublicacion,
} from '../services/publicaciones';

// Crea la publicación en el backend (fotos + POST /publicaciones) o, sin conexión, la deja
// en la cola persistente para que se envíe sola al volver la red.
// El clientId y las fotos ya subidas se conservan entre reintentos del mismo formulario
// (y también al encolar o retomar un borrador) para no duplicar la publicación ni volver
// a subir las imágenes.
//
// `pendienteId`: si el formulario edita un ítem con error de la cola, al publicar se quita
// de la cola y al guardar para después se actualiza ese mismo ítem.
// `alSubirFoto`: se avisa cada vez que una foto termina de subirse, para persistir el avance.
export default function useCrearPublicacion({ pendienteId = null, alSubirFoto = undefined } = {}) {
  const { usuario } = useAuth();
  const { procesarAhora } = useColaPublicaciones();
  const uid = usuario?.id !== undefined && usuario?.id !== null ? String(usuario.id) : null;

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [encolada, setEncolada] = useState(false);
  const clientId = useRef(null);
  const fotosSubidas = useRef(new Map());
  const enCurso = useRef(false);

  // El identificador se crea al empezar el formulario, no al primer envío: así un borrador
  // guardado antes de publicar ya lleva el mismo id que se usará después.
  if (!clientId.current) clientId.current = generarClientId();

  /** Continúa un intento anterior (borrador retomado o ítem de la cola) con su mismo id y fotos subidas. */
  const usarEnvio = useCallback((id, subidas = {}) => {
    if (id) clientId.current = id;
    fotosSubidas.current = new Map(Object.entries(subidas || {}));
  }, []);

  /** Estado del intento en curso, para guardarlo en el borrador. */
  const obtenerEnvio = useCallback(
    () => ({
      clientId: clientId.current,
      fotosSubidas: Object.fromEntries(fotosSubidas.current),
    }),
    []
  );

  const publicar = useCallback(
    async (datos) => {
      if (enCurso.current) return null;
      enCurso.current = true;

      setEnviando(true);
      setError('');

      try {
        const publicacion = await crearPublicacion(datos, {
          clientId: clientId.current,
          fotosSubidas: fotosSubidas.current,
          alSubirFoto,
        });

        // Si se estaba reintentando un ítem de la cola, ya no hace falta conservarlo
        if (pendienteId && uid) await descartarDeCola(uid, pendienteId).catch(() => {});

        // Alta confirmada: un próximo formulario es otra publicación
        clientId.current = generarClientId();
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
    },
    [alSubirFoto, pendienteId, uid]
  );

  /** Guarda la publicación en la cola de la cuenta. Devuelve true si quedó guardada. */
  const guardarParaDespues = useCallback(
    async (datos) => {
      if (enCurso.current) return false;
      enCurso.current = true;

      setEnviando(true);
      setError('');

      try {
        const envio = obtenerEnvio();
        if (pendienteId) await actualizarEnCola(uid, pendienteId, { datos, ...envio });
        else await encolarPublicacion(uid, { datos, ...envio });

        clientId.current = generarClientId();
        fotosSubidas.current = new Map();
        setEncolada(true);

        // Si la conexión ya volvió, sale enseguida; si no, lo hará el procesador al recuperarla
        procesarAhora();
        return true;
      } catch (e) {
        setError(mensajeErrorPublicacion(e));
        return false;
      } finally {
        enCurso.current = false;
        setEnviando(false);
      }
    },
    [obtenerEnvio, pendienteId, procesarAhora, uid]
  );

  return {
    publicar,
    guardarParaDespues,
    usarEnvio,
    obtenerEnvio,
    enviando,
    error,
    encolada,
  };
}

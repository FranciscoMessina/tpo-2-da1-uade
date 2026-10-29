import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  copiarFotoABorrador,
  descartarBorrador,
  guardarBorrador,
  leerBorrador,
  quitarFotoDeBorrador,
} from '../services/borradores';

// Tiempo sin cambios en el formulario antes de guardar el borrador
const ESPERA_GUARDADO_MS = 800;

/**
 * Borrador automático del formulario de alta, uno por cuenta.
 *
 * Al abrir carga el borrador guardado (`existente`) y no guarda nada hasta que el usuario
 * decide: `retomar()` lo usa como punto de partida y `descartar()` lo elimina.
 * Desde entonces `guardar(valores)` lo actualiza con espera (debounce), y también se guarda
 * al pasar la app a segundo plano o al salir de la pantalla. `finalizar()` borra el borrador
 * y detiene el guardado automático (se llama al publicar o al encolar).
 *
 * `obtenerEnvio()` devuelve `{ clientId, fotosSubidas }` del intento de alta en curso,
 * para guardarlos junto a los campos.
 */
export default function useBorradorPublicacion(uid, { obtenerEnvio } = {}) {
  const [cargando, setCargando] = useState(true);
  const [existente, setExistente] = useState(null);
  const decidido = useRef(false);
  const terminado = useRef(false);
  const pendiente = useRef(null);
  const ultimos = useRef(null);
  const temporizador = useRef(null);
  const envioRef = useRef(obtenerEnvio);
  envioRef.current = obtenerEnvio;

  useEffect(() => {
    let activo = true;
    decidido.current = false;
    terminado.current = false;

    leerBorrador(uid).then((registro) => {
      if (!activo) return;
      decidido.current = !registro;
      setExistente(registro);
      setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [uid]);

  const persistir = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = null;

    const valores = pendiente.current;
    pendiente.current = null;
    if (!valores || !uid || terminado.current || !decidido.current) return Promise.resolve();

    const envio = envioRef.current?.() || {};
    return guardarBorrador(uid, { valores, ...envio }).catch(() => {});
  }, [uid]);

  const guardar = useCallback(
    (valores) => {
      if (terminado.current || !decidido.current) return;

      pendiente.current = valores;
      ultimos.current = valores;
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(persistir, ESPERA_GUARDADO_MS);
    },
    [persistir]
  );

  // Fuerza el guardado del último estado conocido (p. ej. tras subir una foto al servidor)
  const guardarAhora = useCallback(() => {
    pendiente.current = ultimos.current;
    return persistir();
  }, [persistir]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') persistir();
    });

    return () => {
      suscripcion.remove();
      // Al salir de la pantalla no se pierde lo último que se escribió
      persistir();
    };
  }, [persistir]);

  const retomar = useCallback(() => {
    decidido.current = true;
    const registro = existente;
    setExistente(null);
    return registro;
  }, [existente]);

  const descartar = useCallback(async () => {
    decidido.current = true;
    pendiente.current = null;
    ultimos.current = null;
    clearTimeout(temporizador.current);
    setExistente(null);
    await descartarBorrador(uid);
  }, [uid]);

  const finalizar = useCallback(async () => {
    terminado.current = true;
    pendiente.current = null;
    ultimos.current = null;
    clearTimeout(temporizador.current);
    await descartarBorrador(uid);
  }, [uid]);

  const copiarFoto = useCallback((uri) => copiarFotoABorrador(uid, uri), [uid]);
  const quitarFoto = useCallback((uri) => quitarFotoDeBorrador(uid, uri), [uid]);

  return {
    cargando,
    existente,
    guardar,
    guardarAhora,
    retomar,
    descartar,
    finalizar,
    copiarFoto,
    quitarFoto,
  };
}

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useConexion } from '../context/ConexionContext';

export const INTERVALO_ACTUALIZACION_MS = 20000;

function enPrimerPlano(estado) {
  return estado !== 'background' && estado !== 'inactive';
}

/**
 * Dispara `alActualizar` cada 20 s mientras la pantalla está enfocada, la app activa y hay
 * conexión; y de inmediato al volver al primer plano o al recuperar la conexión. Con la
 * pantalla sin foco, la app en segundo plano o sin conexión no dispara nada. Cambiar de
 * `alcance` (p. ej. la cuenta) reinicia el ciclo.
 *
 * Solo programa los disparos: quien lo usa decide cómo consultar (cancelar, evitar
 * peticiones superpuestas y descartar respuestas tardías). La carga al enfocar la pantalla
 * sigue siendo responsabilidad de quien lo usa.
 *
 * @param {() => void} alActualizar
 * @param {{ alcance?: unknown, intervaloMs?: number }} [opciones]
 */
export default function useActualizacionVisible(
  alActualizar,
  { alcance = null, intervaloMs = INTERVALO_ACTUALIZACION_MS } = {}
) {
  const enFoco = useIsFocused();
  const { hayConexion } = useConexion();
  const [appActiva, setAppActiva] = useState(() => enPrimerPlano(AppState.currentState));
  const accion = useRef(alActualizar);
  const previo = useRef({ appActiva, hayConexion });
  const visible = enFoco && appActiva && hayConexion;

  useEffect(() => {
    accion.current = alActualizar;
  }, [alActualizar]);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      setAppActiva(enPrimerPlano(estado));
    });
    return () => suscripcion.remove();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const intervalo = setInterval(() => accion.current(), intervaloMs);
    return () => clearInterval(intervalo);
  }, [visible, alcance, intervaloMs]);

  useEffect(() => {
    const anterior = previo.current;
    previo.current = { appActiva, hayConexion };
    const volvio = appActiva && !anterior.appActiva;
    const reconecto = hayConexion && !anterior.hayConexion;
    if (visible && (volvio || reconecto)) accion.current();
  }, [appActiva, hayConexion, visible]);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  leerBiometriaActiva,
  verificarDisponibilidadBiometrica,
} from './useConfiguracion';
import { hayActividadExterna } from '../services/actividadExterna';
import { ejecutarNavegacionPendiente } from '../services/notificacionesPush';

// Hasta leer la configuración no se sabe si hay bloqueo: se asume bloqueada para no navegar detrás
let sesionBloqueadaActual = true;

export function estaSesionBloqueada() {
  return sesionBloqueadaActual;
}

export default function useBloqueoBiometrico() {
  const [bloqueado, setBloqueado] = useState(true);
  const [autenticando, setAutenticando] = useState(false);
  const [error, setError] = useState('');
  const enCurso = useRef(false);

  const desbloquear = useCallback(async () => {
    if (enCurso.current) return;

    enCurso.current = true;
    setBloqueado(true);
    sesionBloqueadaActual = true;
    setAutenticando(true);
    setError('');

    try {
      const disponible = await verificarDisponibilidadBiometrica();

      if (!disponible) {
        setError('Configurá la biometría del dispositivo para desbloquear Hallado.');
        return;
      }

      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloqueá Hallado',
        cancelLabel: 'Cancelar',
      });

      if (resultado.success) {
        setBloqueado(false);
        sesionBloqueadaActual = false;
        ejecutarNavegacionPendiente();
      } else {
        setError('No se pudo verificar tu identidad.');
      }
    } catch {
      setError('Ocurrió un error al verificar la biometría.');
    } finally {
      enCurso.current = false;
      setAutenticando(false);
    }
  }, []);

  const aplicarBloqueo = useCallback(async (activa) => {
    if (!activa) {
      setBloqueado(false);
      sesionBloqueadaActual = false;
      ejecutarNavegacionPendiente();
      setError('');
      return;
    }

    setBloqueado(true);
    sesionBloqueadaActual = true;
    await desbloquear();
  }, [desbloquear]);

  useEffect(() => {
    leerBiometriaActiva().then((activa) => {
      sesionBloqueadaActual = !!activa;
      return aplicarBloqueo(activa);
    }).catch(() => {
      setBloqueado(true);
      sesionBloqueadaActual = true;
      setError('No se pudo leer la configuración de seguridad.');
    });

    let anterior = AppState.currentState;
    // La salida a la cámara o la galería no es una salida de la app: no se vuelve a pedir la huella
    let salidaEsperada = false;

    const sub = AppState.addEventListener('change', async (estado) => {
      const previo = anterior;
      anterior = estado;

      try {
        if (estado === 'background') {
          if (hayActividadExterna()) {
            salidaEsperada = true;
            return;
          }

          if (await leerBiometriaActiva()) {
            setBloqueado(true);
            sesionBloqueadaActual = true;
          }
        } else if (estado === 'active' && previo === 'background') {
          if (salidaEsperada) {
            salidaEsperada = false;
            return;
          }

          await aplicarBloqueo(await leerBiometriaActiva());
        }
      } catch {
        setBloqueado(true);
        sesionBloqueadaActual = true;
        setError('No se pudo leer la configuración de seguridad.');
      }
    });

    return () => sub.remove();
  }, [aplicarBloqueo]);

  return { bloqueado, autenticando, error, desbloquear };
}
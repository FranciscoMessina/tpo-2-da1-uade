import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  leerBiometriaActiva,
  verificarDisponibilidadBiometrica,
} from './useConfiguracion';

export default function useBloqueoBiometrico() {
  const [bloqueado, setBloqueado] = useState(true);
  const [autenticando, setAutenticando] = useState(false);
  const [error, setError] = useState('');
  const enCurso = useRef(false);

  const desbloquear = useCallback(async () => {
    if (enCurso.current) return;

    enCurso.current = true;
    setBloqueado(true);
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
      setError('');
      return;
    }

    setBloqueado(true);
    await desbloquear();
  }, [desbloquear]);

  useEffect(() => {
    leerBiometriaActiva().then(aplicarBloqueo).catch(() => {
      setBloqueado(true);
      setError('No se pudo leer la configuración de seguridad.');
    });

    let anterior = AppState.currentState;

    const sub = AppState.addEventListener('change', async (estado) => {
      const previo = anterior;
      anterior = estado;

      try {
        if (estado === 'background') {
          if (await leerBiometriaActiva()) setBloqueado(true);
        } else if (estado === 'active' && previo === 'background') {
          await aplicarBloqueo(await leerBiometriaActiva());
        }
      } catch {
        setBloqueado(true);
        setError('No se pudo leer la configuración de seguridad.');
      }
    });

    return () => sub.remove();
  }, [aplicarBloqueo]);

  return { bloqueado, autenticando, error, desbloquear };
}
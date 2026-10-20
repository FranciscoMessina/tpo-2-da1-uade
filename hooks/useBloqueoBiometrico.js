import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { leerBiometriaActiva } from './useConfiguracion';

// Bloquea la app al abrirla y al volver de segundo plano si la biometría
// está activada. Devuelve {bloqueado, autenticando, error, desbloquear}.
export default function useBloqueoBiometrico() {
  const [bloqueado, setBloqueado] = useState(true);
  const [autenticando, setAutenticando] = useState(false);
  const [error, setError] = useState('');
  const enCurso = useRef(false);

  const desbloquear = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setAutenticando(true);
    setError('');
    try {
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
      setError('Ocurrió un error al autenticar.');
    } finally {
      enCurso.current = false;
      setAutenticando(false);
    }
  }, []);

  const evaluar = useCallback(async () => {
    const activa = await leerBiometriaActiva();
    if (!activa) {
      setBloqueado(false);
      return;
    }
    setBloqueado(true);
    desbloquear();
  }, [desbloquear]);

  useEffect(() => {
    evaluar();
    let anterior = AppState.currentState;
    const sub = AppState.addEventListener('change', async (estado) => {
      if (estado === 'background') {
        // Se bloquea al salir, antes de volver a mostrarse.
        if (await leerBiometriaActiva()) setBloqueado(true);
      } else if (estado === 'active' && anterior === 'background') {
        evaluar();
      }
      anterior = estado;
    });
    return () => sub.remove();
  }, [evaluar]);

  return { bloqueado, autenticando, error, desbloquear };
}

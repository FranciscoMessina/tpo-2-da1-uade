import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

// MOCK: la preferencia se guarda localmente. Si más adelante se sincroniza
// con el backend, reemplazar la lectura/escritura de AsyncStorage por fetch.
export const BIOMETRIA_STORAGE_KEY = 'hallado:biometriaActiva';

export async function leerBiometriaActiva() {
  try {
    return (await AsyncStorage.getItem(BIOMETRIA_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export default function useConfiguracion() {
  const [biometriaActiva, setBiometriaActiva] = useState(false);
  const [biometriaDisponible, setBiometriaDisponible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const [hardware, enrolado, guardada] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          leerBiometriaActiva(),
        ]);
        if (!activo) return;
        const disponible = hardware && enrolado;
        setBiometriaDisponible(disponible);
        setBiometriaActiva(disponible && guardada);
      } catch {
        if (activo) setError('No se pudo cargar la configuración.');
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Pide autenticación al activar. Devuelve true si el cambio se aplicó.
  const setBiometria = useCallback(
    async (valor) => {
      setError('');
      try {
        if (valor) {
          if (!biometriaDisponible) {
            setError('Tu dispositivo no tiene biometría disponible o configurada.');
            return false;
          }
          const resultado = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Confirmá tu identidad para activar el bloqueo',
            cancelLabel: 'Cancelar',
          });
          if (!resultado.success) {
            setError('No se pudo verificar tu identidad.');
            return false;
          }
        }
        await AsyncStorage.setItem(BIOMETRIA_STORAGE_KEY, String(valor));
        setBiometriaActiva(valor);
        return true;
      } catch {
        setError('No se pudo cambiar la configuración.');
        return false;
      }
    },
    [biometriaDisponible]
  );

  return { biometriaActiva, biometriaDisponible, setBiometria, loading, error };
}

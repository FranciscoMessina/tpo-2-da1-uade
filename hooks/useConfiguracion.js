import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export const BIOMETRIA_STORAGE_KEY = 'hallado:biometriaActiva';

export async function leerBiometriaActiva() {
  return (await AsyncStorage.getItem(BIOMETRIA_STORAGE_KEY)) === 'true';
}

// La preferencia es del dispositivo, no de la cuenta: al salir de la sesión se descarta
// para que la pantalla de ingreso no pida la huella a quien todavía no se identificó.
export async function desactivarBiometria() {
  await AsyncStorage.removeItem(BIOMETRIA_STORAGE_KEY);
}

export async function verificarDisponibilidadBiometrica() {
  const [hardware, enrolado, tipos] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  return hardware && enrolado && tipos.length > 0;
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
        const [disponible, guardada] = await Promise.all([
          verificarDisponibilidadBiometrica(),
          leerBiometriaActiva(),
        ]);

        if (!activo) return;
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

  const setBiometria = useCallback(async (valor) => {
    setError('');

    try {
      if (valor) {
        const disponible = await verificarDisponibilidadBiometrica();
        setBiometriaDisponible(disponible);

        if (!disponible) {
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
  }, []);

  return {
    biometriaActiva,
    biometriaDisponible,
    setBiometria,
    loading,
    error,
  };
}
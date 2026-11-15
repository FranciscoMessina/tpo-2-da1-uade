import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  activarRespaldo,
  desactivarRespaldo,
  leerEstadoRespaldo,
} from '../services/respaldoSegundoPlano';

/**
 * Da de alta el respaldo en segundo plano para la cuenta con sesión y lo da de baja al salir.
 * Mientras se restaura la sesión no toca nada: dar de baja y volver a registrar reiniciaría la
 * espera del sistema en cada apertura.
 */
export default function useRespaldoSegundoPlano(usuarioId, restaurando) {
  useEffect(() => {
    if (restaurando) return;
    if (usuarioId !== null && usuarioId !== undefined) activarRespaldo(usuarioId).catch(() => {});
    else desactivarRespaldo().catch(() => {});
  }, [usuarioId, restaurando]);
}

/** Estado del respaldo para Configuración. Se relee al volver a primer plano. */
export function useEstadoRespaldo() {
  const [estado, setEstado] = useState(null);

  const recargar = useCallback(() => {
    let activo = true;
    leerEstadoRespaldo().then((valor) => {
      if (activo) setEstado(valor);
    }, () => {});
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    const cancelar = recargar();
    const suscripcion = AppState.addEventListener('change', (valor) => {
      if (valor === 'active') recargar();
    });
    return () => {
      cancelar();
      suscripcion.remove();
    };
  }, [recargar]);

  return { estado, recargar };
}

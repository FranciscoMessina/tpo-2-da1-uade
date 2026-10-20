import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

// Estados: 'inactivo' | 'solicitando' | 'obteniendo' | 'listo' | 'denegado' | 'error'
export default function useUbicacionActual() {
  const [ubicacion, setUbicacion] = useState(null);
  const [estado, setEstado] = useState('inactivo');
  const [error, setError] = useState('');

  const obtener = useCallback(async () => {
    setError('');
    setEstado('solicitando');

    try {
      const permiso =
        await Location.requestForegroundPermissionsAsync();

      if (!permiso.granted) {
        setEstado('denegado');
        setError(
          permiso.canAskAgain
            ? 'Necesitamos tu permiso para usar la ubicación. Podés elegir un barrio de la lista.'
            : 'El permiso de ubicación está bloqueado. Habilitalo desde los ajustes del dispositivo o elegí un barrio de la lista.'
        );
        return null;
      }

      setEstado('obteniendo');

      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const resultado = {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude,
      };

      setUbicacion(resultado);
      setEstado('listo');
      return resultado;
    } catch (e) {
      setEstado('error');
      setError(
        'No pudimos obtener tu ubicación. Verificá que el GPS esté activo o elegí un barrio de la lista.'
      );
      return null;
    }
  }, []);

  const limpiar = useCallback(() => {
    setUbicacion(null);
    setEstado('inactivo');
    setError('');
  }, []);

  return {
    ubicacion,
    estado,
    error,
    cargando: estado === 'solicitando' || estado === 'obteniendo',
    obtener,
    limpiar,
  };
}

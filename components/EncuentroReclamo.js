import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import PuntoEncuentro from './PuntoEncuentro';
import { aceptarEncuentro, obtenerEncuentro, proponerEncuentro } from '../services/encuentros';
import { mensajeErrorApi } from '../services/api';

export default function EncuentroReclamo({ reclamoId, actualizacion }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const enviando = useRef(false);
  const version = useRef(0);

  useFocusEffect(useCallback(() => {
    const solicitud = ++version.current;
    const controller = new AbortController();
    setCargando(true);
    setDatos(null);
    setError('');
    obtenerEncuentro(reclamoId, controller.signal)
      .then((resultado) => {
        if (solicitud === version.current) setDatos(resultado);
      })
      .catch((e) => {
        if (!controller.signal.aborted && solicitud === version.current) setError(mensajeErrorApi(e));
      })
      .finally(() => {
        if (solicitud === version.current) setCargando(false);
      });
    return () => { controller.abort(); version.current++; };
  }, [reclamoId, actualizacion, recarga]));

  async function guardar(direccion) {
    if (!datos || enviando.current) return false;
    enviando.current = true;
    setGuardando(true);
    setError('');
    const solicitud = version.current;
    try {
      const resultado = direccion === undefined
        ? await aceptarEncuentro(reclamoId, datos)
        : await proponerEncuentro(reclamoId, direccion, datos);
      if (solicitud === version.current) setDatos(resultado);
      return true;
    } catch (e) {
      if (solicitud === version.current) {
        setDatos(null);
        setError(mensajeErrorApi(e));
      }
      return false;
    } finally {
      enviando.current = false;
      setGuardando(false);
    }
  }

  if (cargando) return <ActivityIndicator accessibilityLabel="Cargando encuentro" />;

  return (
    <View>
      {datos && (
        <PuntoEncuentro
          key={datos.encuentro?.id ?? 'nuevo'}
          reclamoAceptado
          encuentro={datos.encuentro}
          puedeProponer={datos.puedeProponer}
          puedeResponder={datos.puedeResponder}
          guardando={guardando}
          onProponer={guardar}
          onAceptar={() => guardar()}
        />
      )}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#DC2626' }}>{error}</Text>}
      <Button title="Actualizar encuentro" disabled={guardando} onPress={() => setRecarga((n) => n + 1)} />
    </View>
  );
}

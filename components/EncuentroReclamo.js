import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import PuntoEncuentro from './PuntoEncuentro';
import { aceptarEncuentro, obtenerEncuentro, proponerEncuentro } from '../services/encuentros';
import { mensajeErrorApi } from '../services/api';
import { useConexion } from '../context/ConexionContext';
import useActualizacionVisible from '../hooks/useActualizacionVisible';

// `reclamoId` es el reclamo al que pertenecen los datos: nunca se muestran los de otro.
const VISTA_INICIAL = { reclamoId: undefined, datos: null, error: '' };

export default function EncuentroReclamo({ reclamoId, actualizacion }) {
  const { hayConexion } = useConexion();
  const [vista, setVista] = useState(VISTA_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const enviando = useRef(false);
  // Solo vale la respuesta de la última consulta; las anteriores se cancelan o se descartan
  const consulta = useRef({ version: 0, controller: null, enCurso: false });

  const vigente = vista.reclamoId === reclamoId;
  const { datos, error } = vigente ? vista : VISTA_INICIAL;
  // Con datos a la vista, refrescar no los reemplaza por el indicador de carga
  const cargando = datos === null && error === '';

  /**
   * Consulta el encuentro. Con `silencioso` es el refresco periódico: conserva lo que se
   * ve, no se superpone con otra consulta ni con un guardado y, si falla, no muestra error.
   */
  const consultar = useCallback(({ silencioso = false } = {}) => {
    const actual = consulta.current;
    if (silencioso && (actual.enCurso || enviando.current)) return;
    actual.controller?.abort();
    const version = ++actual.version;
    const controller = new AbortController();
    actual.controller = controller;
    actual.enCurso = true;
    const vale = () => version === actual.version && !controller.signal.aborted;

    if (!silencioso) {
      setVista((previo) => (previo.reclamoId === reclamoId
        ? { ...previo, error: '' }
        : { reclamoId, datos: null, error: '' }));
    }
    obtenerEncuentro(reclamoId, controller.signal)
      .then((resultado) => {
        if (vale()) setVista({ reclamoId, datos: resultado, error: '' });
      })
      .catch((e) => {
        if (silencioso || !vale()) return;
        setVista({ reclamoId, datos: null, error: mensajeErrorApi(e) });
      })
      .finally(() => {
        if (version === actual.version) actual.enCurso = false;
      });
  }, [reclamoId]);

  useFocusEffect(useCallback(() => {
    const actual = consulta.current;
    consultar();
    return () => {
      actual.version += 1;
      actual.enCurso = false;
      actual.controller?.abort();
    };
    // `actualizacion` y `recarga` fuerzan una consulta nueva al cambiar
  }, [consultar, actualizacion, recarga]));

  const refrescar = useCallback(() => consultar({ silencioso: true }), [consultar]);
  useActualizacionVisible(refrescar, { alcance: reclamoId });

  async function guardar(direccion) {
    if (!datos || enviando.current) return false;
    if (!hayConexion) {
      setVista((previo) => ({
        ...previo, error: 'Se necesita conexión a internet para coordinar el punto de encuentro.',
      }));
      return false;
    }
    enviando.current = true;
    setGuardando(true);
    setVista((previo) => ({ ...previo, error: '' }));
    // El resultado del guardado es el más nuevo: una consulta en camino ya no vale
    const actual = consulta.current;
    actual.controller?.abort();
    actual.enCurso = false;
    const solicitud = ++actual.version;
    try {
      const resultado = direccion === undefined
        ? await aceptarEncuentro(reclamoId, datos)
        : await proponerEncuentro(reclamoId, direccion, datos);
      if (solicitud === actual.version) setVista({ reclamoId, datos: resultado, error: '' });
      return true;
    } catch (e) {
      if (solicitud === actual.version) {
        setVista({ reclamoId, datos: null, error: mensajeErrorApi(e) });
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
          hayConexion={hayConexion}
          onProponer={guardar}
          onAceptar={() => guardar()}
        />
      )}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#DC2626' }}>{error}</Text>}
      <Button title="Actualizar encuentro" disabled={guardando} onPress={() => setRecarga((n) => n + 1)} />
    </View>
  );
}

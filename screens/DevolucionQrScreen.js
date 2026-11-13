import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Image, StyleSheet } from 'react-native';
import EscanerQrModal from '../components/EscanerQrModal';
import { Aviso, Boton, Cargando, Pantalla, Texto } from '../components/ui';
import { useConexion } from '../context/ConexionContext';
import useActualizacionVisible from '../hooks/useActualizacionVisible';
import { mensajeErrorApi } from '../services/api';
import { confirmarDevolucionQr, generarQrDevolucion, obtenerDevolucion } from '../services/devoluciones';

export default function DevolucionQrScreen(props) {
  return <ContenidoDevolucion key={props.route.params.reclamoId} {...props} />;
}

function ContenidoDevolucion({ route, navigation }) {
  const { reclamoId } = route.params;
  const { hayConexion, comprobarConexion } = useConexion();
  const enfocada = useIsFocused();
  const [datos, setDatos] = useState(null);
  const [qr, setQr] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);
  const consulta = useRef(null);

  const cargar = useCallback(async () => {
    if (ocupado.current) return;
    consulta.current?.abort();
    const controller = new AbortController();
    consulta.current = controller;
    try {
      const resultado = await obtenerDevolucion(reclamoId, controller.signal);
      if (!controller.signal.aborted) setDatos(resultado);
    } catch (e) {
      if (!controller.signal.aborted) setError(mensajeErrorApi(e));
    }
  }, [reclamoId]);

  useFocusEffect(useCallback(() => {
    cargar();
    return () => { consulta.current?.abort(); setEscaneando(false); };
  }, [cargar]));
  useActualizacionVisible(cargar, { alcance: reclamoId });

  async function ejecutar(confirmar = false) {
    if (ocupado.current) return;
    ocupado.current = true;
    consulta.current?.abort();
    setGuardando(true);
    setError('');
    try {
      if (!(await comprobarConexion())) {
        setError('Se necesita conexión para confirmar la entrega o generar el QR.');
        return;
      }
      if (confirmar) {
        await confirmarDevolucionQr(reclamoId, codigo);
        setDatos((previo) => ({ ...previo, estado: 'resuelta' }));
        setCodigo('');
      } else {
        setQr(null);
        setQr(await generarQrDevolucion(reclamoId));
      }
    } catch (e) {
      setError(mensajeErrorApi(e));
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  }

  const resuelta = datos?.estado === 'resuelta';
  return (
    <Pantalla>
      {!datos && !error && <Cargando etiqueta="Cargando devolución" />}
      {!!error && <Aviso tono="peligro" mensaje={error} />}
      {!hayConexion && <Aviso mensaje="Se necesita conexión para completar la devolución." />}
      {datos && <Texto variante="seccion">{datos.titulo}</Texto>}
      {resuelta ? (
        <>
          <Aviso mensaje="Devolución confirmada. El caso ya aparece en el historial." />
          <Boton titulo="Ver historial y valorar" onPress={() => navigation.navigate('Historial')} />
        </>
      ) : datos?.rol === 'devuelve' ? (
        <>
          <Texto>Al entregar el objeto, mostrale este QR a quien lo recupera para que lo escanee con Hallado.</Texto>
          {qr && <>
            <Image source={{ uri: qr.imagen }} style={styles.qr} resizeMode="contain" accessibilityLabel="QR de la devolución" />
            <Texto>Válido hasta las {new Date(qr.expiresAt).toLocaleTimeString()}. Un código nuevo reemplaza al anterior.</Texto>
            <Texto>Esperando que la otra persona confirme la devolución.</Texto>
          </>}
          <Boton titulo={qr ? 'Generar otro QR' : 'Mostrar QR de entrega'} cargando={guardando} requiereConexion onPress={() => ejecutar()} />
        </>
      ) : datos && (
        <>
          <Texto>Cuando recibas el objeto, escaneá el QR que te muestra quien lo devuelve.</Texto>
          {codigo ? <>
            <Texto>¿Ya recibiste este objeto? Al confirmar, el caso se cerrará y podrán valorarse durante 7 días.</Texto>
            <Boton titulo="Confirmar recepción" cargando={guardando} requiereConexion onPress={() => ejecutar(true)} />
            <Boton titulo="Descartar lectura" variante="secundario" disabled={guardando} onPress={() => setCodigo('')} />
          </> : <Boton titulo="Escanear QR" icono="qrcode-scan" requiereConexion onPress={() => { setError(''); setEscaneando(true); }} />}
        </>
      )}
      {!resuelta && <Boton titulo="Actualizar estado" variante="terciario" disabled={guardando} requiereConexion onPress={() => { setError(''); cargar(); }} />}
      <EscanerQrModal visible={escaneando && enfocada && !resuelta} onCerrar={() => setEscaneando(false)} onLeer={(valor) => { setCodigo(valor); setEscaneando(false); }} />
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  qr: { width: '100%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', backgroundColor: '#ffffff' },
});

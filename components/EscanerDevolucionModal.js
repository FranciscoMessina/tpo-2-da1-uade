import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useConexion } from '../context/ConexionContext';
import { conActividadExterna, hayActividadExterna } from '../services/actividadExterna';
import { mensajeErrorApi } from '../services/api';
import { confirmarDevolucionQr } from '../services/historial';
import { Aviso, Boton, Cargando, ModalPantalla, Texto, espacio, radios } from './ui';

const QR = /** @type {import('expo-camera').BarcodeType[]} */ (['qr']);

// JavaScript: el QR trae texto. Convertimos el JSON y comprobamos a qué reclamo corresponde.
function leerCodigo(texto, reclamoId) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El QR no tiene el formato de una devolución de Hallado.');
  }

  if (typeof datos?.reclamoId !== 'string' || typeof datos?.codigo !== 'string' || !datos.codigo.trim()) {
    throw new Error('El QR no tiene los datos de una devolución de Hallado.');
  }
  if (datos.reclamoId !== reclamoId) throw new Error('El QR corresponde a otro reclamo.');

  return datos.codigo;
}

export default function EscanerDevolucionModal({ reclamoId, onCerrar, onConfirmada }) {
  const [permiso, pedirPermiso, consultarPermiso] = useCameraPermissions();
  const { hayConexion } = useConexion();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [errorCamara, setErrorCamara] = useState(false);
  const [codigo, setCodigo] = useState(null);
  const bloqueada = useRef(false);
  const confirmando = useRef(false);
  const abierta = useRef(true);

  useEffect(() => {
    abierta.current = true;
    return () => { abierta.current = false; };
  }, []);

  // React: sincroniza el permiso con Android y cierra el modal antes del bloqueo biométrico.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background' && !hayActividadExterna()) {
        onCerrar();
      } else if (estado === 'active') {
        consultarPermiso().catch(() => setError('No pudimos consultar el permiso de cámara.'));
      }
    });
    return () => sub.remove();
  }, [consultarPermiso, onCerrar]);

  async function solicitarPermiso() {
    try {
      await conActividadExterna(pedirPermiso);
    } catch {
      setError('No pudimos pedir el permiso de la cámara.');
    }
  }

  async function abrirAjustes() {
    try {
      await Linking.openSettings();
    } catch {
      setError('No pudimos abrir los ajustes del dispositivo.');
    }
  }

  async function leerImagen() {
    const seleccion = await conActividadExterna(() => launchImageLibraryAsync({ mediaTypes: ['images'] }));
    if (seleccion.canceled) return null;

    const resultados = await scanFromURLAsync(seleccion.assets[0].uri, QR);
    if (resultados.length !== 1) throw new Error('Elegí una imagen que muestre un solo código QR legible.');
    return resultados[0].data;
  }

  async function procesarLectura(leerTexto) {
    // React: el ref bloquea lecturas repetidas antes de que la pantalla se vuelva a dibujar.
    if (!abierta.current || bloqueada.current || !hayConexion) return;
    bloqueada.current = true;
    setProcesando(true);

    try {
      const texto = await leerTexto();
      if (!abierta.current) return;
      if (texto === null) {
        bloqueada.current = false;
        return;
      }

      setCodigo(leerCodigo(texto, reclamoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer el código QR.');
    } finally {
      setProcesando(false);
    }
  }

  async function confirmar() {
    if (!codigo || !hayConexion || confirmando.current) return;
    confirmando.current = true;
    setProcesando(true);
    setError('');

    try {
      await confirmarDevolucionQr(reclamoId, codigo);
      if (abierta.current) onConfirmada();
    } catch (e) {
      setError(mensajeErrorApi(e));
    } finally {
      confirmando.current = false;
      setProcesando(false);
    }
  }

  function reintentar() {
    bloqueada.current = false;
    setCodigo(null);
    setError('');
  }

  return (
    <ModalPantalla
      visible
      titulo="Escanear QR de devolución"
      onCerrar={() => { if (!procesando && !confirmando.current) onCerrar(); }}
      cerrarDeshabilitado={procesando}
    >
      {procesando ? (
        <Cargando etiqueta={codigo ? 'Confirmando devolución…' : 'Leyendo QR…'} />
      ) : codigo ? (
        <>
          <Aviso tono="info" titulo="QR leído" mensaje="Confirmá si ya recibiste el objeto." />
          {!!error && <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />}
          <Boton
            titulo="Confirmar recepción"
            onPress={confirmar}
            requiereConexion
            notaSinConexion="Se necesita conexión para confirmar la devolución."
          />
          <Boton titulo="Escanear otro QR" variante="secundario" onPress={reintentar} />
        </>
      ) : error ? (
        <>
          <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />
          <Boton titulo="Volver a intentar" onPress={reintentar} />
        </>
      ) : (
        <>
          {!permiso ? (
            <Cargando etiqueta="Consultando permiso de cámara…" />
          ) : permiso.granted && hayConexion && !errorCamara ? (
            <>
              <Texto>Apuntá al QR que te muestra quien devuelve el objeto.</Texto>
              <View style={styles.marco}>
                <CameraView
                  style={styles.camara}
                  barcodeScannerSettings={{ barcodeTypes: QR }}
                  onBarcodeScanned={({ data }) => procesarLectura(() => data)}
                  onMountError={() => setErrorCamara(true)}
                />
              </View>
            </>
          ) : !permiso.granted && (
            <>
              <Aviso tono="info" mensaje="Hallado usa la cámara para leer el QR y confirmar que recibiste el objeto. También podés elegir una imagen del QR." />
              {permiso.canAskAgain && <Boton titulo="Permitir cámara" onPress={solicitarPermiso} />}
              <Boton titulo="Abrir ajustes" variante="secundario" onPress={abrirAjustes} />
            </>
          )}
          {errorCamara && (
            <Aviso tono="aviso" mensaje="No pudimos abrir la cámara. Podés elegir una imagen del QR." />
          )}
          <Boton
            titulo="Elegir imagen del QR"
            icono="image-outline"
            variante="secundario"
            onPress={() => procesarLectura(leerImagen)}
            requiereConexion
            notaSinConexion="Se necesita conexión para confirmar la devolución."
          />
        </>
      )}
    </ModalPantalla>
  );
}

const styles = StyleSheet.create({
  marco: { aspectRatio: 1, borderRadius: radios.control, overflow: 'hidden', marginVertical: espacio.xs },
  camara: { flex: 1 },
});

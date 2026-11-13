import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conActividadExterna } from '../services/actividadExterna';
import { Aviso, Boton, Cargando, Texto, colores, espacio } from './ui';

export default function EscanerQrModal({ visible, onCerrar, onLeer }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      {visible && <Escaner onCerrar={onCerrar} onLeer={onLeer} />}
    </Modal>
  );
}

function Escaner({ onCerrar, onLeer }) {
  const [permiso, pedirPermiso, consultarPermiso] = useCameraPermissions();
  const [activa, setActiva] = useState(AppState.currentState === 'active');
  const [error, setError] = useState('');
  const leido = useRef(false);
  const margenes = useSafeAreaInsets();

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      setActiva(estado === 'active');
      if (estado === 'active') consultarPermiso().catch(() => setError('No pudimos consultar el permiso.'));
    });
    return () => suscripcion.remove();
  }, [consultarPermiso]);

  async function habilitar(ajustes = false) {
    setError('');
    try {
      await conActividadExterna(() => ajustes ? Linking.openSettings() : pedirPermiso());
    } catch {
      setError('No pudimos abrir los permisos de cámara. Intentá nuevamente.');
    }
  }

  function leer({ data }) {
    if (leido.current) return;
    leido.current = true;
    if (!/^hallado:devolucion:[0-9a-f-]{36}$/.test(data)) {
      setError('Este QR no corresponde a una devolución de Hallado.');
      return;
    }
    onLeer(data);
  }

  return (
    <View style={[styles.pantalla, { paddingTop: margenes.top + espacio.md, paddingBottom: margenes.bottom + espacio.md }]}>
      <Texto variante="seccion">Escanear devolución</Texto>
      {!permiso ? <Cargando etiqueta="Consultando permiso" /> : !permiso.granted ? (
        <View style={styles.acciones}>
          <Texto>Necesitamos la cámara para leer el QR de quien te devuelve el objeto. No se guardan fotos.</Texto>
          <Texto>Podés volver sin confirmar la devolución y habilitar la cámara desde los ajustes.</Texto>
          {permiso.canAskAgain && <Boton titulo="Permitir la cámara" onPress={() => habilitar()} />}
          <Boton titulo="Abrir ajustes" variante="secundario" onPress={() => habilitar(true)} />
        </View>
      ) : (
        <>
          <Texto>Apuntá al QR que te muestra la otra persona o a su copia impresa.</Texto>
          {activa && !error && <CameraView
            style={styles.camara}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={leer}
            onMountError={() => setError('No pudimos iniciar la cámara. Volvé a intentarlo.')}
          />}
        </>
      )}
      {!!error && <Aviso tono="peligro" mensaje={error} />}
      {!!error && permiso?.granted && <Boton titulo="Volver a escanear" onPress={() => { leido.current = false; setError(''); }} />}
      <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo, paddingHorizontal: espacio.md, gap: espacio.md },
  camara: { flex: 1, minHeight: 220 },
  acciones: { gap: espacio.md, flex: 1, justifyContent: 'center' },
});

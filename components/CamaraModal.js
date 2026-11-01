import { useRef, useState } from 'react';
import { Image, Linking, Modal, StatusBar, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conActividadExterna } from '../services/actividadExterna';
import { Aviso, Boton, Icono, Texto, Tocable, colores, espacio, radios } from './ui';

const CALIDAD = 0.7;
const TAMANO_DISPARADOR = 72;

/**
 * Cámara dentro de la app (expo-camera): saca una foto, la muestra para confirmarla y entrega
 * su URI con `onFoto`. El contenido solo existe mientras el Modal está abierto, porque el
 * dispositivo admite una única vista previa de cámara activa.
 */
export default function CamaraModal({ visible, onCerrar, onFoto }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCerrar}
    >
      {visible && <ContenidoCamara onCerrar={onCerrar} onFoto={onFoto} />}
    </Modal>
  );
}

function ContenidoCamara({ onCerrar, onFoto }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef(null);
  const [lista, setLista] = useState(false);
  const [trasera, setTrasera] = useState(true);
  const [flash, setFlash] = useState(false);
  const [sacando, setSacando] = useState(false);
  const [captura, setCaptura] = useState(null);
  const [error, setError] = useState('');
  const margenes = useSafeAreaInsets();

  async function solicitarPermiso() {
    setError('');

    try {
      // El diálogo de permisos también pasa la app a segundo plano en Android
      await conActividadExterna(() => pedirPermiso());
    } catch {
      setError('No pudimos pedir el permiso de la cámara.');
    }
  }

  async function sacar() {
    if (!camara.current || !lista || sacando) return;

    setError('');
    setSacando(true);

    try {
      const foto = await camara.current.takePictureAsync({ quality: CALIDAD });

      if (foto?.uri) setCaptura(foto.uri);
      else setError('No pudimos sacar la foto. Probá de nuevo.');
    } catch {
      setError('No pudimos sacar la foto. Probá de nuevo.');
    } finally {
      setSacando(false);
    }
  }

  function cambiarCamara() {
    setTrasera((actual) => !actual);
    // La frontal no tiene flash propio: se apaga para que no quede activo al volver a la trasera
    setFlash(false);
  }

  if (!permiso) {
    return <View style={styles.pantalla} />;
  }

  if (!permiso.granted) {
    return (
      <View style={[styles.pantalla, styles.centrado, { paddingTop: margenes.top }]}>
        <Icono nombre="camera-off-outline" tamano={48} color={colores.textoInverso} />
        <Texto variante="seccion" tono="inverso" centrado>
          Necesitamos tu permiso para usar la cámara
        </Texto>
        <Texto tono="inverso" centrado>
          {permiso.canAskAgain
            ? 'Solo se usa para sacar fotos de lo que publicás. Si preferís, elegí fotos de la galería.'
            : 'El permiso está bloqueado. Habilitalo desde los ajustes del dispositivo o elegí fotos de la galería.'}
        </Texto>
        {!!error && <Aviso tono="peligro" mensaje={error} />}
        <View style={styles.acciones}>
          {permiso.canAskAgain ? (
            <Boton titulo="Permitir la cámara" onPress={solicitarPermiso} />
          ) : (
            <Boton titulo="Abrir ajustes" onPress={() => Linking.openSettings()} />
          )}
          <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} />
        </View>
      </View>
    );
  }

  if (captura) {
    return (
      <View style={styles.pantalla}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Image
          source={{ uri: captura }}
          style={styles.vista}
          resizeMode="contain"
          accessibilityLabel="Foto sacada"
        />
        <View
          style={[
            styles.acciones,
            styles.accionesPie,
            { paddingBottom: margenes.bottom + espacio.md },
          ]}
        >
          <Boton titulo="Usar esta foto" icono="check" onPress={() => onFoto(captura)} />
          <Boton
            titulo="Sacar otra"
            icono="camera-retake-outline"
            variante="secundario"
            onPress={() => setCaptura(null)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView
        ref={camara}
        style={styles.vista}
        facing={trasera ? 'back' : 'front'}
        flash={flash ? 'on' : 'off'}
        mode="picture"
        onCameraReady={() => setLista(true)}
        onMountError={() => setError('No pudimos iniciar la cámara.')}
      />

      <View style={[styles.barraSuperior, { paddingTop: margenes.top + espacio.xs }]}>
        <BotonCircular icono="close" etiqueta="Cerrar la cámara" onPress={onCerrar} />
        {trasera && (
          <BotonCircular
            icono={flash ? 'flash' : 'flash-off'}
            etiqueta={flash ? 'Apagar el flash' : 'Encender el flash'}
            onPress={() => setFlash((actual) => !actual)}
          />
        )}
      </View>

      <View style={[styles.barraInferior, { paddingBottom: margenes.bottom + espacio.lg }]}>
        {!!error && <Aviso tono="peligro" mensaje={error} />}
        <View style={styles.controles}>
          <View style={styles.lateral} />
          <Tocable
            radio={radios.pastilla}
            accessibilityLabel="Sacar foto"
            disabled={!lista || sacando}
            colorOnda={colores.onda}
            onPress={sacar}
            estiloContenedor={styles.disparadorExterior}
            style={[styles.disparador, (!lista || sacando) && styles.disparadorInactivo]}
          >
            <View />
          </Tocable>
          <View style={styles.lateral}>
            <BotonCircular
              icono="camera-flip-outline"
              etiqueta="Cambiar de cámara"
              onPress={cambiarCamara}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function BotonCircular({ icono, etiqueta, onPress }) {
  return (
    <Tocable
      radio={radios.pastilla}
      accessibilityLabel={etiqueta}
      colorOnda={colores.ondaInversa}
      onPress={onPress}
      estiloContenedor={styles.circularExterior}
      style={styles.circular}
    >
      <Icono nombre={icono} tamano={24} color={colores.textoInverso} />
    </Tocable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#000000' },
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.md,
    padding: espacio.lg,
  },
  vista: { flex: 1 },
  barraSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.md,
  },
  barraInferior: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: espacio.sm,
    paddingHorizontal: espacio.md,
  },
  controles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lateral: { width: 56, alignItems: 'center' },
  circularExterior: { backgroundColor: colores.velo },
  circular: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  disparadorExterior: {
    width: TAMANO_DISPARADOR,
    height: TAMANO_DISPARADOR,
    borderWidth: 4,
    borderColor: colores.textoInverso,
  },
  disparador: {
    flex: 1,
    backgroundColor: colores.textoInverso,
    margin: 3,
    borderRadius: radios.pastilla,
  },
  disparadorInactivo: { opacity: 0.5 },
  acciones: { alignSelf: 'stretch', gap: espacio.xs },
  accionesPie: { paddingHorizontal: espacio.md, paddingTop: espacio.md },
});

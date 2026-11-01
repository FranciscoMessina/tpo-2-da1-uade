import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icono from './Icono';
import Pantalla from './Pantalla';
import Texto from './Texto';
import Tocable from './Tocable';
import { colores, espacio, estilosPantalla, radios } from './tema';

// Tarea que ocupa toda la pantalla y se resuelve o se descarta sin salir de la vista actual
export default function ModalPantalla({
  visible,
  titulo,
  onCerrar,
  cerrarDeshabilitado = false,
  children,
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={[estilosPantalla.pantalla, styles.fondoBarra]}>
        <View style={styles.barra}>
          <Tocable
            radio={radios.pastilla}
            onPress={onCerrar}
            disabled={cerrarDeshabilitado}
            accessibilityLabel="Cerrar"
            style={styles.cerrar}
          >
            <Icono nombre="close" tamano={24} />
          </Tocable>

          <Texto variante="seccion" numberOfLines={1} style={styles.titulo}>{titulo}</Texto>
        </View>

        <Pantalla>{children}</Pantalla>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondoBarra: { backgroundColor: colores.superficie },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xxs,
    paddingHorizontal: espacio.xxs,
    minHeight: 56,
  },
  cerrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1 },
});

import { StyleSheet, View } from 'react-native';
import Texto from './Texto';
import { colores, espacio, radios } from './tema';

// Progreso de un trámite corto por pasos
export default function IndicadorPasos({ paso, total }) {
  return (
    <View style={styles.indicador}>
      <Texto variante="etiqueta" tono="secundario">Paso {paso} de {total}</Texto>

      <View
        style={styles.barra}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: total }, (_, indice) => (
          <View key={indice} style={[styles.tramo, indice < paso && styles.tramoHecho]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicador: { gap: espacio.xs },
  barra: { flexDirection: 'row', gap: espacio.xxs },
  tramo: {
    flex: 1,
    height: 4,
    borderRadius: radios.pastilla,
    backgroundColor: colores.borde,
  },
  tramoHecho: { backgroundColor: colores.primario },
});

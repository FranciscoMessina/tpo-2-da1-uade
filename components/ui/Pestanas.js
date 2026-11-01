import { StyleSheet, View } from 'react-native';
import Texto from './Texto';
import Tocable from './Tocable';
import { alturaControl, colores, espacio } from './tema';

// Vistas alternativas de un mismo contenido: `opciones` es una lista de { valor, nombre }
export default function Pestanas({ opciones, valor, onChange }) {
  return (
    <View style={styles.barra} accessibilityRole="tablist">
      {opciones.map((opcion) => {
        const activa = valor === opcion.valor;

        return (
          <Tocable
            key={opcion.valor}
            radio={0}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => onChange(opcion.valor)}
            estiloContenedor={styles.contenedor}
            style={[styles.pestana, activa && styles.activa]}
          >
            <Texto variante="etiqueta" tono={activa ? 'primario' : 'secundario'}>
              {opcion.nombre}
            </Texto>
          </Tocable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: colores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  contenedor: { flex: 1 },
  pestana: {
    minHeight: alturaControl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio.xs,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activa: { borderBottomColor: colores.primario },
});

import { StyleSheet, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import Tocable from './Tocable';
import { colores, espacio, radios, tonos } from './tema';

export function Chip({ texto, seleccionado = false, onPress, disabled = false, chico = false }) {
  return (
    <Tocable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected: seleccionado }}
      hitSlop={chico ? 6 : 2}
      estiloContenedor={styles.contenedorChip}
      style={[styles.chip, chico && styles.chipChico, seleccionado && styles.seleccionado]}
    >
      <View style={styles.contenido}>
        {seleccionado && <Icono nombre="check" tamano={16} color={tonos.info.texto} />}
        <Texto
          variante={seleccionado ? 'etiqueta' : 'cuerpoChico'}
          style={[styles.texto, { color: seleccionado ? tonos.info.texto : colores.texto }]}
        >
          {texto}
        </Texto>
      </View>
    </Tocable>
  );
}

// Selección única entre opciones visibles: `opciones` es una lista de { valor, nombre }
export function GrupoOpciones({
  opciones,
  valor,
  onChange,
  etiqueta = undefined,
  error = undefined,
  chico = false,
  disabled = false,
}) {
  return (
    <View style={styles.bloque}>
      {!!etiqueta && <Texto variante="etiqueta" tono="secundario">{etiqueta}</Texto>}

      <View style={styles.grupo}>
        {opciones.map((opcion) => (
          <Chip
            key={String(opcion.valor)}
            texto={opcion.nombre}
            seleccionado={valor === opcion.valor}
            onPress={() => onChange(opcion.valor)}
            chico={chico}
            disabled={disabled}
          />
        ))}
      </View>

      {!!error && <Texto variante="cuerpoChico" tono="peligro">{error}</Texto>}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: espacio.xs },
  grupo: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  contenedorChip: { maxWidth: '100%' },
  chip: {
    minHeight: 44,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
    justifyContent: 'center',
    borderRadius: radios.control,
    borderWidth: 1,
    borderColor: colores.bordeControl,
    backgroundColor: colores.superficie,
  },
  chipChico: { minHeight: 36, paddingVertical: espacio.xxs },
  seleccionado: { backgroundColor: colores.primarioSuave, borderColor: colores.primario },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: espacio.xxs },
  texto: { flexShrink: 1 },
});

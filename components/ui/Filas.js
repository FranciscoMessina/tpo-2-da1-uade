import { StyleSheet, Switch, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import Tocable from './Tocable';
import { colores, espacio, tonos } from './tema';

// Dato de solo lectura: etiqueta arriba, valor abajo
export function FilaDato({ etiqueta, valor }) {
  return (
    <View style={styles.dato}>
      <Texto variante="leyendaFuerte" tono="secundario">{etiqueta}</Texto>
      <Texto>{valor}</Texto>
    </View>
  );
}

/**
 * Fila de lista que lleva a otra vista. Va dentro de una Tarjeta sinRelleno.
 * `peligro` la pinta como acción destructiva y le saca la flecha.
 */
export function FilaMenu({
  titulo,
  descripcion = undefined,
  icono = undefined,
  onPress,
  peligro = false,
  disabled = false,
  accessibilityLabel = undefined,
}) {
  const color = peligro ? tonos.peligro.texto : colores.textoSecundario;

  return (
    <Tocable
      radio={0}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={styles.menu}
    >
      {!!icono && <Icono nombre={icono} tamano={22} color={color} />}

      <View style={styles.menuTexto}>
        <Texto variante="subtitulo" tono={peligro ? 'peligro' : 'principal'}>{titulo}</Texto>
        {!!descripcion && (
          <Texto variante="cuerpoChico" tono="secundario">{descripcion}</Texto>
        )}
      </View>

      {!peligro && <Icono nombre="chevron-right" tamano={22} color={colores.textoTenue} />}
    </Tocable>
  );
}

// Interruptor con su etiqueta, siempre con los mismos colores
export function FilaInterruptor({
  etiqueta,
  valor,
  onChange,
  disabled = false,
  accessibilityLabel = undefined,
}) {
  return (
    <View style={styles.interruptor}>
      <Texto style={styles.interruptorTexto}>{etiqueta}</Texto>

      <Switch
        value={valor}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colores.bordeControl, true: colores.primarioSuave }}
        thumbColor={valor ? colores.primario : colores.superficie}
        accessibilityLabel={accessibilityLabel ?? etiqueta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dato: { gap: 2 },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    minHeight: 56,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.sm,
  },
  menuTexto: { flex: 1, gap: 2 },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, minHeight: 48 },
  interruptorTexto: { flex: 1 },
});

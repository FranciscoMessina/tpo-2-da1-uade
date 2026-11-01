import { StyleSheet, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import Tocable from './Tocable';
import { alturaControl, colores, espacio, radios, tonos } from './tema';

// Campo que se ve como un `Campo` pero al tocarlo abre un selector (lista, fecha, hora). Muestra
// la etiqueta, el valor o el texto de ayuda, el ícono y el error.
export default function CampoSeleccion({
  etiqueta = undefined,
  valor = '',
  placeholder = 'Elegir',
  icono = 'chevron-down',
  error = undefined,
  disabled = false,
  accessibilityLabel = undefined,
  onPress,
  estilo = undefined,
}) {
  const tieneValor = valor !== '';

  return (
    <View style={[styles.campo, estilo]}>
      {!!etiqueta && <Texto variante="etiqueta" tono="secundario">{etiqueta}</Texto>}

      <Tocable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel ?? etiqueta}
        accessibilityValue={{ text: tieneValor ? valor : placeholder }}
        style={[styles.control, !!error && styles.conError, disabled && styles.bloqueado]}
      >
        <Texto
          numberOfLines={1}
          tono={tieneValor && !disabled ? 'principal' : 'tenue'}
          style={styles.valor}
        >
          {tieneValor ? valor : placeholder}
        </Texto>
        <Icono nombre={icono} tamano={22} color={colores.textoSecundario} />
      </Tocable>

      {!!error && <Texto variante="cuerpoChico" tono="peligro">{error}</Texto>}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: espacio.xxs },
  control: {
    minHeight: alturaControl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
    borderWidth: 1,
    borderColor: colores.bordeControl,
    borderRadius: radios.control,
    backgroundColor: colores.superficie,
  },
  valor: { flex: 1 },
  conError: { borderColor: tonos.peligro.texto },
  bloqueado: { backgroundColor: colores.superficieHundida },
});

import { Platform, Pressable, View } from 'react-native';
import { colores, radios } from './tema';

const presionadoIos = { opacity: 0.7 };

/**
 * Superficie tocable con la respuesta propia de cada plataforma (onda en Android, atenuado en
 * iOS). El contenedor recorta la onda al radio. Es la base de botones, chips, filas y tarjetas.
 */
export default function Tocable({
  radio = radios.control,
  style = undefined,
  estiloContenedor = undefined,
  colorOnda = colores.onda,
  disabled = false,
  accessibilityState = undefined,
  children,
  ...props
}) {
  return (
    <View style={[{ borderRadius: radio, overflow: 'hidden' }, estiloContenedor]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
        disabled={disabled}
        android_ripple={disabled ? undefined : { color: colorOnda }}
        style={({ pressed }) => [style, pressed && Platform.OS === 'ios' && presionadoIos]}
        {...props}
      >
        {children}
      </Pressable>
    </View>
  );
}

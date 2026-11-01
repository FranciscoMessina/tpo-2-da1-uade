import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Texto from './Texto';
import { alturaControl, colores, espacio, radios, tipografia, tonos } from './tema';

// Campo de texto con etiqueta, ayuda y error. El borde marca el foco y el error.
export default function Campo({
  etiqueta = undefined,
  ayuda = undefined,
  error = undefined,
  multiline = false,
  editable = true,
  accessibilityLabel = undefined,
  estilo = undefined,
  estiloInput = undefined,
  onFocus = undefined,
  onBlur = undefined,
  ...props
}) {
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={[styles.campo, estilo]}>
      {!!etiqueta && <Texto variante="etiqueta" tono="secundario">{etiqueta}</Texto>}

      <TextInput
        accessibilityLabel={accessibilityLabel ?? etiqueta}
        placeholderTextColor={colores.textoTenue}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(evento) => {
          setEnfocado(true);
          onFocus?.(evento);
        }}
        onBlur={(evento) => {
          setEnfocado(false);
          onBlur?.(evento);
        }}
        style={[
          styles.input,
          multiline && styles.multilinea,
          enfocado && styles.enfocado,
          !!error && styles.conError,
          !editable && styles.bloqueado,
          estiloInput,
        ]}
        {...props}
      />

      {!!ayuda && <Texto variante="leyenda" tono="secundario">{ayuda}</Texto>}
      {!!error && <Texto variante="cuerpoChico" tono="peligro">{error}</Texto>}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: espacio.xxs },
  input: {
    ...tipografia.cuerpo,
    lineHeight: undefined,
    minHeight: alturaControl,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
    borderWidth: 1,
    borderColor: colores.bordeControl,
    borderRadius: radios.control,
    backgroundColor: colores.superficie,
    color: colores.texto,
  },
  multilinea: { minHeight: 104 },
  enfocado: { borderColor: colores.primario },
  conError: { borderColor: tonos.peligro.texto },
  bloqueado: { backgroundColor: colores.superficieHundida, color: colores.textoSecundario },
});

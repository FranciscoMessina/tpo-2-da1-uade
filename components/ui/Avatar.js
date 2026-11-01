import { Image, StyleSheet, View } from 'react-native';
import Texto from './Texto';
import { colores, radios, tonos } from './tema';

function iniciales(nombre) {
  return (nombre ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

// Foto de la persona; sin foto muestra sus iniciales
export default function Avatar({ uri = undefined, nombre = '', tamano = 88 }) {
  const dimension = { width: tamano, height: tamano };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, dimension]}
        accessibilityLabel={`Foto de ${nombre}`}
      />
    );
  }

  return (
    <View style={[styles.avatar, dimension]} accessibilityLabel={`Sin foto de ${nombre}`}>
      <Texto
        variante={tamano >= 64 ? 'pantalla' : 'subtitulo'}
        style={styles.iniciales}
        importantForAccessibility="no"
      >
        {iniciales(nombre)}
      </Texto>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radios.pastilla,
    backgroundColor: colores.primarioSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: { color: tonos.info.texto },
});

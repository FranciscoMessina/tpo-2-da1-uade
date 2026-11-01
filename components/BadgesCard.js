import { StyleSheet, View } from 'react-native';
import { Icono, Seccion, Texto, espacio, radios, tonos } from './ui';

export default function BadgesCard({ insignias = [] }) {
  return (
    <Seccion titulo="Insignias">
      {insignias.length > 0 ? (
        insignias.map((insignia) => (
          <View key={insignia.id} style={styles.insignia}>
            <View style={styles.icono}>
              <Icono nombre="medal-outline" tamano={22} color={tonos.aviso.texto} />
            </View>

            <View style={styles.datos}>
              <Texto variante="subtitulo">{insignia.name}</Texto>
              <Texto variante="cuerpoChico" tono="secundario">{insignia.description}</Texto>
            </View>
          </View>
        ))
      ) : (
        <Texto variante="cuerpoChico" tono="secundario">Todavía no tiene insignias.</Texto>
      )}
    </Seccion>
  );
}

const styles = StyleSheet.create({
  insignia: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radios.pastilla,
    backgroundColor: tonos.aviso.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datos: { flex: 1, gap: 2 },
});

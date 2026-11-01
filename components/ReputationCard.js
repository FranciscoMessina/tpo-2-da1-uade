import { StyleSheet, View } from 'react-native';
import { Panel, Seccion, Texto, espacio } from './ui';

function Dato({ valor, etiqueta, tono = 'principal' }) {
  return (
    <Panel style={styles.dato}>
      <Texto variante="seccion" tono={tono}>{valor}</Texto>
      <Texto variante="leyenda" tono="secundario">{etiqueta}</Texto>
    </Panel>
  );
}

export default function ReputationCard({ reputacion }) {
  if (!reputacion) {
    return (
      <Seccion titulo="Reputación">
        <Texto variante="cuerpoChico" tono="secundario">Reputación no disponible.</Texto>
      </Seccion>
    );
  }

  const conValoraciones = reputacion.positiveReviews + reputacion.negativeReviews > 0;

  return (
    <Seccion titulo="Reputación">
      <View style={styles.datos}>
        <Dato valor={reputacion.completedReturns} etiqueta="Devoluciones concretadas" />

        {conValoraciones && (
          <>
            <Dato valor={reputacion.positiveReviews} etiqueta="Positivas" tono="exito" />
            <Dato valor={reputacion.negativeReviews} etiqueta="Negativas" tono="peligro" />
          </>
        )}
      </View>

      {!conValoraciones && (
        <Texto variante="cuerpoChico" tono="secundario">Sin valoraciones todavía.</Texto>
      )}
    </Seccion>
  );
}

const styles = StyleSheet.create({
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  dato: { flexGrow: 1, flexBasis: 88, gap: 2 },
});

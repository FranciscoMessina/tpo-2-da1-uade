import { StyleSheet, View } from 'react-native';
import Boton from './Boton';
import Texto from './Texto';
import { espacio } from './tema';

export default function Paginacion({ pagina, totalPaginas, onCambiar }) {
  if (totalPaginas <= 1) return null;

  return (
    <View style={styles.paginacion}>
      <Boton
        titulo="Anterior"
        variante="terciario"
        chico
        disabled={pagina <= 1}
        onPress={() => onCambiar(pagina - 1)}
      />

      <Texto variante="cuerpoChico" tono="secundario" centrado style={styles.pagina}>
        Página {pagina} de {totalPaginas}
      </Texto>

      <Boton
        titulo="Siguiente"
        variante="terciario"
        chico
        disabled={pagina >= totalPaginas}
        onPress={() => onCambiar(pagina + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  paginacion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.xs,
  },
  pagina: { flex: 1 },
});

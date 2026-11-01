import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useColaPublicaciones } from '../context/ColaPublicacionesContext';
import { useConexion } from '../context/ConexionContext';
import { ESTADOS, describirEstado } from '../services/colaPublicaciones';
import {
  Boton,
  EstadoVacio,
  Fila,
  Seccion,
  Separador,
  Texto,
  colores,
  espacio,
} from './ui';

// Publicaciones guardadas para enviar: pendientes, enviándose o rechazadas por el servidor.
// No muestra nada si la cola está vacía (salvo `mostrarVacio`).
export default function PublicacionesPendientes({ navigation, mostrarVacio = false }) {
  const { cola, procesarAhora, reintentarItem, descartarItem } = useColaPublicaciones();
  const { hayConexion } = useConexion();

  if (cola.length === 0) {
    return mostrarVacio ? (
      <EstadoVacio
        icono="cloud-check-outline"
        tono="exito"
        titulo="Publicaciones pendientes"
        mensaje="No tenés publicaciones pendientes de envío."
      />
    ) : null;
  }

  function confirmarDescarte(item) {
    Alert.alert(
      'Descartar publicación',
      `Se va a eliminar "${item.datos.titulo}" del dispositivo sin publicarla.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => descartarItem(item.id) },
      ]
    );
  }

  return (
    <Seccion
      titulo="Publicaciones pendientes"
      descripcion="Se guardaron en tu dispositivo y se envían solas, en orden, cuando hay conexión."
    >
      {cola.map((item) => {
        const conError = item.estado === ESTADOS.ERROR;

        return (
          <View key={item.id} style={styles.item}>
            <Separador />

            <Texto variante="subtitulo">{item.datos.titulo}</Texto>

            <Texto variante="cuerpoChico" tono="secundario">
              {item.datos.tipo === 'encontre' || item.datos.tipo === 'encontrado'
                ? 'Encontrado'
                : 'Perdido'}{' '}
              · {item.datos.barrio || 'Ubicación actual'} · {(item.datos.fotos || []).length} foto(s)
            </Texto>

            <View style={styles.estado}>
              {item.estado === ESTADOS.ENVIANDO && (
                <ActivityIndicator size="small" color={colores.primario} />
              )}
              <Texto
                variante={conError ? 'etiqueta' : 'cuerpoChico'}
                tono={conError ? 'peligro' : 'aviso'}
                accessibilityRole={conError ? 'alert' : undefined}
                style={styles.estadoTexto}
              >
                {describirEstado(item, hayConexion)}
              </Texto>
            </View>

            {item.estado === ESTADOS.PENDIENTE && (
              <Fila>
                <Boton
                  titulo="Enviar ahora"
                  variante="secundario"
                  chico
                  flexible
                  disabled={!hayConexion}
                  onPress={procesarAhora}
                />
                <Boton
                  titulo="Descartar"
                  variante="peligro"
                  chico
                  flexible
                  onPress={() => confirmarDescarte(item)}
                />
              </Fila>
            )}

            {conError && (
              <Fila>
                <Boton
                  titulo="Editar"
                  variante="secundario"
                  chico
                  flexible
                  onPress={() => navigation.navigate('CrearPublicacion', { pendienteId: item.id })}
                />
                <Boton
                  titulo="Reintentar"
                  variante="secundario"
                  chico
                  flexible
                  disabled={!hayConexion}
                  onPress={() => reintentarItem(item.id)}
                />
                <Boton
                  titulo="Descartar"
                  variante="peligro"
                  chico
                  flexible
                  onPress={() => confirmarDescarte(item)}
                />
              </Fila>
            )}
          </View>
        );
      })}
    </Seccion>
  );
}

const styles = StyleSheet.create({
  item: { gap: espacio.xs },
  estado: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  estadoTexto: { flexShrink: 1 },
});

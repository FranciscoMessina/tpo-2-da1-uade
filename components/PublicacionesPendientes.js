import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import { useColaPublicaciones } from '../context/ColaPublicacionesContext';
import { useConexion } from '../context/ConexionContext';
import { ESTADOS, describirEstado } from '../services/colaPublicaciones';

// Publicaciones guardadas para enviar: pendientes, enviándose o rechazadas por el servidor.
// No muestra nada si la cola está vacía (salvo `mostrarVacio`).
export default function PublicacionesPendientes({ navigation, mostrarVacio = false }) {
  const { cola, procesarAhora, reintentarItem, descartarItem } = useColaPublicaciones();
  const { hayConexion } = useConexion();

  if (cola.length === 0) {
    return mostrarVacio ? (
      <View style={styles.card}>
        <Text style={styles.title}>Publicaciones pendientes</Text>
        <Text style={styles.empty}>No tenés publicaciones pendientes de envío.</Text>
      </View>
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
    <View style={styles.card}>
      <Text style={styles.title}>Publicaciones pendientes</Text>

      <Text style={styles.help}>
        Se guardaron en tu dispositivo y se envían solas, en orden, cuando hay conexión.
      </Text>

      {cola.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemTitle}>{item.datos.titulo}</Text>

          <Text style={styles.itemMeta}>
            {item.datos.tipo === 'encontre' || item.datos.tipo === 'encontrado'
              ? 'Encontrado'
              : 'Perdido'}{' '}
            · {item.datos.barrio || 'Ubicación actual'} · {(item.datos.fotos || []).length} foto(s)
          </Text>

          <View style={styles.estadoFila}>
            {item.estado === ESTADOS.ENVIANDO && <ActivityIndicator color="#1D4ED8" />}
            <Text
              style={[styles.estado, item.estado === ESTADOS.ERROR && styles.estadoError]}
              accessibilityRole={item.estado === ESTADOS.ERROR ? 'alert' : undefined}
            >
              {describirEstado(item, hayConexion)}
            </Text>
          </View>

          {item.estado === ESTADOS.PENDIENTE && (
            <View style={styles.acciones}>
              <Button
                title="Enviar ahora"
                color={!hayConexion ? '#9CA3AF' : undefined}
                disabled={!hayConexion}
                onPress={procesarAhora}
              />
              <Button title="Descartar" color="#DC2626" onPress={() => confirmarDescarte(item)} />
            </View>
          )}

          {item.estado === ESTADOS.ERROR && (
            <View style={styles.acciones}>
              <Button
                title="Editar"
                onPress={() => navigation.navigate('CrearPublicacion', { pendienteId: item.id })}
              />
              <Button
                title="Reintentar"
                color={!hayConexion ? '#9CA3AF' : '#6B7280'}
                disabled={!hayConexion}
                onPress={() => reintentarItem(item.id)}
              />
              <Button title="Descartar" color="#DC2626" onPress={() => confirmarDescarte(item)} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  help: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  empty: { color: '#6B7280' },
  item: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    gap: 6,
  },
  itemTitle: { fontSize: 16, color: '#111827' },
  itemMeta: { fontSize: 14, color: '#6B7280' },
  estadoFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estado: { fontSize: 14, color: '#92400E', flexShrink: 1 },
  estadoError: { color: '#DC2626', fontWeight: '600' },
  acciones: { gap: 8, marginTop: 4 },
});

import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useMisPublicaciones from '../hooks/useMisPublicaciones';

const NOMBRE_ESTADO = {
  abierta: 'Abierta',
  en_reclamo: 'En reclamo',
  resuelta: 'Resuelta',
};

// Acceso temporal a la gestión de publicaciones propias (hasta que exista el detalle).
export default function MisPublicaciones({ navigation }) {
  const { publicaciones, loading, error, recargar } = useMisPublicaciones();

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar])
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mis publicaciones</Text>

      {loading && <ActivityIndicator color="#1D4ED8" />}
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && publicaciones.length === 0 && (
        <Text style={styles.empty}>Todavía no publicaste nada.</Text>
      )}

      {publicaciones.map((p) => (
        <Pressable
          key={p.id}
          style={styles.item}
          onPress={() =>
            navigation.navigate('GestionPublicacion', { publicacionId: p.id })
          }
          accessibilityRole="button"
        >
          <Text style={styles.itemTitle}>{p.titulo}</Text>
          <Text style={styles.itemMeta}>
            {NOMBRE_ESTADO[p.estado]} · {p.barrio}
          </Text>
        </Pressable>
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
    marginBottom: 12,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
  },
  itemTitle: { fontSize: 16, color: '#111827' },
  itemMeta: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  empty: { color: '#6B7280' },
  error: { color: '#DC2626' },
});

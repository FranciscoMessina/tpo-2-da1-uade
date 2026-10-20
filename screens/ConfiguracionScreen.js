import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import useConfiguracion from '../hooks/useConfiguracion';

export default function ConfiguracionScreen() {
  const { biometriaActiva, biometriaDisponible, setBiometria, loading, error } =
    useConfiguracion();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Seguridad</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            Desbloquear con biometría
          </Text>
          <Switch
            value={biometriaActiva}
            onValueChange={setBiometria}
            disabled={!biometriaDisponible}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={biometriaActiva ? '#1D4ED8' : '#F9FAFB'}
            accessibilityLabel="Desbloquear con biometría"
          />
        </View>

        <Text style={styles.help}>
          {biometriaDisponible
            ? 'Se te pedirá huella o rostro al abrir la app o volver a ella.'
            : 'Tu dispositivo no tiene biometría disponible o no hay huella/rostro configurados.'}
        </Text>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  switchLabel: { flex: 1, fontSize: 16, color: '#111827' },
  help: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  error: { color: '#DC2626', marginTop: 12 },
});

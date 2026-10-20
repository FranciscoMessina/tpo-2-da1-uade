import { Button, StyleSheet, Text, View } from 'react-native';
import useBloqueoBiometrico from '../hooks/useBloqueoBiometrico';

export default function BloqueoBiometrico() {
  const { bloqueado, autenticando, error, desbloquear } =
    useBloqueoBiometrico();

  if (!bloqueado) return null;

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>Hallado está bloqueada</Text>
      <Text style={styles.text}>
        Usá la biometría de tu dispositivo para continuar.
      </Text>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      <Button
        title={autenticando ? 'Verificando...' : 'Reintentar'}
        onPress={desbloquear}
        disabled={autenticando}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
  },
});

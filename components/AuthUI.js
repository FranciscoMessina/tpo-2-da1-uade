import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export function AuthField({ label, error, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor="#9CA3AF"
        accessibilityLabel={label}
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function AuthButton({ title, onPress, loading, disabled, secondary }) {
  const inactivo = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo }}
      onPress={inactivo ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        inactivo && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? '#1D4ED8' : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthLink({ title, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={disabled ? undefined : onPress}
      style={styles.link}
    >
      <Text style={[styles.linkText, disabled && styles.linkDisabled]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.banner}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: '#DC2626' },
  error: { color: '#DC2626', marginTop: 4 },
  banner: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  buttonTextSecondary: { color: '#1D4ED8' },
  link: { padding: 12, alignItems: 'center' },
  linkText: { color: '#1D4ED8', fontSize: 16 },
  linkDisabled: { color: '#9CA3AF' },
});

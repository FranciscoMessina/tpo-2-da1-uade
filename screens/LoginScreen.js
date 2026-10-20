import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import useAuth, { emailValido } from '../hooks/useAuth';
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthLink,
} from '../components/AuthUI';

export default function LoginScreen({ navigation }) {
  const { iniciarSesion, loading, error, limpiarError } = useAuth();
  const [email, setEmail] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [errores, setErrores] = useState({});

  function enviar() {
    const e = {};
    if (!emailValido(email)) e.email = 'Ingresá un email válido.';
    if (!contraseña) e.contraseña = 'Ingresá tu contraseña.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    // Si sale bien, App.js pasa solo al stack principal.
    iniciarSesion(email, contraseña);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Ingresá a Hallado</Text>
      <Text style={styles.help}>
        Probá con demo@hallado.com / Hallado123.
      </Text>

      <View style={styles.card}>
        <AuthError message={error} />
        <AuthField
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            limpiarError();
          }}
          error={errores.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          placeholder="tu@email.com"
        />
        <AuthField
          label="Contraseña"
          value={contraseña}
          onChangeText={(t) => {
            setContraseña(t);
            limpiarError();
          }}
          error={errores.contraseña}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Tu contraseña"
          onSubmitEditing={enviar}
        />
        <AuthButton title="Ingresar" onPress={enviar} loading={loading} />
        <AuthLink
          title="Olvidé mi contraseña"
          onPress={() => {
            limpiarError();
            navigation.navigate('RecuperarContraseña');
          }}
        />
      </View>

      <AuthLink
        title="¿No tenés cuenta? Registrate"
        onPress={() => {
          limpiarError();
          navigation.navigate('Registro');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  help: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 12 },
});

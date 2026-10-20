import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import useAuth, { emailValido, validarContraseña } from '../hooks/useAuth';
import { AuthButton, AuthError, AuthField } from '../components/AuthUI';
import CodeStep from '../components/CodeStep';

export default function RegisterScreen() {
  const {
    solicitarCodigoRegistro,
    verificarCodigo,
    reenviarCodigo,
    registrar,
    loading,
    error,
    limpiarError,
  } = useAuth();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});

  async function enviarEmail() {
    if (!emailValido(email)) {
      setErrores({ email: 'Ingresá un email válido.' });
      return;
    }
    setErrores({});
    if (await solicitarCodigoRegistro(email)) setPaso(2);
  }

  async function verificar(c) {
    if (await verificarCodigo(email, c)) {
      setCodigo(c);
      setPaso(3);
    }
  }

  function finalizar() {
    const e = {};
    const msg = validarContraseña(contraseña);
    if (msg) e.contraseña = msg;
    if (confirmacion !== contraseña) e.confirmacion = 'Las contraseñas no coinciden.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    // Si sale bien, App.js pasa solo al stack principal.
    registrar(email, codigo, contraseña);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.step}>Paso {paso} de 3</Text>

      <View style={styles.card}>
        <AuthError message={error} />

        {paso === 1 && (
          <>
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
              autoCorrect={false}
              placeholder="tu@email.com"
              onSubmitEditing={enviarEmail}
            />
            <AuthButton title="Enviar código" onPress={enviarEmail} loading={loading} />
          </>
        )}

        {paso === 2 && (
          <CodeStep
            email={email}
            loading={loading}
            onVerify={verificar}
            onResend={() => reenviarCodigo(email)}
            onChangeEmail={() => {
              limpiarError();
              setPaso(1);
            }}
          />
        )}

        {paso === 3 && (
          <>
            <AuthField
              label="Contraseña"
              value={contraseña}
              onChangeText={setContraseña}
              error={errores.contraseña}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Mínimo 8 caracteres, letras y números"
            />
            <AuthField
              label="Confirmar contraseña"
              value={confirmacion}
              onChangeText={setConfirmacion}
              error={errores.confirmacion}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Repetí la contraseña"
              onSubmitEditing={finalizar}
            />
            <AuthButton title="Crear cuenta" onPress={finalizar} loading={loading} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  step: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
});

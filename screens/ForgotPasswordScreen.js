import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import useAuth, { emailValido, validarContraseña } from '../hooks/useAuth';
import { AuthButton, AuthError, AuthField } from '../components/AuthUI';
import CodeStep from '../components/CodeStep';

export default function ForgotPasswordScreen({ navigation }) {
  const {
    solicitarRecupero,
    verificarCodigo,
    reenviarCodigo,
    restablecerContraseña,
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
  const [listo, setListo] = useState(false);

  async function enviarEmail() {
    if (!emailValido(email)) {
      setErrores({ email: 'Ingresá un email válido.' });
      return;
    }
    setErrores({});
    if (await solicitarRecupero(email)) setPaso(2);
  }

  async function verificar(c) {
    if (await verificarCodigo(email, c)) {
      setCodigo(c);
      setPaso(3);
    }
  }

  async function guardar() {
    const e = {};
    const msg = validarContraseña(contraseña);
    if (msg) e.contraseña = msg;
    if (confirmacion !== contraseña) e.confirmacion = 'Las contraseñas no coinciden.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    if (await restablecerContraseña(email, codigo, contraseña)) setListo(true);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.step}>Paso {listo ? 3 : paso} de 3</Text>

      <View style={styles.card}>
        <AuthError message={error} />

        {listo ? (
          <>
            <Text style={styles.ok}>
              Tu contraseña se actualizó. Ya podés ingresar.
            </Text>
            <AuthButton title="Volver a ingresar" onPress={() => navigation.popToTop()} />
          </>
        ) : (
          <>
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
                  label="Nueva contraseña"
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
                  onSubmitEditing={guardar}
                />
                <AuthButton title="Guardar contraseña" onPress={guardar} loading={loading} />
              </>
            )}
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
  ok: { fontSize: 16, color: '#111827', marginBottom: 16 },
});

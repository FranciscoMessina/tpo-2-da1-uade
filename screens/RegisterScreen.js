import { useState } from 'react';
import useAuth, { emailValido, validarContraseña } from '../hooks/useAuth';
import CodeStep from '../components/CodeStep';
import {
  Aviso,
  Boton,
  Campo,
  IndicadorPasos,
  Pantalla,
  Tarjeta,
} from '../components/ui';

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
    <Pantalla>
      <IndicadorPasos paso={paso} total={3} />

      <Tarjeta>
        {!!error && <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />}

        {paso === 1 && (
          <>
            <Campo
              etiqueta="Email"
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
            <Boton titulo="Enviar código" onPress={enviarEmail} cargando={loading} />
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
            <Campo
              etiqueta="Contraseña"
              value={contraseña}
              onChangeText={setContraseña}
              error={errores.contraseña}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Mínimo 8 caracteres, letras y números"
            />
            <Campo
              etiqueta="Confirmar contraseña"
              value={confirmacion}
              onChangeText={setConfirmacion}
              error={errores.confirmacion}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Repetí la contraseña"
              onSubmitEditing={finalizar}
            />
            <Boton titulo="Crear cuenta" onPress={finalizar} cargando={loading} />
          </>
        )}
      </Tarjeta>
    </Pantalla>
  );
}

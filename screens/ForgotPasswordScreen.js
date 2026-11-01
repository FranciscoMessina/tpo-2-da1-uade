import { useEffect, useState } from 'react';
import { useConexion } from '../context/ConexionContext';
import useAuth, { emailValido, validarContraseña } from '../hooks/useAuth';
import CodeStep from '../components/CodeStep';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Campo,
  IndicadorPasos,
  Pantalla,
  Tarjeta,
} from '../components/ui';

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
  const { hayConexion } = useConexion();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});
  const [listo, setListo] = useState(false);

  // El error vive en el contexto de auth: sin esto, un aviso de este flujo (p. ej. el
  // de reenvío de código) reaparecería en el login al salir de la pantalla.
  useEffect(() => limpiarError, [limpiarError]);

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
    <Pantalla>
      <IndicadorPasos paso={listo ? 3 : paso} total={3} />

      <Tarjeta>
        {!hayConexion && <AvisoSinConexion mensaje="Necesitás conexión para recuperar tu contraseña." />}
        {!!error && hayConexion && (
          <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />
        )}

        {listo ? (
          <>
            <Aviso tono="exito" mensaje="Tu contraseña se actualizó. Ya podés ingresar." />
            <Boton titulo="Volver a ingresar" onPress={() => navigation.popToTop()} />
          </>
        ) : (
          <>
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
                <Boton titulo="Enviar código" onPress={enviarEmail} cargando={loading} requiereConexion />
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
                  etiqueta="Nueva contraseña"
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
                  onSubmitEditing={guardar}
                />
                <Boton titulo="Guardar contraseña" onPress={guardar} cargando={loading} requiereConexion />
              </>
            )}
          </>
        )}
      </Tarjeta>
    </Pantalla>
  );
}

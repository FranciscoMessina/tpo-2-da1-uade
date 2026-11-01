import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConexion } from '../context/ConexionContext';
import useAuth, { emailValido } from '../hooks/useAuth';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Campo,
  Icono,
  Pantalla,
  Tarjeta,
  Texto,
  colores,
  espacio,
  estilosPantalla,
  radios,
} from '../components/ui';

export default function LoginScreen({ navigation }) {
  const { iniciarSesion, loading, error, limpiarError } = useAuth();
  const { hayConexion } = useConexion();
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
    <SafeAreaView edges={['top']} style={estilosPantalla.pantalla}>
      <Pantalla estiloContenido={styles.contenido}>
        <View style={styles.marca}>
          <View style={styles.logo}>
            <Icono nombre="map-marker-check" tamano={36} color={colores.textoInverso} />
          </View>
          <Texto variante="pantalla" centrado>Ingresá a Hallado</Texto>
        </View>

        <Tarjeta>
          {!hayConexion && <AvisoSinConexion mensaje="Necesitás conexión para ingresar." />}
          {!!error && hayConexion && (
            <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />
          )}

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
            autoComplete="email"
            autoCorrect={false}
            placeholder="tu@email.com"
          />
          <Campo
            etiqueta="Contraseña"
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
          <Boton titulo="Ingresar" onPress={enviar} cargando={loading} requiereConexion />
          <Boton
            titulo="Olvidé mi contraseña"
            variante="terciario"
            chico
            onPress={() => {
              limpiarError();
              navigation.navigate('RecuperarContraseña');
            }}
          />
        </Tarjeta>

        <Boton
          titulo="¿No tenés cuenta? Registrate"
          variante="terciario"
          onPress={() => {
            limpiarError();
            navigation.navigate('Registro');
          }}
        />
      </Pantalla>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center' },
  marca: { alignItems: 'center', gap: espacio.sm, marginBottom: espacio.xs },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radios.tarjeta,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

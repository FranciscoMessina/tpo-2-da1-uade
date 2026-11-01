import { useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { conActividadExterna } from '../services/actividadExterna';
import SelectorBarrio from '../components/SelectorBarrio';
import ReputationCard from '../components/ReputationCard';
import BadgesCard from '../components/BadgesCard';
import usePerfil from '../hooks/usePerfil';
import useAuth from '../hooks/useAuth';
import { useConexion } from '../context/ConexionContext';
import { estaConectado } from '../services/conexion';
import {
  Avatar,
  Aviso,
  Boton,
  Campo,
  Cargando,
  ErrorConReintento,
  FilaDato,
  FilaInterruptor,
  FilaMenu,
  Pantalla,
  Seccion,
  Separador,
  Tarjeta,
  Texto,
  espacio,
  estilosPantalla,
} from '../components/ui';

const MENSAJE_SIN_CONEXION =
  'Sin conexión: no se puede guardar el perfil. Podés seguir editando y guardar cuando vuelva la conexión.';

const AYUDA_PRIVACIDAD =
  'Esta preferencia indica si querés compartir tu teléfono con la otra parte una vez aceptado un reclamo. Tu teléfono no se muestra en el perfil público.';

export default function ProfileScreen({ navigation }) {
  const { cerrarSesion, loading: loadingAuth } = useAuth();
  const { hayConexion } = useConexion();
  const sinConexion = !hayConexion;
  const {
    perfil,
    loading,
    guardando,
    error: errorPerfil,
    guardarPerfil,
    recargarPerfil,
  } = usePerfil();
  useFocusEffect(recargarPerfil);

  const nombre = perfil?.name ?? '';
  const barrio = perfil?.zone ?? '';
  const telefono = perfil?.phone ?? '';
  const foto = perfil?.avatarUrl ?? null;
  const compartirTelefono = perfil?.sharePhone ?? false;
  const [nombreIngresado, setNombreIngresado] = useState('');
  const [barrioIngresado, setBarrioIngresado] = useState('');
  const [telefonoIngresado, setTelefonoIngresado] = useState('');
  const [fotoIngresada, setFotoIngresada] = useState(null);
  const [compartirTelefonoIngresado, setCompartirTelefonoIngresado] =
    useState(false);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');

  const fotoVisible = editando ? fotoIngresada : foto;

  function iniciarEdicion() {
    setNombreIngresado(nombre);
    setBarrioIngresado(barrio);
    setTelefonoIngresado(telefono);
    setFotoIngresada(foto);
    setCompartirTelefonoIngresado(compartirTelefono);
    setError('');
    setEditando(true);
  }

  function cancelarEdicion() {
    setError('');
    setEditando(false);
  }

  async function guardarCambios() {
    const nombreLimpio = nombreIngresado.trim();
    const barrioLimpio = barrioIngresado.trim();
    const telefonoLimpio = telefonoIngresado.trim();

    if (nombreLimpio.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    if (telefonoLimpio !== '' && telefonoLimpio.length < 6) {
      setError('El teléfono debe tener al menos 6 caracteres.');
      return;
    }

    if (compartirTelefonoIngresado && telefonoLimpio === '') {
      setError('Ingresá un teléfono para poder compartirlo.');
      return;
    }

    // Guardar es una mutación: se vuelve a comprobar la conexión al tocar, por si cayó
    // entre el último render y el toque.
    if (!estaConectado()) {
      setError(MENSAJE_SIN_CONEXION);
      return;
    }

    setError('');

    const ok = await guardarPerfil({
      name: nombreLimpio,
      zone: barrioLimpio,
      phone: telefonoLimpio,
      avatarUrl: fotoIngresada,
      sharePhone: compartirTelefonoIngresado,
    });

    if (!ok) return;

    setError('');
    setEditando(false);
  }

  async function cambiarFoto() {
    setError('');

    try {
      const resultado = await conActividadExterna(() => ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      }));

      if (!resultado.canceled && resultado.assets?.[0]) {
        setFotoIngresada(resultado.assets[0].uri);
      }
    } catch {
      setError('No se pudo seleccionar la foto. Intentá nuevamente.');
    }
  }

  function abrirPerfilPublico() {
    navigation.navigate('PerfilPublico', {
      usuario: { id: perfil.id },
    });
  }

  if (loading) return <Cargando pantalla />;

  if (!perfil) {
    return (
      <View style={estilosPantalla.centrado}>
        <ErrorConReintento
          mensaje={errorPerfil || 'No se pudo cargar el perfil.'}
          onReintentar={recargarPerfil}
        />
      </View>
    );
  }

  const mensajeError = error || errorPerfil;

  return (
    <Pantalla
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={recargarPerfil} />
      }
    >
      <View style={styles.cabecera}>
        <Avatar uri={fotoVisible} nombre={nombre} />
        <Texto variante="pantalla" centrado>{nombre}</Texto>

        {editando && (
          <Boton
            titulo="Cambiar foto"
            icono="camera-outline"
            variante="secundario"
            chico
            onPress={cambiarFoto}
            disabled={guardando}
          />
        )}
      </View>

      {editando ? (
        <>
          <Seccion titulo="Tus datos">
            {sinConexion && (
              <Aviso
                tono="aviso"
                icono="wifi-off"
                mensaje={MENSAJE_SIN_CONEXION}
                accessibilityRole="alert"
              />
            )}

            {mensajeError !== '' && (
              <Aviso tono="peligro" mensaje={mensajeError} accessibilityRole="alert" />
            )}

            <Campo
              etiqueta="Nombre"
              editable={!guardando}
              value={nombreIngresado}
              onChangeText={setNombreIngresado}
              placeholder="Ingresá tu nombre"
              autoCapitalize="words"
              maxLength={80}
            />

            <SelectorBarrio
              etiqueta="Barrio"
              accessibilityLabel="Barrio"
              placeholder="Elegir barrio (opcional)"
              disabled={guardando}
              valor={barrioIngresado}
              onChange={setBarrioIngresado}
              permitirVaciar
            />

            <Campo
              etiqueta="Teléfono"
              editable={!guardando}
              value={telefonoIngresado}
              onChangeText={setTelefonoIngresado}
              placeholder="Ingresá tu teléfono"
              keyboardType="phone-pad"
              maxLength={30}
            />
          </Seccion>

          <Seccion titulo="Privacidad del teléfono" descripcion={AYUDA_PRIVACIDAD}>
            <FilaInterruptor
              etiqueta="Compartir mi teléfono al aceptar un reclamo"
              valor={compartirTelefonoIngresado}
              onChange={setCompartirTelefonoIngresado}
              disabled={guardando}
            />
          </Seccion>

          <Boton
            titulo={guardando ? 'Guardando…' : 'Guardar cambios'}
            onPress={guardarCambios}
            cargando={guardando}
            disabled={sinConexion}
          />

          <Boton
            titulo="Cancelar"
            variante="terciario"
            onPress={cancelarEdicion}
            disabled={guardando}
          />
        </>
      ) : (
        <>
          <Tarjeta>
            {mensajeError !== '' && (
              <Aviso tono="peligro" mensaje={mensajeError} accessibilityRole="alert" />
            )}

            <FilaDato etiqueta="Nombre" valor={nombre} />
            <FilaDato etiqueta="Barrio" valor={barrio || 'No informado'} />
            <FilaDato etiqueta="Teléfono" valor={telefono || 'No informado'} />
            <FilaDato
              etiqueta="Privacidad del teléfono"
              valor={compartirTelefono
                ? 'Compartir al aceptar un reclamo'
                : 'Comunicarme solo por la app'}
            />

            <Texto variante="leyenda" tono="secundario">{AYUDA_PRIVACIDAD}</Texto>

            <Boton
              titulo="Editar perfil"
              icono="pencil-outline"
              variante="secundario"
              onPress={iniciarEdicion}
            />
          </Tarjeta>

          <ReputationCard reputacion={perfil.reputation} />

          <BadgesCard insignias={perfil.badges} />

          <Tarjeta sinRelleno>
            <FilaMenu
              titulo="Mis publicaciones"
              icono="file-document-outline"
              onPress={() => navigation.navigate('MisPublicaciones')}
            />
            <Separador />
            <FilaMenu
              titulo="Ver mi perfil público"
              icono="account-outline"
              onPress={abrirPerfilPublico}
            />
            <Separador />
            <FilaMenu
              titulo="Historial de devoluciones"
              icono="history"
              onPress={() => navigation.navigate('Historial')}
            />
            <Separador />
            <FilaMenu
              titulo="Configuración"
              icono="cog-outline"
              onPress={() => navigation.navigate('Configuracion')}
            />
            <Separador />
            <FilaMenu
              titulo={loadingAuth ? 'Cerrando sesión…' : 'Cerrar sesión'}
              icono="logout"
              peligro
              disabled={loadingAuth}
              onPress={cerrarSesion}
            />
          </Tarjeta>
        </>
      )}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  cabecera: {
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.xs,
  },
});

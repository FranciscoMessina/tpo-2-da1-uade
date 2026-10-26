import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ReputationCard from '../components/ReputationCard';
import BadgesCard from '../components/BadgesCard';
import usePerfil from '../hooks/usePerfil';
import MisPublicaciones from '../components/MisPublicaciones';
import useAuth from '../hooks/useAuth';

export default function ProfileScreen({ navigation }) {
  const { cerrarSesion, loading: loadingAuth } = useAuth();
  const {
    perfil,
    loading,
    guardando,
    error: errorPerfil,
    guardarPerfil,
    recargarPerfil,
  } = usePerfil();
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

    if (barrioLimpio !== '' && barrioLimpio.length < 2) {
      setError('El barrio debe tener al menos 2 caracteres.');
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
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!perfil) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {errorPerfil || 'No se pudo cargar el perfil.'}
        </Text>
        <Button title="Reintentar" onPress={recargarPerfil} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          {fotoVisible ? (
            <Image
              source={{ uri: fotoVisible }}
              style={styles.photo}
            />
          ) : (
            <Text style={styles.avatarText}>Sin foto</Text>
          )}
        </View>

        <Text style={styles.name}>{nombre}</Text>

        {editando && (
          <View style={styles.photoActions}>
            <Button
              title="Cambiar foto"
              onPress={cambiarFoto}
              disabled={guardando}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>

        {editando ? (
          <TextInput
            style={styles.input}
            editable={!guardando}
            value={nombreIngresado}
            onChangeText={setNombreIngresado}
            placeholder="Ingresá tu nombre"
            autoCapitalize="words"
            maxLength={80}
          />
        ) : (
          <Text style={styles.value}>{nombre}</Text>
        )}

        {(error || errorPerfil) !== '' && (
          <Text style={styles.error}>{error || errorPerfil}</Text>
        )}

        <Text style={styles.label}>Barrio</Text>

        {editando ? (
          <TextInput
            style={styles.input}
            editable={!guardando}
            value={barrioIngresado}
            onChangeText={setBarrioIngresado}
            placeholder="Ingresá tu barrio"
            autoCapitalize="words"
            maxLength={100}
          />
        ) : (
          <Text style={styles.value}>
            {barrio || 'No informado'}
          </Text>
        )}

        <Text style={styles.label}>Teléfono</Text>

        {editando ? (
          <TextInput
            style={styles.input}
            editable={!guardando}
            value={telefonoIngresado}
            onChangeText={setTelefonoIngresado}
            placeholder="Ingresá tu teléfono"
            keyboardType="phone-pad"
            maxLength={30}
          />
        ) : (
          <Text style={styles.value}>
            {telefono || 'No informado'}
          </Text>
        )}

        <View style={styles.privacySection}>
          <Text style={styles.sectionTitle}>
            Privacidad del teléfono
          </Text>

          {editando ? (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Compartir mi teléfono al aceptar un reclamo
              </Text>

              <Switch
                value={compartirTelefonoIngresado}
                onValueChange={setCompartirTelefonoIngresado}
                disabled={guardando}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={
                  compartirTelefonoIngresado ? '#1D4ED8' : '#F9FAFB'
                }
                accessibilityLabel="Compartir mi teléfono al aceptar un reclamo"
              />
            </View>
          ) : (
            <Text style={styles.preferenceText}>
              {compartirTelefono
                ? 'Compartir al aceptar un reclamo'
                : 'Comunicarme solo por la app'}
            </Text>
          )}

          <Text style={styles.privacyHelp}>
            Esta preferencia indica si querés compartir tu teléfono con la
            otra parte una vez aceptado un reclamo. Tu teléfono no se muestra
            en el perfil público.
          </Text>
        </View>

        {editando ? (
          <View style={styles.buttons}>
            <Button
              title={guardando ? 'Guardando…' : 'Guardar cambios'}
              onPress={guardarCambios}
              disabled={guardando}
            />

            <Button
              title="Cancelar"
              onPress={cancelarEdicion}
              disabled={guardando}
              color="#6B7280"
            />
          </View>
        ) : (
          <Button
            title="Editar perfil"
            onPress={iniciarEdicion}
          />
        )}
      </View>

      {!editando && (
        <View style={styles.publicProfileButton}>
          <MisPublicaciones navigation={navigation} />

          <ReputationCard reputacion={perfil.reputation} />

          <BadgesCard insignias={perfil.badges} />

          <Button
            title="Ver mi perfil público"
            onPress={abrirPerfilPublico}
          />

          <View style={styles.configButton}>
            <Button
              title="Mis reclamos (enviados y recibidos)"
              onPress={() => navigation.navigate('MisReclamos')}
            />
          </View>

          <View style={styles.configButton}>
            <Button
              title="Configuración"
              onPress={() => navigation.navigate('Configuracion')}
              color="#6B7280"
            />
          </View>
        </View>
      )}

      {!editando && (
        <View style={styles.configButton}>
          <Button
            title={loadingAuth ? 'Cerrando sesión…' : 'Cerrar sesión'}
            onPress={cerrarSesion}
            disabled={loadingAuth}
            color="#DC2626"
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#1D4ED8',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  photoActions: {
    marginTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#111827',
    marginBottom: 20,
  },
  error: {
    color: '#DC2626',
    marginBottom: 16,
  },
  privacySection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginBottom: 24,
  },
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
  switchLabel: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  preferenceText: {
    fontSize: 16,
    color: '#1D4ED8',
    marginBottom: 12,
  },
  privacyHelp: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configButton: {
    marginTop: 12,
  },
  publicProfileButton: {
    marginTop: 16,
  },
});
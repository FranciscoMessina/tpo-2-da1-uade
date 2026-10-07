import { useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const usuarioEjemplo = {
  name: 'Usuario de prueba',
  zone: 'Centro',
  phone: '',
};

export default function ProfileScreen() {
  const [nombre, setNombre] = useState(usuarioEjemplo.name);
  const [nombreIngresado, setNombreIngresado] = useState(usuarioEjemplo.name);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');
  const [barrio, setBarrio] = useState(usuarioEjemplo.zone);
  const [barrioIngresado, setBarrioIngresado] = useState(usuarioEjemplo.zone);
  const [telefono, setTelefono] = useState(usuarioEjemplo.phone);
  const [telefonoIngresado, setTelefonoIngresado] = useState(usuarioEjemplo.phone);

  function iniciarEdicion() {
  setNombreIngresado(nombre);
  setBarrioIngresado(barrio);
  setTelefonoIngresado(telefono);
  setError('');
  setEditando(true);
}

  function guardarCambios() {
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

  setNombre(nombreLimpio);
  setBarrio(barrioLimpio);
  setTelefono(telefonoLimpio);
  setError('');
  setEditando(false);
}

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Mi perfil</Text>

      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>Sin foto</Text>
        </View>

        <Text style={styles.name}>{nombre}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>

        {editando ? (
          <TextInput
            style={styles.input}
            value={nombreIngresado}
            onChangeText={setNombreIngresado}
            placeholder="Ingresá tu nombre"
            autoCapitalize="words"
            maxLength={80}
          />
        ) : (
          <Text style={styles.value}>{nombre}</Text>
        )}

        {error !== '' && (
          <Text style={styles.error}>{error}</Text>
        )}

        <Text style={styles.label}>Barrio</Text>

{editando ? (
  <TextInput
    style={styles.input}
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

        {editando ? (
          <View style={styles.buttons}>
            <Button
              title="Guardar cambios"
              onPress={guardarCambios}
            />
            <Button
              title="Cancelar"
              onPress={() => setEditando(false)}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
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
  avatarText: {
    color: '#1D4ED8',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
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
  buttons: {
    gap: 12,
  },
});
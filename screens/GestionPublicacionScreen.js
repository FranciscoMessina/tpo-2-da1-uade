import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useGestionPublicacion from '../hooks/useGestionPublicacion';
import { CATEGORIAS } from '../data/searchDemo';

const NOMBRE_ESTADO = {
  abierta: 'Abierta',
  en_reclamo: 'En reclamo',
  resuelta: 'Resuelta',
};

export default function GestionPublicacionScreen({ route, navigation }) {
  const publicacionId = route.params?.publicacionId;
  const {
    publicacion,
    reclamos,
    valoracion,
    loading,
    error,
    guardarCambios,
    aceptarReclamo,
    rechazarReclamo,
    marcarResuelta,
    valorar,
    eliminar,
  } = useGestionPublicacion(publicacionId);

  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [positiva, setPositiva] = useState(true);
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (publicacion && !form) {
      setForm({
        titulo: publicacion.titulo,
        descripcion: publicacion.descripcion,
        categoria: publicacion.categoria,
        barrio: publicacion.barrio,
      });
    }
  }, [publicacion, form]);

  if (loading && !publicacion) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!publicacion || !form) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.error}>
          {error || 'No se encontró la publicación.'}
        </Text>
      </View>
    );
  }

  const cambiar = (campo) => (valor) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }));

  async function guardar() {
    const r = await guardarCambios(form);
    setMensaje(r.ok ? 'Cambios guardados.' : '');
  }

  function confirmarEliminar() {
    Alert.alert(
      'Eliminar publicación',
      'Esta acción no se puede deshacer. ¿Querés eliminarla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const r = await eliminar();
            if (r.ok) navigation.goBack();
          },
        },
      ]
    );
  }

  const aceptado = reclamos.find((r) => r.estado === 'aceptado');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.estado}>
          Estado: {NOMBRE_ESTADO[publicacion.estado]}
        </Text>

        {publicacion.direccionExacta && (
          <Text style={styles.direccion}>
            Dirección exacta: {publicacion.direccionExacta}
          </Text>
        )}

        {error !== '' && <Text style={styles.error}>{error}</Text>}
        {mensaje !== '' && <Text style={styles.ok}>{mensaje}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Editar publicación</Text>

        <Text style={styles.label}>Título</Text>
        <TextInput
          style={styles.input}
          value={form.titulo}
          onChangeText={cambiar('titulo')}
          maxLength={100}
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.multilinea]}
          value={form.descripcion}
          onChangeText={cambiar('descripcion')}
          multiline
          maxLength={500}
        />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {CATEGORIAS.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => cambiar('categoria')(cat)}
              style={[styles.chip, form.categoria === cat && styles.chipActivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: form.categoria === cat }}
            >
              <Text
                style={[
                  styles.chipTexto,
                  form.categoria === cat && styles.chipTextoActivo,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Barrio</Text>
        <TextInput
          style={styles.input}
          value={form.barrio}
          onChangeText={cambiar('barrio')}
          autoCapitalize="words"
          maxLength={100}
        />

        <Button title="Guardar cambios" onPress={guardar} />
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Reclamos recibidos</Text>

        {reclamos.length === 0 && (
          <Text style={styles.vacio}>Todavía no recibiste reclamos.</Text>
        )}

        {reclamos.map((r) => (
          <View key={r.id} style={styles.reclamo}>
            <Text style={styles.reclamoUsuario}>{r.usuario}</Text>
            <Text style={styles.reclamoMensaje}>{r.mensaje}</Text>

            {r.estado === 'aceptado' && (
              <Text style={styles.ok}>
                Aceptado.{' '}
                {r.telefono
                  ? `Teléfono: ${r.telefono}`
                  : 'Esta persona prefiere comunicarse solo por la app.'}
              </Text>
            )}
            {r.estado === 'rechazado' && (
              <Text style={styles.vacio}>Rechazado</Text>
            )}

            {publicacion.estado !== 'resuelta' && r.estado !== 'rechazado' && (
              <View style={styles.fila}>
                {r.estado === 'pendiente' && (
                  <Button
                    title="Aceptar"
                    onPress={() => aceptarReclamo(r.id)}
                  />
                )}
                <Button
                  title="Rechazar"
                  color="#DC2626"
                  onPress={() => rechazarReclamo(r.id)}
                />
              </View>
            )}
          </View>
        ))}

        {publicacion.estado === 'en_reclamo' && aceptado && (
          <Button
            title="Marcar como resuelta (devolución concretada)"
            onPress={marcarResuelta}
          />
        )}
      </View>

      {publicacion.estado === 'resuelta' && (
        <View style={styles.card}>
          <Text style={styles.titulo}>
            Valorar a {aceptado ? aceptado.usuario : 'la otra parte'}
          </Text>

          {valoracion ? (
            <Text style={styles.ok}>
              Enviaste una valoración {valoracion.positiva ? 'positiva' : 'negativa'}.
            </Text>
          ) : (
            <>
              <View style={styles.fila}>
                <Pressable
                  onPress={() => setPositiva(true)}
                  style={[styles.chip, positiva && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, positiva && styles.chipTextoActivo]}>
                    Positiva
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPositiva(false)}
                  style={[styles.chip, !positiva && styles.chipNegativo]}
                >
                  <Text style={[styles.chipTexto, !positiva && styles.chipTextoActivo]}>
                    Negativa
                  </Text>
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, styles.multilinea]}
                value={comentario}
                onChangeText={setComentario}
                placeholder="Comentario (opcional)"
                multiline
                maxLength={300}
              />

              <Button
                title="Enviar valoración"
                onPress={() => valorar({ positiva, comentario })}
              />
            </>
          )}
        </View>
      )}

      <Button
        title="Eliminar publicación"
        color="#DC2626"
        onPress={confirmarEliminar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 24, gap: 16 },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 24,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  estado: { fontSize: 16, fontWeight: 'bold', color: '#1D4ED8' },
  direccion: { fontSize: 16, color: '#111827', marginTop: 8 },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#111827',
    marginBottom: 20,
  },
  multilinea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActivo: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipNegativo: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  chipTexto: { color: '#111827' },
  chipTextoActivo: { color: '#FFFFFF' },
  reclamo: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    gap: 6,
  },
  reclamoUsuario: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  reclamoMensaje: { fontSize: 15, color: '#374151' },
  fila: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  vacio: { color: '#6B7280' },
  error: { color: '#DC2626', marginTop: 8 },
  ok: { color: '#047857', marginTop: 4 },
});

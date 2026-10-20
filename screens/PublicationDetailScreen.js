import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReputationCard from '../components/ReputationCard';
import usePublicacion from '../hooks/usePublicacion';

const ESTADOS = {
  abierta: { texto: 'Abierta', fondo: '#DCFCE7', color: '#166534' },
  enReclamo: { texto: 'En reclamo', fondo: '#FEF3C7', color: '#92400E' },
  resuelta: { texto: 'Resuelta', fondo: '#E5E7EB', color: '#374151' },
};

export default function PublicationDetailScreen({ route, navigation }) {
  const { publicacionId } = route.params;
  const {
    publicacion,
    loading,
    error,
    esPropia,
    siguiendo,
    toggleSeguir,
    reclamar,
  } = usePublicacion(publicacionId);

  const { width } = useWindowDimensions();
  const [foto, setFoto] = useState(0);
  const [mostrarReclamo, setMostrarReclamo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (error || !publicacion) {
    return (
      <View style={styles.center}>
        <Text style={styles.help}>
          {error || 'No encontramos la publicación.'}
        </Text>
      </View>
    );
  }

  const encontrado = publicacion.tipo === 'encontrado';
  const estado = ESTADOS[publicacion.estado];

  async function enviarReclamo() {
    setEnviando(true);
    try {
      await reclamar(mensaje.trim());
      setMostrarReclamo(false);
      setMensaje('');
    } catch {
      Alert.alert('Error', 'No pudimos enviar el reclamo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.screen}>
      <FlatList
        data={publicacion.fotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, indice) => String(indice)}
        onMomentumScrollEnd={(evento) =>
          setFoto(Math.round(evento.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View
            style={[styles.photo, { width }]}
            accessibilityLabel={`Foto de ${publicacion.categoria}`}
          >
            <Text style={styles.icon}>{publicacion.icono}</Text>
            <Text style={styles.photoLabel}>
              {item ? 'Foto' : 'Foto de ejemplo'}
            </Text>
          </View>
        )}
      />

      <Text style={styles.counter}>
        Foto {foto + 1} de {publicacion.fotos.length}
      </Text>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.type}>
            {encontrado ? 'ENCONTRADO' : 'PERDIDO'}
          </Text>
          <View style={[styles.badge, { backgroundColor: estado.fondo }]}>
            <Text style={[styles.badgeText, { color: estado.color }]}>
              {estado.texto}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{publicacion.titulo}</Text>
        <Text style={styles.body}>{publicacion.descripcion}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Categoría</Text>
          <Text style={styles.value}>{publicacion.categoria}</Text>

          <Text style={styles.label}>Fecha del suceso</Text>
          <Text style={styles.value}>
            {publicacion.fecha.split('-').reverse().join('/')}
          </Text>

          <Text style={styles.label}>Franja horaria</Text>
          <Text style={styles.value}>{publicacion.franja}</Text>

          <Text style={styles.label}>Barrio</Text>
          <Text style={styles.value}>{publicacion.barrio}</Text>

          <Text style={styles.label}>Dirección exacta</Text>
          <Text style={styles.value}>
            {publicacion.direccionExacta ||
              'Se muestra cuando el reclamo sea aceptado.'}
          </Text>
        </View>

        <Text style={styles.section}>Publicado por</Text>
        <Text style={styles.value}>{publicacion.publicador.name}</Text>
        <ReputationCard reputacion={publicacion.publicador.reputation} />
        <Button
          title="Ver perfil"
          onPress={() =>
            navigation.navigate('PerfilPublico', {
              usuario: publicacion.publicador,
            })
          }
        />

        <View style={styles.actions}>
          {esPropia ? (
            <Button
              title="Gestionar publicación"
              onPress={() =>
                navigation.navigate('GestionPublicacion', {
                  publicacionId,
                })
              }
            />
          ) : (
            <Button
              title={
                publicacion.reclamoEnviado
                  ? 'Reclamo enviado'
                  : encontrado
                    ? 'Es mío'
                    : 'Lo encontré'
              }
              disabled={
                publicacion.reclamoEnviado ||
                publicacion.estado === 'resuelta'
              }
              onPress={() => setMostrarReclamo(true)}
            />
          )}

          <Button
            title={siguiendo ? 'Dejar de seguir' : 'Seguir publicación'}
            color="#6B7280"
            onPress={toggleSeguir}
          />
        </View>
      </View>

      <Modal
        visible={mostrarReclamo}
        animationType="slide"
        onRequestClose={() => setMostrarReclamo(false)}
      >
        <SafeAreaView style={styles.screen}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {encontrado ? 'Reclamar como tuyo' : 'Avisar que lo encontraste'}
            </Text>
            <Text style={styles.help}>
              Escribile un mensaje al publicador para que pueda verificar el
              reclamo.
            </Text>
            <TextInput
              style={styles.input}
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Mensaje"
              multiline
            />
            <Button
              title={enviando ? 'Enviando…' : 'Confirmar y enviar'}
              disabled={enviando || !mensaje.trim()}
              onPress={enviarReclamo}
            />
            <Button
              title="Cancelar"
              color="#6B7280"
              onPress={() => setMostrarReclamo(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  content: { padding: 20, gap: 14 },
  photo: {
    height: 220,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  icon: { fontSize: 64 },
  photoLabel: { color: '#1D4ED8', fontSize: 13 },
  counter: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: { color: '#1D4ED8', fontSize: 12, fontWeight: 'bold' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  body: { fontSize: 16, color: '#374151', lineHeight: 24 },
  help: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  label: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  value: { fontSize: 16, color: '#111827' },
  section: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  actions: { gap: 12, marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
  },
});

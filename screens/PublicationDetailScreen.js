import { useConexion } from '../context/ConexionContext';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReputationCard from '../components/ReputationCard';
import usePublicacion from '../hooks/usePublicacion';
import { mensajeErrorApi } from '../services/api';
import { ZONAS } from '../data/searchDemo';

const ESTADOS = {
  abierta: { texto: 'Abierta', fondo: '#DCFCE7', color: '#166534' },
  en_reclamo: { texto: 'En reclamo', fondo: '#FEF3C7', color: '#92400E' },
  resuelta: { texto: 'Resuelta', fondo: '#E5E7EB', color: '#374151' },
  vencida: { texto: 'Vencida', fondo: '#FEE2E2', color: '#991B1B' },
};

const FRANJAS = {
  manana: 'Mañana (6 a 12 h)',
  tarde: 'Tarde (12 a 19 h)',
  noche: 'Noche (19 a 6 h)',
};

export default function PublicationDetailScreen({ route, navigation }) {
  return (
    <DetallePublicacion
      key={route.params.publicacionId}
      route={route}
      navigation={navigation}
    />
  );
}

function DetallePublicacion({ route, navigation }) {
  const { publicacionId } = route.params;
  const { hayConexion } = useConexion();
  const {
    publicacion,
    loading,
    error,
    esPropia,
    siguiendo,
    guardandoSeguimiento,
    errorSeguimiento,
    recargarSeguimiento,
    recargar,
    toggleSeguir,
    reclamar,
  } = usePublicacion(publicacionId);

  const { width } = useWindowDimensions();
  const [foto, setFoto] = useState(0);
  const [mostrarReclamo, setMostrarReclamo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [fotoUri, setFotoUri] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useFocusEffect(useCallback(() => {
    recargar();
  }, [recargar]));

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
        <Button title="Reintentar" onPress={recargar} />
      </View>
    );
  }

  const estaOffline = !hayConexion || publicacion?.esOffline;
  const encontrado = publicacion.tipo === 'encontrado';
  const estado = ESTADOS[publicacion.estado] || {
    texto: publicacion.estado, fondo: '#E5E7EB', color: '#374151',
  };
  const fotos = publicacion.fotos.length ? publicacion.fotos : [null];

  const miReclamo = publicacion.miReclamo;
  const intentosRealizados = miReclamo ? (miReclamo.intentos ?? 1) : 0;
  const proximoIntento = intentosRealizados + 1;
  const reclamoPendiente = miReclamo?.estado === 'pendiente' || publicacion.reclamoEnviado;
  const reclamoAceptado = miReclamo?.estado === 'aceptado' || publicacion.reclamoAceptado;
  const reclamoVencido = miReclamo?.estado === 'vencido';
  const reclamoRechazado = miReclamo?.estado === 'rechazado';
  const sinIntentos = !reclamoAceptado && !reclamoPendiente && intentosRealizados >= 3;

  let tituloBoton = encontrado ? 'Es mío' : 'Lo encontré';
  let botonDeshabilitado = publicacion.estado !== 'abierta';

  if (reclamoPendiente) {
    tituloBoton = 'Reclamo pendiente';
    botonDeshabilitado = true;
  } else if (reclamoAceptado) {
    tituloBoton = 'Reclamo aceptado';
    botonDeshabilitado = true;
  } else if (sinIntentos) {
    tituloBoton = 'Límite de 3 intentos alcanzado';
    botonDeshabilitado = true;
  } else if (reclamoVencido || reclamoRechazado) {
    tituloBoton = encontrado
      ? `Es mío (Reintentar intento ${proximoIntento} de 3)`
      : `Lo encontré (Reintentar intento ${proximoIntento} de 3)`;
  }

  const preguntaVerificacion =
    publicacion.preguntaVerificacion ||
    (publicacion.categoria === 'Llaves'
      ? '¿De qué color es el llavero o qué marca tienen las llaves?'
      : publicacion.categoria === 'Documentos'
        ? '¿A qué nombre está o qué número/fecha figura en el documento?'
        : publicacion.categoria === 'Mascotas'
          ? '¿Qué características particulares, nombre o collar tiene la mascota?'
          : publicacion.categoria === 'Electrónica'
            ? '¿Qué marca, modelo o detalle distintivo tiene el equipo?'
            : '¿Podés describir algún detalle o marca particular no visible en las fotos?');

  async function elegirFoto() {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets?.length) {
        setFotoUri(resultado.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'No pudimos acceder a las imágenes del dispositivo.');
    }
  }

  function quitarFoto() {
    setFotoUri(null);
  }

  function cerrarModal() {
    setMostrarReclamo(false);
    setMensaje('');
    setRespuesta('');
    setDescripcion('');
    setBarrio('');
    setFotoUri(null);
  }

  async function enviarReclamo() {
    if (!hayConexion) {
      Alert.alert('Sin conexión', 'Se necesita conexión a internet para enviar tu reclamo.');
      return;
    }
    setEnviando(true);
    try {
      const datosReclamo = encontrado
        ? {
            respuesta: respuesta.trim(),
            descripcion: descripcion.trim(),
            fotoUri,
          }
        : {
            barrio: barrio.trim(),
            fotoUri,
            mensaje: mensaje.trim(),
          };

      const reclamo = await reclamar(datosReclamo);
      if (!reclamo) return;
      cerrarModal();
      Alert.alert(
        'Reclamo enviado',
        encontrado
          ? `Tu reclamo (intento ${miReclamo ? proximoIntento : 1} de 3) fue enviado. Vence automáticamente a las 48 horas si no recibe respuesta.`
          : `Tu aviso (intento ${miReclamo ? proximoIntento : 1} de 3) fue enviado. Vence automáticamente a las 48 horas si no recibe respuesta.`
      );
    } catch (error) {
      Alert.alert('No se pudo enviar el reclamo', mensajeErrorApi(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.screen}>
      {estaOffline && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerOfflineIcon}>📡</Text>
          <View style={styles.bannerOfflineTexto}>
            <Text style={styles.bannerOfflineTitulo}>Modo sin conexión</Text>
            <Text style={styles.bannerOfflineMensaje}>
              {publicacion.esOffline
                ? 'Estás viendo una publicación guardada en tu dispositivo (fotos, detalle y barrio disponibles).'
                : 'Sin conexión a internet. Las acciones para reclamar, seguir o gestionar están deshabilitadas.'}
            </Text>
          </View>
        </View>
      )}
      <FlatList
        data={fotos}
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
            {item ? (
              <Image source={{ uri: item }} style={styles.image} resizeMode="cover" />
            ) : (
              <>
                <Text style={styles.icon}>📦</Text>
                <Text style={styles.photoLabel}>Sin fotos</Text>
              </>
            )}
          </View>
        )}
      />

      <Text style={styles.counter}>
        {publicacion.fotos.length ? `Foto ${foto + 1} de ${publicacion.fotos.length}` : 'Sin fotos adjuntas'}
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
          <Text style={styles.value}>{FRANJAS[publicacion.franja] || publicacion.franja}</Text>

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
          {!esPropia && reclamoPendiente && (
            <View style={styles.statusCardPendiente}>
              <Text style={styles.statusTitlePendiente}>
                ⏳ Reclamo pendiente (Intento {intentosRealizados} de 3)
              </Text>
              <Text style={styles.statusText}>
                Tu reclamo está a la espera de respuesta del publicador. Vence automáticamente a las 48 horas si no recibe respuesta.
              </Text>
            </View>
          )}

          {!esPropia && reclamoVencido && (
            <View style={styles.statusCardVencido}>
              <Text style={styles.statusTitleVencido}>
                ⏰ Reclamo vencido (Intento {intentosRealizados} de 3)
              </Text>
              <Text style={styles.statusText}>
                Tu reclamo anterior venció automáticamente al cumplirse 48 horas sin respuesta.
                {intentosRealizados < 3
                  ? ` Podés volver a intentarlo (intento ${proximoIntento} de 3).`
                  : ' Ya utilizaste los 3 intentos permitidos para esta publicación.'}
              </Text>
            </View>
          )}

          {!esPropia && reclamoRechazado && (
            <View style={styles.statusCardRechazado}>
              <Text style={styles.statusTitleRechazado}>
                ❌ Reclamo rechazado (Intento {intentosRealizados} de 3)
              </Text>
              <Text style={styles.statusText}>
                El publicador no confirmó tu reclamo anterior.
                {intentosRealizados < 3
                  ? ` Podés intentarlo nuevamente (intento ${proximoIntento} de 3).`
                  : ' Ya utilizaste los 3 intentos permitidos para esta publicación.'}
              </Text>
            </View>
          )}

          {!esPropia && reclamoAceptado && (
            <View style={styles.statusCardAceptado}>
              <Text style={styles.statusTitleAceptado}>
                ✅ Reclamo aceptado
              </Text>
              <Text style={styles.statusText}>
                ¡El publicador aceptó tu reclamo! Podés coordinar la entrega con él.
              </Text>
            </View>
          )}

          {esPropia ? (
            <>
              <Button
                title="Gestionar publicación"
                color={estaOffline ? '#9CA3AF' : '#1D4ED8'}
                disabled={estaOffline}
                onPress={() =>
                  navigation.navigate('GestionPublicacion', {
                    publicacionId,
                  })
                }
              />
              {estaOffline && (
                <View style={styles.avisoAccionOffline}>
                  <Text style={styles.avisoAccionOfflineTexto}>
                    ⚠️ Se necesita conexión a internet para gestionar tu publicación.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Button
                title={tituloBoton}
                color={botonDeshabilitado || estaOffline ? '#9CA3AF' : '#1D4ED8'}
                disabled={botonDeshabilitado || estaOffline}
                onPress={() => setMostrarReclamo(true)}
              />
              {estaOffline && !reclamoAceptado && !reclamoPendiente && (
                <View style={styles.avisoAccionOffline}>
                  <Text style={styles.avisoAccionOfflineTexto}>
                    ⚠️ Se necesita conexión para reclamar esta publicación.
                  </Text>
                </View>
              )}
            </>
          )}

          {!esPropia && (
            <>
              <Button
                title={guardandoSeguimiento
                  ? 'Guardando seguimiento…'
                  : siguiendo ? 'Dejar de seguir' : 'Seguir publicación'}
                color={guardandoSeguimiento || estaOffline ? '#9CA3AF' : '#4B5563'}
                disabled={guardandoSeguimiento || estaOffline}
                onPress={toggleSeguir}
              />
              {estaOffline && (
                <View style={styles.avisoAccionOffline}>
                  <Text style={styles.avisoAccionOfflineTexto}>
                    ⚠️ Se necesita conexión para seguir o dejar de seguir esta publicación.
                  </Text>
                </View>
              )}
            </>
          )}
          {errorSeguimiento !== '' && (
            <>
              <Text accessibilityRole="alert" style={styles.error}>{errorSeguimiento}</Text>
              <Button
                title="Reintentar carga de seguidas"
                disabled={guardandoSeguimiento}
                onPress={recargarSeguimiento}
              />
            </>
          )}
          <Button
            title="Ver publicaciones seguidas"
            onPress={() => navigation.navigate('Seguidas')}
          />
          <Button
            title="Ir a Mis reclamos"
            onPress={() => navigation.navigate('MisReclamos')}
          />
        </View>
      </View>

      <Modal
        visible={mostrarReclamo}
        animationType="slide"
        onRequestClose={cerrarModal}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.attemptNotice}>
              <Text style={styles.attemptNoticeTitle}>
                Intento {miReclamo ? proximoIntento : 1} de 3
              </Text>
              <Text style={styles.attemptNoticeText}>
                Tenés un máximo de 3 intentos por publicación. Cada reclamo vence automáticamente a las 48 horas si no recibe respuesta.
              </Text>
            </View>

            <Text style={styles.title}>
              {encontrado ? 'Reclamar como tuyo' : 'Avisar que lo encontraste'}
            </Text>

            {encontrado ? (
              <>
                <Text style={styles.help}>
                  Para acreditar que el objeto es tuyo, respondé la pregunta de verificación definida por quien lo encontró.
                </Text>

                <View style={styles.questionCard}>
                  <Text style={styles.questionLabel}>Pregunta de verificación</Text>
                  <Text style={styles.questionText}>{preguntaVerificacion}</Text>
                </View>

                <Text style={styles.fieldLabel}>Tu respuesta (obligatoria):</Text>
                <TextInput
                  style={[styles.input, styles.inputShort]}
                  value={respuesta}
                  onChangeText={setRespuesta}
                  placeholder="Escribí tu respuesta…"
                  maxLength={300}
                  multiline
                />

                <Text style={styles.fieldLabel}>Descripción adicional (opcional):</Text>
                <TextInput
                  style={styles.input}
                  value={descripcion}
                  onChangeText={setDescripcion}
                  placeholder="Detalles o marcas para acreditar que te pertenece…"
                  maxLength={500}
                  multiline
                />

                <Text style={styles.fieldLabel}>Foto que acredite pertenencia (opcional):</Text>
                {fotoUri ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: fotoUri }} style={styles.previewImage} resizeMode="cover" />
                    <Button title="Quitar foto" color="#DC2626" onPress={quitarFoto} />
                  </View>
                ) : (
                  <Button
                    title="📷 Seleccionar foto del dispositivo"
                    color="#2563EB"
                    onPress={elegirFoto}
                  />
                )}

                <View style={styles.modalActions}>
                  <Button
                    title={enviando ? 'Enviando reclamo…' : 'Confirmar y enviar reclamo'}
                    disabled={enviando || !hayConexion || respuesta.trim().length < 2}
                    onPress={enviarReclamo}
                  />
                  <Button
                    title="Cancelar"
                    disabled={enviando}
                    color="#6B7280"
                    onPress={cerrarModal}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.help}>
                  Para que el dueño pueda confirmar si se trata de lo suyo, adjuntá una foto clara del objeto e indicá el barrio donde lo encontraste.
                </Text>

                <Text style={styles.fieldLabel}>
                  Barrio donde lo encontraste (obligatorio):
                </Text>
                <View style={styles.chipContainer}>
                  {ZONAS.map((z) => (
                    <Pressable
                      key={z.nombre}
                      onPress={() => setBarrio(z.nombre)}
                      style={[
                        styles.chip,
                        barrio === z.nombre && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          barrio === z.nombre && styles.chipTextSelected,
                        ]}
                      >
                        {z.nombre}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, styles.inputShort]}
                  value={barrio}
                  onChangeText={setBarrio}
                  placeholder="Escribí o seleccioná el barrio…"
                  maxLength={50}
                />

                <Text style={styles.fieldLabel}>
                  Foto del objeto encontrado (obligatoria):
                </Text>
                {fotoUri ? (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: fotoUri }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                    <Button
                      title="Quitar foto"
                      color="#DC2626"
                      onPress={quitarFoto}
                    />
                  </View>
                ) : (
                  <Button
                    title="📷 Adjuntar foto del objeto encontrado"
                    color="#2563EB"
                    onPress={elegirFoto}
                  />
                )}

                <Text style={styles.fieldLabel}>
                  Mensaje o información adicional (opcional):
                </Text>
                <TextInput
                  style={styles.input}
                  value={mensaje}
                  onChangeText={setMensaje}
                  placeholder="Detalles adicionales sobre el estado del objeto o dónde lo guardás…"
                  maxLength={1000}
                  multiline
                />

                <View style={styles.modalActions}>
                  <Button
                    title={
                      enviando
                        ? 'Enviando aviso…'
                        : 'Confirmar y enviar aviso'
                    }
                    disabled={
                      enviando ||
                      !hayConexion ||
                      !fotoUri ||
                      barrio.trim().length < 2
                    }
                    onPress={enviarReclamo}
                  />
                  <Button
                    title="Cancelar"
                    disabled={enviando}
                    color="#6B7280"
                    onPress={cerrarModal}
                  />
                </View>
              </>
            )}
          </ScrollView>
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
  image: { width: '100%', height: '100%' },
  error: { fontSize: 15, color: '#991B1B' },
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
  inputShort: {
    minHeight: 60,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    lineHeight: 22,
  },
  previewContainer: {
    alignItems: 'center',
    gap: 10,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  modalActions: {
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipSelected: {
    backgroundColor: '#1D4ED8',
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  statusCardPendiente: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  statusTitlePendiente: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E',
  },
  statusCardVencido: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  statusTitleVencido: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#991B1B',
  },
  statusCardRechazado: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  statusTitleRechazado: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  statusCardAceptado: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  statusTitleAceptado: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#166534',
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  attemptNotice: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  attemptNoticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  attemptNoticeText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    margin: 16,
    marginBottom: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerOfflineIcon: {
    fontSize: 24,
  },
  bannerOfflineTexto: {
    flex: 1,
  },
  bannerOfflineTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  bannerOfflineMensaje: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  avisoAccionOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  avisoAccionOfflineTexto: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
});
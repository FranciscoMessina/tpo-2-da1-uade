import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useAuth from '../hooks/useAuth';
import useMensajesReclamo from '../hooks/useMensajesReclamo';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';

const MAX_MENSAJE = 2000;

function formatearFecha(fecha) {
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return '';
  const dia = f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} ${hora}`;
}

export default function ConversacionReclamoScreen({ route }) {
  const { reclamoId, contraparte, tituloPublicacion } = route.params;
  const { usuario } = useAuth();
  const { hayConexion } = useConexion();
  const { novedadesPorReclamo, marcarReclamoLeido } = useSearch();
  const {
    mensajes, cargando, cargado, error, refrescando, enviando, errorEnvio, recargar, enviar,
  } = useMensajesReclamo(reclamoId);
  const [texto, setTexto] = useState('');

  // Los mensajes que llegan con la conversación abierta ya se están leyendo.
  const sinLeer = novedadesPorReclamo.get(reclamoId) || 0;
  useEffect(() => {
    if (sinLeer > 0) marcarReclamoLeido(reclamoId);
  }, [sinLeer, reclamoId, marcarReclamoLeido]);

  async function manejarEnviar() {
    if (await enviar(texto)) setTexto('');
  }

  const puedeEnviar = hayConexion && !enviando && texto.trim().length > 0;

  function renderMensaje({ item }) {
    const propio = item.autorId === usuario?.id;
    return (
      <View style={[styles.burbuja, propio ? styles.burbujaPropia : styles.burbujaAjena]}>
        <Text style={[styles.textoMensaje, propio && styles.textoPropio]}>{item.texto}</Text>
        <Text style={[styles.fecha, propio && styles.fechaPropia]}>
          {formatearFecha(item.creadaEn)}
        </Text>
      </View>
    );
  }

  let contenido;
  if (cargando) {
    contenido = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  } else if (!cargado && !hayConexion) {
    contenido = (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📡</Text>
        <Text style={styles.emptyTitle}>Sin conexión</Text>
        <Text style={styles.emptySubtitle}>
          Necesitás conexión a internet para ver y enviar mensajes.
        </Text>
      </View>
    );
  } else if (!cargado && error) {
    contenido = (
      <View style={styles.center}>
        <Text style={styles.errorTexto}>{error}</Text>
        <Button title="Reintentar" onPress={recargar} />
      </View>
    );
  } else if (mensajes.length === 0) {
    contenido = (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyTitle}>Todavía no hay mensajes</Text>
        <Text style={styles.emptySubtitle}>
          Escribí el primero para coordinar la devolución sin compartir tu teléfono.
        </Text>
      </View>
    );
  } else {
    // Lista invertida: el mensaje más nuevo queda abajo, junto al teclado.
    contenido = (
      <FlatList
        inverted
        contentContainerStyle={styles.listContent}
        data={[...mensajes].reverse()}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMensaje}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} />}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {!hayConexion && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerOfflineTexto}>
            ⚠️ Sin conexión. No se actualizan ni se pueden enviar mensajes.
          </Text>
        </View>
      )}
      <View style={styles.encabezado}>
        <Text style={styles.encabezadoTitulo} numberOfLines={1}>
          {contraparte ? `Conversación con ${contraparte}` : 'Conversación'}
        </Text>
        {!!tituloPublicacion && (
          <Text style={styles.encabezadoDetalle} numberOfLines={1}>{tituloPublicacion}</Text>
        )}
      </View>
      {!!error && cargado && hayConexion && (
        <Text style={styles.avisoError}>No se pudo actualizar la conversación. {error}</Text>
      )}

      <View style={styles.cuerpo}>{contenido}</View>

      {!!errorEnvio && <Text style={styles.avisoError}>{errorEnvio}</Text>}
      <View style={styles.barraEnvio}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribí un mensaje"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={MAX_MENSAJE}
          editable={!enviando}
          accessibilityLabel="Mensaje"
        />
        <View style={styles.botonEnviar}>
          <Button
            title={enviando ? 'Enviando…' : 'Enviar'}
            color={!puedeEnviar ? '#9CA3AF' : undefined}
            disabled={!puedeEnviar}
            onPress={manejarEnviar}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  encabezado: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  encabezadoTitulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  encabezadoDetalle: {
    fontSize: 13,
    color: '#6B7280',
  },
  cuerpo: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  burbuja: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  burbujaPropia: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D4ED8',
    borderBottomRightRadius: 4,
  },
  burbujaAjena: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  textoMensaje: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 21,
  },
  textoPropio: {
    color: '#FFFFFF',
  },
  fecha: {
    fontSize: 11,
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
  fechaPropia: {
    color: '#BFDBFE',
  },
  errorTexto: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
  },
  avisoError: {
    fontSize: 13,
    color: '#991B1B',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerOfflineTexto: {
    fontSize: 13,
    color: '#78350F',
    fontWeight: '600',
  },
  barraEnvio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  botonEnviar: {
    justifyContent: 'center',
  },
});

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import useAuth from '../hooks/useAuth';
import useMensajesReclamo from '../hooks/useMensajesReclamo';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';
import {
  Aviso,
  Cargando,
  ErrorConReintento,
  EstadoVacio,
  Icono,
  Texto,
  Tocable,
  colores,
  espacio,
  estilosPantalla,
  radios,
  tipografia,
} from '../components/ui';

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
        <Texto variante="cuerpoChico" tono={propio ? 'inverso' : 'principal'}>{item.texto}</Texto>
        <Texto
          variante="leyenda"
          tono={propio ? 'inverso' : 'secundario'}
          style={styles.fecha}
        >
          {formatearFecha(item.creadaEn)}
        </Texto>
      </View>
    );
  }

  let contenido;
  if (cargando) {
    contenido = <Cargando pantalla />;
  } else if (!cargado && !hayConexion) {
    contenido = (
      <View style={estilosPantalla.centrado}>
        <EstadoVacio
          icono="wifi-off"
          tono="aviso"
          titulo="Sin conexión"
          mensaje="Necesitás conexión a internet para ver y enviar mensajes."
        />
      </View>
    );
  } else if (!cargado && error) {
    contenido = (
      <View style={estilosPantalla.centrado}>
        <ErrorConReintento mensaje={error} onReintentar={recargar} />
      </View>
    );
  } else if (mensajes.length === 0) {
    contenido = (
      <View style={estilosPantalla.centrado}>
        <EstadoVacio
          icono="message-text-outline"
          titulo="Todavía no hay mensajes"
          mensaje="Escribí el primero para coordinar la devolución sin compartir tu teléfono."
        />
      </View>
    );
  } else {
    // Lista invertida: el mensaje más nuevo queda abajo, junto al teclado.
    contenido = (
      <FlatList
        inverted
        contentContainerStyle={styles.lista}
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
      style={estilosPantalla.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.encabezado}>
        <Texto variante="subtitulo" numberOfLines={1}>
          {contraparte ? `Conversación con ${contraparte}` : 'Conversación'}
        </Texto>
        {!!tituloPublicacion && (
          <Texto variante="cuerpoChico" tono="secundario" numberOfLines={1}>
            {tituloPublicacion}
          </Texto>
        )}
      </View>

      {!hayConexion && (
        <Aviso
          tono="aviso"
          icono="wifi-off"
          mensaje="Sin conexión. No se actualizan ni se pueden enviar mensajes."
          style={styles.aviso}
        />
      )}

      {!!error && cargado && hayConexion && (
        <Aviso
          tono="peligro"
          mensaje={`No se pudo actualizar la conversación. ${error}`}
          style={styles.aviso}
        />
      )}

      <View style={styles.cuerpo}>{contenido}</View>

      {!!errorEnvio && <Aviso tono="peligro" mensaje={errorEnvio} style={styles.aviso} />}

      <View style={styles.barraEnvio}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribí un mensaje"
          placeholderTextColor={colores.textoTenue}
          multiline
          maxLength={MAX_MENSAJE}
          editable={!enviando}
          accessibilityLabel="Mensaje"
        />

        <Tocable
          radio={radios.pastilla}
          colorOnda={colores.ondaInversa}
          accessibilityLabel={enviando ? 'Enviando…' : 'Enviar'}
          disabled={!puedeEnviar}
          onPress={manejarEnviar}
          style={[styles.enviar, !puedeEnviar && styles.enviarInactivo]}
        >
          {enviando ? (
            <ActivityIndicator size="small" color={colores.textoTenue} />
          ) : (
            <Icono
              nombre="send"
              tamano={22}
              color={puedeEnviar ? colores.textoInverso : colores.textoTenue}
            />
          )}
        </Tocable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    backgroundColor: colores.superficie,
    paddingHorizontal: espacio.md,
    paddingBottom: espacio.xs,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  aviso: { marginHorizontal: espacio.md, marginTop: espacio.xs },
  cuerpo: { flex: 1 },
  lista: { padding: espacio.md, gap: espacio.xs },
  burbuja: {
    maxWidth: '80%',
    borderRadius: radios.tarjeta,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
    gap: espacio.xxs,
  },
  burbujaPropia: {
    alignSelf: 'flex-end',
    backgroundColor: colores.primario,
    borderBottomRightRadius: espacio.xxs,
  },
  burbujaAjena: {
    alignSelf: 'flex-start',
    backgroundColor: colores.superficie,
    borderBottomLeftRadius: espacio.xxs,
  },
  fecha: { alignSelf: 'flex-end' },
  barraEnvio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio.xs,
    padding: espacio.xs,
    backgroundColor: colores.superficie,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  input: {
    ...tipografia.cuerpo,
    lineHeight: undefined,
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colores.bordeControl,
    borderRadius: radios.control,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
    color: colores.texto,
    backgroundColor: colores.superficie,
  },
  enviar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primario,
  },
  enviarInactivo: { backgroundColor: colores.deshabilitado },
});

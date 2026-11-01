import { useConexion } from '../context/ConexionContext';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { conActividadExterna } from '../services/actividadExterna';
import ReputationCard from '../components/ReputationCard';
import { fechaSuceso } from '../components/TarjetaPublicacion';
import usePublicacion from '../hooks/usePublicacion';
import { mensajeErrorApi } from '../services/api';
import { ZONAS } from '../data/searchDemo';
import {
  Avatar,
  Aviso,
  AvisoSinConexion,
  Boton,
  Campo,
  Cargando,
  ErrorConReintento,
  Fila,
  FilaDato,
  GrupoOpciones,
  Icono,
  InsigniaEstado,
  InsigniaTipo,
  ModalPantalla,
  NotaSinConexion,
  Tarjeta,
  Texto,
  Tocable,
  colores,
  espacio,
  estilosPantalla,
  iconoCategoria,
  irAPestana,
  radios,
  tonos,
} from '../components/ui';

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

  if (loading) return <Cargando pantalla />;

  if (error || !publicacion) {
    return (
      <View style={estilosPantalla.centrado}>
        <ErrorConReintento
          mensaje={error || 'No encontramos la publicación.'}
          onReintentar={recargar}
        />
      </View>
    );
  }

  const estaOffline = !hayConexion || publicacion?.esOffline;
  const encontrado = publicacion.tipo === 'encontrado';
  const vencida = publicacion.estado === 'vencida';
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
  } else if (vencida) {
    tituloBoton = 'Publicación vencida';
    botonDeshabilitado = true;
  } else if (sinIntentos) {
    tituloBoton = 'Límite de 3 intentos alcanzado';
    botonDeshabilitado = true;
  } else if (reclamoVencido || reclamoRechazado) {
    tituloBoton = encontrado
      ? `Es mío (Reintentar intento ${proximoIntento} de 3)`
      : `Lo encontré (Reintentar intento ${proximoIntento} de 3)`;
  }

  // Pregunta real del autor; las publicaciones viejas no la tienen y piden detalles distintivos
  const preguntaVerificacion = publicacion.preguntaVerificacion?.trim() || null;
  const respuestaValida = preguntaVerificacion
    ? respuesta.trim().length >= 2
    : descripcion.trim().length >= 5;

  async function elegirFoto() {
    try {
      const resultado = await conActividadExterna(() => ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      }));

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
      // «Es mío» responde la pregunta del autor; «Lo encontré» envía foto y barrio como evidencia
      const datosReclamo = encontrado
        ? {
            respuestaVerificacion: preguntaVerificacion ? respuesta.trim() : '',
            mensaje: preguntaVerificacion
              ? (descripcion.trim().length >= 5 ? descripcion.trim() : 'Respondí la pregunta de verificación.')
              : descripcion.trim(),
            fotoUri,
          }
        : {
            barrio: barrio.trim(),
            fotoUri,
            mensaje: mensaje.trim() || `Encontré tu objeto en ${barrio.trim()}.`,
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
      // Si la publicación venció o cambió de estado mientras tanto, se refresca el detalle
      const codigo = error?.response?.data?.error?.code;
      if (codigo === 'PUBLICATION_EXPIRED' || codigo === 'PUBLICATION_NOT_OPEN') {
        cerrarModal();
        recargar();
      }
    } finally {
      setEnviando(false);
    }
  }

  const opcionesBarrio = ZONAS.map((zona) => ({ valor: zona.nombre, nombre: zona.nombre }));
  const tituloModal = encontrado ? 'Reclamar como tuyo' : 'Avisar que lo encontraste';

  return (
    <ScrollView style={estilosPantalla.pantalla}>
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
            style={[styles.foto, { width }]}
            accessibilityLabel={`Foto de ${publicacion.categoria}`}
          >
            {item ? (
              <Image source={{ uri: item }} style={styles.imagen} resizeMode="cover" />
            ) : (
              <>
                <Icono
                  nombre={iconoCategoria(publicacion.categoria)}
                  tamano={56}
                  color={tonos.info.texto}
                />
                <Texto variante="cuerpoChico" style={styles.sinFoto}>Sin fotos</Texto>
              </>
            )}

            {publicacion.fotos.length > 0 && (
              <View style={styles.contador}>
                <Texto variante="leyendaFuerte" tono="inverso">
                  Foto {foto + 1} de {publicacion.fotos.length}
                </Texto>
              </View>
            )}
          </View>
        )}
      />

      <View style={estilosPantalla.contenido}>
        {estaOffline && (
          <AvisoSinConexion
            mensaje={
              publicacion.esOffline
                ? 'Estás viendo una publicación guardada en tu dispositivo (fotos, detalle y barrio disponibles).'
                : 'Sin conexión a internet. Las acciones para reclamar, seguir o gestionar están deshabilitadas.'
            }
          />
        )}

        <View style={styles.cabecera}>
          <Fila>
            <InsigniaTipo tipo={publicacion.tipo} />
            <InsigniaEstado estado={publicacion.estado} />
          </Fila>

          <Texto variante="pantalla">{publicacion.titulo}</Texto>
          <Texto tono="secundario">{publicacion.descripcion}</Texto>
        </View>

        <Tarjeta>
          <FilaDato etiqueta="Categoría" valor={publicacion.categoria} />
          <FilaDato etiqueta="Fecha del suceso" valor={fechaSuceso(publicacion.fecha)} />
          <FilaDato
            etiqueta="Franja horaria"
            valor={FRANJAS[publicacion.franja] || publicacion.franja}
          />
          <FilaDato etiqueta="Barrio" valor={publicacion.barrio} />
          <FilaDato
            etiqueta="Dirección exacta"
            valor={publicacion.direccionExacta || 'Se muestra cuando el reclamo sea aceptado.'}
          />
        </Tarjeta>

        {!esPropia && vencida && (
          <Aviso
            tono="peligro"
            icono="clock-outline"
            titulo="Publicación vencida"
            mensaje="Esta publicación venció y ya no acepta reclamos ni avisos."
          />
        )}

        {!esPropia && reclamoPendiente && (
          <Aviso
            tono="aviso"
            icono="timer-sand"
            titulo={`Reclamo pendiente (Intento ${intentosRealizados} de 3)`}
            mensaje="Tu reclamo está a la espera de respuesta del publicador. Vence automáticamente a las 48 horas si no recibe respuesta."
          />
        )}

        {!esPropia && reclamoVencido && (
          <Aviso
            tono="peligro"
            icono="clock-outline"
            titulo={`Reclamo vencido (Intento ${intentosRealizados} de 3)`}
            mensaje={`Tu reclamo anterior venció automáticamente al cumplirse 48 horas sin respuesta.${
              intentosRealizados < 3
                ? ` Podés volver a intentarlo (intento ${proximoIntento} de 3).`
                : ' Ya utilizaste los 3 intentos permitidos para esta publicación.'
            }`}
          />
        )}

        {!esPropia && reclamoRechazado && (
          <Aviso
            tono="neutro"
            icono="close-circle-outline"
            titulo={`Reclamo rechazado (Intento ${intentosRealizados} de 3)`}
            mensaje={`El publicador no confirmó tu reclamo anterior.${
              intentosRealizados < 3
                ? ` Podés intentarlo nuevamente (intento ${proximoIntento} de 3).`
                : ' Ya utilizaste los 3 intentos permitidos para esta publicación.'
            }`}
          />
        )}

        {!esPropia && reclamoAceptado && (
          <Aviso
            tono="exito"
            titulo="Reclamo aceptado"
            mensaje="¡El publicador aceptó tu reclamo! Podés coordinar la entrega con él."
          />
        )}

        <View style={styles.acciones}>
          {esPropia ? (
            <>
              <Boton
                titulo="Gestionar publicación"
                disabled={estaOffline}
                onPress={() =>
                  navigation.navigate('GestionPublicacion', {
                    publicacionId,
                  })
                }
              />
              {estaOffline && (
                <NotaSinConexion>
                  Se necesita conexión a internet para gestionar tu publicación.
                </NotaSinConexion>
              )}
            </>
          ) : (
            <>
              <Boton
                titulo={tituloBoton}
                disabled={botonDeshabilitado || estaOffline}
                onPress={() => setMostrarReclamo(true)}
              />
              {estaOffline && !reclamoAceptado && !reclamoPendiente && !vencida && (
                <NotaSinConexion>
                  Se necesita conexión para reclamar esta publicación.
                </NotaSinConexion>
              )}

              <Boton
                titulo={guardandoSeguimiento
                  ? 'Guardando seguimiento…'
                  : siguiendo ? 'Dejar de seguir' : 'Seguir publicación'}
                icono={siguiendo ? 'bookmark' : 'bookmark-outline'}
                variante="secundario"
                cargando={guardandoSeguimiento}
                disabled={estaOffline || (vencida && !siguiendo)}
                onPress={toggleSeguir}
              />
              {estaOffline && (
                <NotaSinConexion>
                  Se necesita conexión para seguir o dejar de seguir esta publicación.
                </NotaSinConexion>
              )}
            </>
          )}

          {errorSeguimiento !== '' && (
            <Aviso
              tono="peligro"
              mensaje={errorSeguimiento}
              accessibilityRole="alert"
              accion={{
                titulo: 'Reintentar carga de seguidas',
                onPress: recargarSeguimiento,
                disabled: guardandoSeguimiento,
              }}
            />
          )}

          {siguiendo && (
            <Boton
              titulo="Ver publicaciones seguidas"
              variante="terciario"
              chico
              onPress={() => irAPestana(navigation, 'Seguidas')}
            />
          )}

          {!!miReclamo && (
            <Boton
              titulo="Ir a Mis reclamos"
              variante="terciario"
              chico
              onPress={() => irAPestana(navigation, 'MisReclamos')}
            />
          )}
        </View>

        <Texto variante="seccion" style={styles.tituloSeccion}>Publicado por</Texto>

        <Tarjeta sinRelleno>
          <Tocable
            radio={radios.tarjeta}
            accessibilityLabel={`Ver perfil de ${publicacion.publicador.name}`}
            onPress={() =>
              navigation.navigate('PerfilPublico', {
                usuario: publicacion.publicador,
              })
            }
            style={styles.publicador}
          >
            <Avatar
              uri={publicacion.publicador.avatarUrl}
              nombre={publicacion.publicador.name}
              tamano={48}
            />
            <View style={styles.publicadorTexto}>
              <Texto variante="subtitulo">{publicacion.publicador.name}</Texto>
              <Texto variante="cuerpoChico" tono="primario">Ver perfil</Texto>
            </View>
            <Icono nombre="chevron-right" tamano={22} color={colores.textoTenue} />
          </Tocable>
        </Tarjeta>

        <ReputationCard reputacion={publicacion.publicador.reputation} />
      </View>

      <ModalPantalla
        visible={mostrarReclamo}
        titulo={tituloModal}
        onCerrar={cerrarModal}
        cerrarDeshabilitado={enviando}
      >
        <Aviso
          tono="info"
          titulo={`Intento ${miReclamo ? proximoIntento : 1} de 3`}
          mensaje="Tenés un máximo de 3 intentos por publicación. Cada reclamo vence automáticamente a las 48 horas si no recibe respuesta."
        />

        {encontrado ? (
          <Tarjeta>
            {preguntaVerificacion ? (
              <>
                <Texto variante="cuerpoChico" tono="secundario">
                  Para acreditar que el objeto es tuyo, respondé la pregunta de verificación definida por quien lo encontró.
                </Texto>

                <FilaDato etiqueta="Pregunta de verificación" valor={preguntaVerificacion} />

                <Campo
                  etiqueta="Tu respuesta (obligatoria)"
                  value={respuesta}
                  onChangeText={setRespuesta}
                  placeholder="Escribí tu respuesta…"
                  maxLength={200}
                  multiline
                  estiloInput={styles.inputCorto}
                />
              </>
            ) : (
              <Texto variante="cuerpoChico" tono="secundario">
                Esta publicación no tiene pregunta de verificación. Para acreditar que el objeto es tuyo, describí detalles distintivos que solo vos conozcas.
              </Texto>
            )}

            <Campo
              etiqueta={preguntaVerificacion ? 'Mensaje adicional (opcional)' : 'Detalles distintivos (obligatorio)'}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Detalles o marcas para acreditar que te pertenece…"
              maxLength={500}
              multiline
            />

            <Texto variante="etiqueta" tono="secundario">
              Foto que acredite pertenencia (opcional)
            </Texto>
            {fotoUri ? (
              <View style={styles.previa}>
                <Image source={{ uri: fotoUri }} style={styles.imagenPrevia} resizeMode="cover" />
                <Boton titulo="Quitar foto" variante="peligro" chico onPress={quitarFoto} />
              </View>
            ) : (
              <Boton
                titulo="Seleccionar foto del dispositivo"
                icono="image-outline"
                variante="secundario"
                onPress={elegirFoto}
              />
            )}
          </Tarjeta>
        ) : (
          <Tarjeta>
            <Texto variante="cuerpoChico" tono="secundario">
              Para que el dueño pueda confirmar si se trata de lo suyo, adjuntá una foto clara del objeto e indicá el barrio donde lo encontraste.
            </Texto>

            <Texto variante="etiqueta" tono="secundario">
              Barrio donde lo encontraste (obligatorio, elegí uno de la lista)
            </Texto>
            <GrupoOpciones opciones={opcionesBarrio} valor={barrio} onChange={setBarrio} chico />

            <Texto variante="etiqueta" tono="secundario">
              Foto del objeto encontrado (obligatoria)
            </Texto>
            {fotoUri ? (
              <View style={styles.previa}>
                <Image source={{ uri: fotoUri }} style={styles.imagenPrevia} resizeMode="cover" />
                <Boton titulo="Quitar foto" variante="peligro" chico onPress={quitarFoto} />
              </View>
            ) : (
              <Boton
                titulo="Adjuntar foto del objeto encontrado"
                icono="camera-outline"
                variante="secundario"
                onPress={elegirFoto}
              />
            )}

            <Campo
              etiqueta="Mensaje o información adicional (opcional)"
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Detalles adicionales sobre el estado del objeto o dónde lo guardás…"
              maxLength={1000}
              multiline
            />
          </Tarjeta>
        )}

        <Boton
          titulo={
            encontrado
              ? (enviando ? 'Enviando reclamo…' : 'Confirmar y enviar reclamo')
              : (enviando ? 'Enviando aviso…' : 'Confirmar y enviar aviso')
          }
          cargando={enviando}
          disabled={!hayConexion || (encontrado ? !respuestaValida : !fotoUri || !barrio)}
          onPress={enviarReclamo}
        />
        <Boton titulo="Cancelar" variante="terciario" disabled={enviando} onPress={cerrarModal} />
      </ModalPantalla>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  foto: {
    height: 240,
    backgroundColor: colores.primarioSuave,
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacio.xs,
  },
  imagen: { width: '100%', height: '100%' },
  sinFoto: { color: tonos.info.texto },
  contador: {
    position: 'absolute',
    right: espacio.sm,
    bottom: espacio.sm,
    paddingHorizontal: 10,
    paddingVertical: espacio.xxs,
    borderRadius: radios.pastilla,
    backgroundColor: colores.velo,
  },
  cabecera: { gap: espacio.xs },
  acciones: { gap: espacio.xs },
  tituloSeccion: { marginTop: espacio.xs },
  publicador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    padding: espacio.sm,
  },
  publicadorTexto: { flex: 1 },
  inputCorto: { minHeight: 64 },
  previa: { gap: espacio.xs },
  imagenPrevia: {
    width: '100%',
    height: 180,
    borderRadius: radios.control,
    backgroundColor: colores.borde,
  },
});

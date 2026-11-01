import { useConexion } from '../context/ConexionContext';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import FormularioPublicacion, {
  FRANJAS,
  valoresDesdePublicacion,
} from '../components/FormularioPublicacion';
import EncuentroReclamo from '../components/EncuentroReclamo';
import EvidenciaReclamo from '../components/EvidenciaReclamo';
import useGestionPublicacion from '../hooks/useGestionPublicacion';
import { verificarConexion } from '../services/conexion';
import { diasParaVencer, puedeRenovarse } from '../services/publicaciones';
import { fechaSuceso } from '../components/TarjetaPublicacion';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Cargando,
  ESTADOS_RECLAMO,
  ErrorConReintento,
  Fila,
  FilaDato,
  InsigniaEstado,
  InsigniaTipo,
  NotaSinConexion,
  Pantalla,
  Seccion,
  Separador,
  Tarjeta,
  Texto,
  espacio,
  estilosPantalla,
} from '../components/ui';

function formatearFecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '';
}

// Línea de vigencia de la publicación (fecha de vencimiento o de cuándo venció)
function textoVigencia(publicacion) {
  if (!publicacion.venceAt || publicacion.estado === 'resuelta') return '';
  if (publicacion.estado === 'vencida') {
    return `Venció el ${formatearFecha(publicacion.venceAt)}. Renovala para que vuelva a aparecer en las búsquedas.`;
  }
  const dias = diasParaVencer(publicacion.venceAt);
  return `Vence el ${formatearFecha(publicacion.venceAt)}${
    dias !== null && dias >= 0 ? ` (${dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`})` : ''
  }.`;
}

export default function GestionPublicacionScreen({ route, navigation }) {
  const { hayConexion } = useConexion();
  const publicacionId = route.params?.publicacionId;
  const {
    publicacion,
    reclamos,
    totalReclamos,
    hayMasReclamos,
    loading,
    refrescando,
    cargandoMas,
    error,
    procesando,
    recargar,
    cargarMasReclamos,
    guardarCambios,
    eliminar,
    renovar,
    aceptarReclamo,
    rechazarReclamo,
    confirmarDevolucion,
  } = useGestionPublicacion(publicacionId);

  const [editando, setEditando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [mensaje, setMensaje] = useState('');

  if (loading && !publicacion) return <Cargando pantalla />;

  if (!publicacion) {
    return (
      <View style={estilosPantalla.centrado}>
        <ErrorConReintento
          mensaje={error || 'No se encontró la publicación.'}
          onReintentar={recargar}
        />
      </View>
    );
  }

  const ocupado = procesando !== null;
  const encontrado = publicacion.tipo === 'encontrado';
  // «Vencida» es una publicación abierta cuyo plazo pasó: se puede editar, renovar o dar de baja
  const editable = ['abierta', 'vencida'].includes(publicacion.estado);
  const vigencia = textoVigencia(publicacion);
  const aceptado = reclamos.find((r) => r.estado === 'aceptado');

  // Antes de cada cambio se comprueba que el backend responda; si no, se avisa y no se envía
  async function conConexion(textoSinConexion, accion) {
    if (!(await verificarConexion())) {
      Alert.alert('Sin conexión', textoSinConexion);
      return null;
    }
    return accion();
  }

  async function guardar(datos) {
    setErrorEdicion('');
    setMensaje('');

    const r = await conConexion(
      'Se necesita conexión a internet para guardar los cambios.',
      () => guardarCambios(datos)
    );

    if (!r) return;
    if (r.ok) {
      setEditando(false);
      setMensaje('Cambios guardados.');
    } else {
      setErrorEdicion(r.error);
    }
  }

  function confirmarEliminar() {
    Alert.alert(
      'Eliminar publicación',
      'Se dará de baja y los reclamos pendientes se cancelarán. Esta acción no se puede deshacer. ¿Querés eliminarla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const r = await conConexion(
              'Se necesita conexión a internet para eliminar la publicación.',
              eliminar
            );
            if (!r) return;
            if (r.ok) navigation.goBack();
            else Alert.alert('No se pudo eliminar', r.error);
          },
        },
      ]
    );
  }

  async function manejarRenovar() {
    setMensaje('');
    const r = await conConexion(
      'Se necesita conexión a internet para renovar la publicación.',
      renovar
    );
    if (!r) return;
    if (r.ok) setMensaje('Publicación renovada por 30 días más.');
    else Alert.alert('No se pudo renovar', r.error);
  }

  function manejarAceptar(reclamo) {
    Alert.alert(
      'Aceptar reclamo',
      `¿Querés aceptar el reclamo de ${reclamo.usuario}? La publicación pasará a estado "En reclamo" para coordinar la devolución.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            const r = await conConexion(
              'Se necesita conexión a internet para aceptar este reclamo.',
              () => aceptarReclamo(reclamo.id)
            );
            if (!r) return;
            if (r.ok) {
              Alert.alert(
                'Reclamo aceptado',
                'El reclamo fue aceptado. Podés coordinar la entrega con la otra persona.'
              );
            } else {
              Alert.alert('No se pudo aceptar', r.error);
            }
          },
        },
      ]
    );
  }

  function manejarRechazar(reclamo) {
    Alert.alert(
      'Rechazar reclamo',
      `¿Querés rechazar el reclamo de ${reclamo.usuario}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            const r = await conConexion(
              'Se necesita conexión a internet para rechazar este reclamo.',
              () => rechazarReclamo(reclamo.id)
            );
            if (!r) return;
            if (r.ok) Alert.alert('Reclamo rechazado', 'El reclamo fue rechazado.');
            else Alert.alert('No se pudo rechazar', r.error);
          },
        },
      ]
    );
  }

  function manejarResolver() {
    Alert.alert(
      'Confirmar devolución',
      '¿El objeto ya fue devuelto? El caso se cerrará y ambos podrán valorarse durante 7 días.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const r = await conConexion(
              'Se necesita conexión a internet para confirmar la devolución.',
              confirmarDevolucion
            );
            if (!r) return;
            // La valoración y el agradecimiento se hacen desde el historial de devoluciones
            if (r.ok) navigation.navigate('Historial');
            else Alert.alert('No se pudo confirmar', r.error);
          },
        },
      ]
    );
  }

  const avisaVencimiento = publicacion.estado === 'vencida' || puedeRenovarse(publicacion);
  const franja = FRANJAS.find((f) => f.valor === publicacion.franja)?.nombre || publicacion.franja;

  return (
    <Pantalla
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={recargar} />
      }
    >
      {!hayConexion && (
        <AvisoSinConexion
          mensaje="Las acciones de edición, renovación, baja, aceptación de reclamos y resolución requieren conexión a internet y se encuentran deshabilitadas."
        />
      )}

      <Tarjeta>
        <Fila>
          <InsigniaTipo tipo={publicacion.tipo} />
          <InsigniaEstado estado={publicacion.estado} />
        </Fila>

        <Texto variante="pantalla">{publicacion.titulo}</Texto>

        {vigencia !== '' && (
          avisaVencimiento ? (
            <Aviso tono="aviso" icono="clock-outline" mensaje={vigencia} />
          ) : (
            <Texto variante="cuerpoChico" tono="secundario">{vigencia}</Texto>
          )
        )}

        <FilaDato
          etiqueta="Datos del suceso"
          valor={`${publicacion.categoria} · ${publicacion.barrio} · ${fechaSuceso(publicacion.fecha)} · ${franja}`}
        />

        <FilaDato
          etiqueta="Dirección exacta"
          valor={publicacion.direccionExacta || 'No cargaste una dirección exacta'}
        />

        {encontrado && !!publicacion.preguntaVerificacion && (
          <>
            <FilaDato etiqueta="Pregunta de verificación" valor={publicacion.preguntaVerificacion} />
            <FilaDato etiqueta="Tu respuesta (privada)" valor={publicacion.respuestaVerificacion} />
          </>
        )}

        {error !== '' && <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />}
        {mensaje !== '' && <Aviso tono="exito" mensaje={mensaje} />}

        {puedeRenovarse(publicacion) && (
          <>
            <Boton
              titulo={procesando === 'renovar' ? 'Renovando…' : 'Renovar por 30 días'}
              cargando={procesando === 'renovar'}
              disabled={ocupado || !hayConexion}
              onPress={manejarRenovar}
            />
            {!hayConexion && (
              <NotaSinConexion>Se necesita conexión para renovar la publicación.</NotaSinConexion>
            )}
          </>
        )}

        {editable && !editando && (
          <>
            <Boton
              titulo="Editar publicación"
              icono="pencil-outline"
              variante="secundario"
              disabled={ocupado || !hayConexion}
              onPress={() => {
                setMensaje('');
                setErrorEdicion('');
                setEditando(true);
              }}
            />
            {!hayConexion && (
              <NotaSinConexion>Se necesita conexión para editar la publicación.</NotaSinConexion>
            )}
          </>
        )}
      </Tarjeta>

      {editable && editando && (
        <FormularioPublicacion
          modo="editar"
          valoresIniciales={valoresDesdePublicacion(publicacion)}
          enviando={procesando === 'guardar'}
          errorEnvio={errorEdicion}
          textoEnviar="Guardar cambios"
          onEnviar={guardar}
          onCancelar={() => {
            setErrorEdicion('');
            setEditando(false);
          }}
        />
      )}

      <Seccion titulo={`Reclamos recibidos (${totalReclamos})`}>
        {reclamos.length === 0 && (
          <Texto variante="cuerpoChico" tono="secundario">
            Todavía no recibiste reclamos.
          </Texto>
        )}

        {reclamos.map((r) => (
          <View key={r.id} style={styles.reclamo}>
            <Separador />

            <View style={styles.reclamoCabecera}>
              <View style={styles.reclamoPersona}>
                <Texto variante="subtitulo">{r.usuario}</Texto>
                <Texto variante="leyenda" tono="secundario">
                  Intento {r.intentos || 1} de {r.maxIntentos || 3}
                </Texto>
              </View>
              <InsigniaEstado estado={r.estado} estados={ESTADOS_RECLAMO} />
            </View>

            <EvidenciaReclamo reclamo={r} publicacion={publicacion} esDuenio />

            {r.estado === 'pendiente' && (
              <Texto variante="cuerpoChico" tono="secundario">
                Vence automáticamente a las 48 hs.
              </Texto>
            )}
            {r.estado === 'aceptado' && (
              <Aviso
                tono="exito"
                icono="phone-outline"
                mensaje={r.telefono
                  ? `Teléfono: ${r.telefono}`
                  : 'Esta persona prefiere comunicarse solo por la app.'}
              />
            )}

            {r.estado === 'aceptado' && publicacion.estado === 'en_reclamo' && (
              <EncuentroReclamo reclamoId={r.id} actualizacion={r.actualizadaEn} />
            )}

            {r.estado === 'aceptado' && (
              <Boton
                titulo="Mensajes"
                icono="message-text-outline"
                variante="secundario"
                onPress={() =>
                  navigation.navigate('ConversacionReclamo', {
                    reclamoId: r.id,
                    contraparte: r.usuario,
                    tituloPublicacion: publicacion.titulo,
                  })
                }
              />
            )}

            {publicacion.estado === 'abierta' && r.estado === 'pendiente' && (
              <>
                <Fila>
                  <Boton
                    titulo={procesando === r.id ? 'Procesando…' : 'Aceptar'}
                    flexible
                    disabled={ocupado || !hayConexion}
                    onPress={() => manejarAceptar(r)}
                  />
                  <Boton
                    titulo="Rechazar"
                    variante="peligro"
                    flexible
                    disabled={ocupado || !hayConexion}
                    onPress={() => manejarRechazar(r)}
                  />
                </Fila>
                {!hayConexion && (
                  <NotaSinConexion>
                    Se necesita conexión para aceptar o rechazar reclamos.
                  </NotaSinConexion>
                )}
              </>
            )}
          </View>
        ))}

        {hayMasReclamos && (
          <Boton
            titulo={cargandoMas ? 'Cargando…' : 'Cargar más reclamos'}
            variante="terciario"
            cargando={cargandoMas}
            disabled={!hayConexion}
            onPress={cargarMasReclamos}
          />
        )}

        {publicacion.estado === 'en_reclamo' && aceptado && (
          <>
            <Boton
              titulo={procesando === 'resolver' ? 'Confirmando…' : 'Confirmar devolución'}
              cargando={procesando === 'resolver'}
              disabled={ocupado || !hayConexion}
              onPress={manejarResolver}
            />
            {!hayConexion && (
              <NotaSinConexion>Se necesita conexión para confirmar la devolución.</NotaSinConexion>
            )}
          </>
        )}
      </Seccion>

      {publicacion.estado === 'resuelta' && (
        <Seccion
          titulo="Devolución concretada"
          descripcion="Desde el historial podés valorar a la otra persona dentro de los 7 días posteriores a la devolución."
        >
          <Boton
            titulo="Ver historial y valorar"
            variante="secundario"
            onPress={() => navigation.navigate('Historial')}
          />
        </Seccion>
      )}

      {editable && (
        <Boton
          titulo="Eliminar publicación"
          icono="trash-can-outline"
          variante="peligro"
          disabled={ocupado || !hayConexion}
          onPress={confirmarEliminar}
        />
      )}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  reclamo: { gap: espacio.sm },
  reclamoCabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  reclamoPersona: { flex: 1 },
});

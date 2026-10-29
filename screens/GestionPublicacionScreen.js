import { useConexion } from '../context/ConexionContext';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FormularioPublicacion, {
  FRANJAS,
  valoresDesdePublicacion,
} from '../components/FormularioPublicacion';
import EncuentroReclamo from '../components/EncuentroReclamo';
import useGestionPublicacion from '../hooks/useGestionPublicacion';
import { verificarConexion } from '../services/conexion';
import {
  NOMBRE_ESTADO_PUBLICACION,
  diasParaVencer,
  puedeRenovarse,
} from '../services/publicaciones';

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

  if (loading && !publicacion) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!publicacion) {
    return (
      <View style={styles.centrado}>
        <Text style={styles.error}>
          {error || 'No se encontró la publicación.'}
        </Text>
        <Button title="Reintentar" onPress={recargar} />
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={recargar} />
      }
    >
      {!hayConexion && (
        <View style={styles.bannerOffline}>
          <Text style={styles.bannerOfflineIcon}>⚠️</Text>
          <View style={styles.bannerOfflineTexto}>
            <Text style={styles.bannerOfflineTitulo}>Modo sin conexión</Text>
            <Text style={styles.bannerOfflineMensaje}>
              Las acciones de edición, renovación, baja, aceptación de reclamos y resolución requieren conexión a internet y se encuentran deshabilitadas.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.tipo}>
          {encontrado ? 'ENCONTRADO' : 'PERDIDO'}
        </Text>
        <Text style={styles.nombre}>{publicacion.titulo}</Text>
        <Text style={styles.estado}>
          Estado: {NOMBRE_ESTADO_PUBLICACION[publicacion.estado] || publicacion.estado}
        </Text>
        {vigencia !== '' && (
          <Text
            style={
              publicacion.estado === 'vencida' || puedeRenovarse(publicacion)
                ? styles.avisoVencimiento
                : styles.dato
            }
          >
            {vigencia}
          </Text>
        )}

        <Text style={styles.dato}>
          {publicacion.categoria} · {publicacion.barrio} ·{' '}
          {publicacion.fecha.split('-').reverse().join('/')} ·{' '}
          {FRANJAS.find((f) => f.valor === publicacion.franja)?.nombre ||
            publicacion.franja}
        </Text>

        <Text style={styles.dato}>
          Dirección exacta:{' '}
          {publicacion.direccionExacta || 'no cargaste una dirección exacta'}
        </Text>

        {encontrado && !!publicacion.preguntaVerificacion && (
          <>
            <Text style={styles.dato}>
              Pregunta de verificación: {publicacion.preguntaVerificacion}
            </Text>
            <Text style={styles.dato}>
              Tu respuesta (privada): {publicacion.respuestaVerificacion}
            </Text>
          </>
        )}

        {error !== '' && <Text style={styles.error}>{error}</Text>}
        {mensaje !== '' && <Text style={styles.ok}>{mensaje}</Text>}

        {puedeRenovarse(publicacion) && (
          <View style={styles.accion}>
            <Button
              title={procesando === 'renovar' ? 'Renovando…' : 'Renovar por 30 días'}
              color={!hayConexion ? '#9CA3AF' : undefined}
              disabled={ocupado || !hayConexion}
              onPress={manejarRenovar}
            />
            {!hayConexion && (
              <Text style={styles.avisoAccionOffline}>
                ⚠️ Se necesita conexión para renovar la publicación.
              </Text>
            )}
          </View>
        )}
      </View>

      {editable &&
        (editando ? (
          <View style={styles.formulario}>
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
          </View>
        ) : (
          <View style={styles.card}>
            <Button
              title="Editar publicación"
              color={!hayConexion ? '#9CA3AF' : undefined}
              disabled={ocupado || !hayConexion}
              onPress={() => {
                setMensaje('');
                setErrorEdicion('');
                setEditando(true);
              }}
            />
            {!hayConexion && (
              <Text style={styles.avisoAccionOffline}>
                ⚠️ Se necesita conexión para editar la publicación.
              </Text>
            )}
          </View>
        ))}

      <View style={styles.card}>
        <Text style={styles.titulo}>Reclamos recibidos ({totalReclamos})</Text>

        {reclamos.length === 0 && (
          <Text style={styles.vacio}>Todavía no recibiste reclamos.</Text>
        )}

        {reclamos.map((r) => (
          <View key={r.id} style={styles.reclamo}>
            <View style={styles.reclamoHeader}>
              <Text style={styles.reclamoUsuario}>{r.usuario}</Text>
              <Text style={styles.reclamoIntentos}>
                Intento {r.intentos || 1} de {r.maxIntentos || 3}
              </Text>
            </View>
            <Text style={styles.reclamoMensaje}>{r.mensaje}</Text>

            {/* TODO evidencia */}

            {r.estado === 'pendiente' && (
              <Text style={styles.estadoPendiente}>
                ⏳ Pendiente (vence automáticamente a las 48 hs)
              </Text>
            )}
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
            {r.estado === 'cancelado' && (
              <Text style={styles.vacio}>Cancelado</Text>
            )}
            {r.estado === 'vencido' && (
              <Text style={styles.estadoVencido}>
                ⏰ Vencido (venció a las 48 hs sin respuesta)
              </Text>
            )}

            {r.estado === 'aceptado' && publicacion.estado === 'en_reclamo' && (
              <EncuentroReclamo reclamoId={r.id} actualizacion={r.actualizadaEn} />
            )}

            {r.estado === 'aceptado' && (
              <Button
                title="Mensajes"
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
                <View style={styles.fila}>
                  <Button
                    title={procesando === r.id ? 'Procesando…' : 'Aceptar'}
                    disabled={ocupado || !hayConexion}
                    color={!hayConexion ? '#9CA3AF' : '#1D4ED8'}
                    onPress={() => manejarAceptar(r)}
                  />
                  <Button
                    title="Rechazar"
                    color={!hayConexion ? '#9CA3AF' : '#DC2626'}
                    disabled={ocupado || !hayConexion}
                    onPress={() => manejarRechazar(r)}
                  />
                </View>
                {!hayConexion && (
                  <Text style={styles.avisoAccionOffline}>
                    ⚠️ Se necesita conexión para aceptar o rechazar reclamos.
                  </Text>
                )}
              </>
            )}
          </View>
        ))}

        {hayMasReclamos && (
          <Button
            title={cargandoMas ? 'Cargando…' : 'Cargar más reclamos'}
            disabled={cargandoMas || !hayConexion}
            onPress={cargarMasReclamos}
          />
        )}

        {publicacion.estado === 'en_reclamo' && aceptado && (
          <View style={styles.accion}>
            <Button
              title={procesando === 'resolver' ? 'Confirmando…' : 'Confirmar devolución'}
              color={!hayConexion ? '#9CA3AF' : undefined}
              disabled={ocupado || !hayConexion}
              onPress={manejarResolver}
            />
            {!hayConexion && (
              <Text style={styles.avisoAccionOffline}>
                ⚠️ Se necesita conexión para confirmar la devolución.
              </Text>
            )}
          </View>
        )}
      </View>

      {publicacion.estado === 'resuelta' && (
        <View style={styles.card}>
          <Text style={styles.titulo}>Devolución concretada</Text>
          <Text style={styles.vacio}>
            Desde el historial podés valorar a la otra persona dentro de los 7
            días posteriores a la devolución.
          </Text>
          <View style={styles.accion}>
            <Button
              title="Ver historial y valorar"
              onPress={() => navigation.navigate('Historial')}
            />
          </View>
        </View>
      )}

      {editable && (
        <Button
          title="Eliminar publicación"
          color={!hayConexion ? '#9CA3AF' : '#DC2626'}
          disabled={ocupado || !hayConexion}
          onPress={confirmarEliminar}
        />
      )}
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
    gap: 12,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 6 },
  formulario: { gap: 16 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  tipo: { fontSize: 13, fontWeight: 'bold', color: '#6B7280' },
  nombre: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  estado: { fontSize: 16, fontWeight: 'bold', color: '#1D4ED8', marginTop: 4 },
  dato: { fontSize: 15, color: '#374151', marginTop: 4 },
  avisoVencimiento: { fontSize: 15, color: '#B45309', fontWeight: '600', marginTop: 4 },
  accion: { marginTop: 12 },
  reclamo: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    gap: 6,
  },
  reclamoUsuario: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  reclamoMensaje: { fontSize: 15, color: '#374151' },
  reclamoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reclamoIntentos: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  estadoPendiente: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D97706',
    marginTop: 4,
  },
  estadoVencido: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DC2626',
    marginTop: 4,
  },
  fila: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  vacio: { color: '#6B7280' },
  error: { color: '#DC2626', marginTop: 8 },
  ok: { color: '#047857', marginTop: 4 },
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerOfflineIcon: {
    fontSize: 22,
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
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});

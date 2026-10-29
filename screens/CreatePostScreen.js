import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import FormularioPublicacion, { FRANJAS } from '../components/FormularioPublicacion';
import useAuth from '../hooks/useAuth';
import useBorradorPublicacion from '../hooks/useBorradorPublicacion';
import useCrearPublicacion from '../hooks/useCrearPublicacion';
import { textoAntiguedad } from '../services/borradores';
import {
  ESTADOS,
  leerCola,
  valoresDesdeDatos,
} from '../services/colaPublicaciones';

export default function CreatePostScreen({ route, navigation }) {
  const { usuario } = useAuth();
  const uid = usuario?.id !== undefined && usuario?.id !== null ? String(usuario.id) : null;
  const pendienteId = route.params?.pendienteId ?? null;

  const [publicada, setPublicada] = useState(null);
  // Valores con los que arranca el formulario: los de un borrador retomado o los de un
  // ítem con error de la cola que se está editando (null = formulario en blanco)
  const [valoresIniciales, setValoresIniciales] = useState(null);
  // Al editar un ítem de la cola: 'cargando' | 'listo' | 'no-disponible'
  const [estadoPendiente, setEstadoPendiente] = useState(pendienteId ? 'cargando' : 'listo');

  const crear = useCrearPublicacion({
    pendienteId,
    alSubirFoto: () => borrador.guardarAhora(),
  });
  // El borrador automático solo aplica a la publicación nueva, no a la edición de un ítem de la cola
  const borrador = useBorradorPublicacion(pendienteId ? null : uid, {
    obtenerEnvio: crear.obtenerEnvio,
  });

  const { usarEnvio } = crear;

  useEffect(() => {
    if (!pendienteId || !uid) return undefined;

    let activo = true;
    leerCola(uid).then((cola) => {
      if (!activo) return;

      const item = cola.find((i) => i.id === pendienteId);
      if (!item || item.estado === ESTADOS.ENVIANDO) {
        setEstadoPendiente('no-disponible');
        return;
      }

      usarEnvio(item.clientId, item.fotosSubidas);
      setValoresIniciales(valoresDesdeDatos(item.datos));
      setEstadoPendiente('listo');
    });

    return () => {
      activo = false;
    };
  }, [pendienteId, uid, usarEnvio]);

  async function enviar(datos) {
    const resultado = await crear.publicar(datos);

    if (resultado) {
      await borrador.finalizar();
      setPublicada(resultado);
    }
  }

  async function guardarParaDespues(datos) {
    if (await crear.guardarParaDespues(datos)) {
      await borrador.finalizar();
    }
  }

  function retomarBorrador() {
    const registro = borrador.retomar();
    if (!registro) return;

    usarEnvio(registro.clientId, registro.fotosSubidas);
    setValoresIniciales(registro.valores);
  }

  if (publicada) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.confirmIcon}>✅</Text>

          <Text style={styles.title}>
            {publicada.tipo === 'perdido'
              ? '¡Pérdida publicada!'
              : '¡Hallazgo publicado!'}
          </Text>

          <Text style={styles.help}>
            Tu publicación "{publicada.titulo}" ya está
            registrada. Te avisaremos si aparece una coincidencia.
          </Text>

          <Text style={styles.help}>
            {publicada.categoria} ·{' '}
            {publicada.barrio || 'Ubicación actual'} ·{' '}
            {publicada.fecha.split('-').reverse().join('/')} ·{' '}
            {FRANJAS.find((f) => f.valor === publicada.franja)?.nombre}
          </Text>

          <Text style={styles.help}>
            {publicada.fotos.length} foto(s) adjunta(s).
          </Text>
        </View>

        <Button
          title="Ver mi publicación"
          onPress={() =>
            navigation.replace('GestionPublicacion', {
              publicacionId: publicada.id,
            })
          }
        />

        <Button
          title="Volver al buscador"
          color="#6B7280"
          onPress={() => navigation.popToTop()}
        />
      </ScrollView>
    );
  }

  if (crear.encolada) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.confirmIcon}>📥</Text>

          <Text style={styles.title}>Publicación guardada</Text>

          <Text style={styles.help}>
            Quedó guardada en tu dispositivo y se enviará sola cuando haya conexión.
            Te avisamos cuando se publique. Podés seguir el estado en "Publicaciones
            pendientes".
          </Text>
        </View>

        <Button
          title="Ver publicaciones pendientes"
          onPress={() => navigation.replace('PublicacionesPendientes')}
        />

        <Button
          title="Volver al buscador"
          color="#6B7280"
          onPress={() => navigation.popToTop()}
        />
      </ScrollView>
    );
  }

  if (estadoPendiente === 'cargando' || (!pendienteId && borrador.cargando)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (estadoPendiente === 'no-disponible') {
    return (
      <View style={styles.center}>
        <Text style={styles.help}>
          Esta publicación ya no está en la lista de pendientes o se está enviando.
        </Text>
        <Button title="Volver" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (borrador.existente) {
    const { valores, guardadoAt } = borrador.existente;

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.confirmIcon}>📝</Text>

          <Text style={styles.title}>Tenés un borrador sin publicar</Text>

          <Text style={styles.help}>
            {valores.titulo.trim() ? `"${valores.titulo.trim()}" · ` : ''}
            guardado {textoAntiguedad(guardadoAt)}
            {valores.fotos.length > 0 ? ` · ${valores.fotos.length} foto(s)` : ''}
          </Text>
        </View>

        <Button title="Retomar borrador" onPress={retomarBorrador} />

        <Button
          title="Descartar y empezar de nuevo"
          color="#DC2626"
          onPress={borrador.descartar}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {pendienteId && (
        <View style={styles.section}>
          <Text style={styles.help}>
            Editá la publicación y volvé a guardarla: se enviará con la próxima
            conexión disponible.
          </Text>
        </View>
      )}

      <FormularioPublicacion
        tipoInicial={route.params?.tipo === 'encontre' ? 'encontre' : 'perdi'}
        valoresIniciales={valoresIniciales ?? undefined}
        enviando={crear.enviando}
        errorEnvio={crear.error}
        onEnviar={enviar}
        onEncolar={guardarParaDespues}
        alCambiar={borrador.guardar}
        copiarFoto={borrador.copiarFoto}
        alQuitarFoto={borrador.quitarFoto}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
    backgroundColor: '#F3F4F6',
  },
  center: {
    flex: 1,
    padding: 20,
    gap: 16,
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  help: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  confirmIcon: {
    fontSize: 48,
  },
});

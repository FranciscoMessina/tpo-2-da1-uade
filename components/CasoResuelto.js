import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { agradecerDevolucion, valorarDevolucion } from '../services/historial';
import { mensajeErrorApi } from '../services/api';

export default function CasoResuelto({ caso, navigation, onGuardar }) {
  const [positiva, setPositiva] = useState(null);
  const [comentario, setComentario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(agradecimiento) {
    if (guardando) return;
    setGuardando(true);
    try {
      if (agradecimiento) {
        await agradecerDevolucion(caso.id, mensaje);
      } else {
        await valorarDevolucion(caso.id, positiva, comentario);
      }
      onGuardar();
    } catch (error) {
      Alert.alert('No se pudo guardar', mensajeErrorApi(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{caso.objeto.titulo}</Text>
      <Text>{caso.objeto.categoria} · {caso.objeto.tipo === 'encontrado' ? 'Encontrado' : 'Perdido'}</Text>
      <Text>Devolución: {new Date(caso.fecha).toLocaleDateString('es-AR')}</Text>
      <Text>{caso.tipo === 'devolvi' ? 'Recuperó' : 'Devolvió'}: {caso.contraparte.name}</Text>
      <Button title="Ver perfil" onPress={() => navigation.navigate('PerfilPublico', {
        usuario: caso.contraparte.id,
      })} />

      {caso.valoracion ? (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Tu valoración: {caso.valoracion.positiva ? 'Positiva' : 'Negativa'}</Text>
          {!!caso.valoracion.comentario && <Text>{caso.valoracion.comentario}</Text>}
        </View>
      ) : caso.puedeValorar ? (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Valorar a {caso.contraparte.name}</Text>
          <Text>Hasta el {new Date(caso.limiteValoracion).toLocaleString('es-AR')}.</Text>
          <View style={styles.fila}>
            <Button title={positiva === true ? '✓ Positiva' : 'Positiva'} disabled={guardando}
              onPress={() => setPositiva(true)} color="#166534" />
            <Button title={positiva === false ? '✓ Negativa' : 'Negativa'} disabled={guardando}
              onPress={() => setPositiva(false)} color="#B91C1C" />
          </View>
          <TextInput style={styles.input} placeholder="Comentario opcional" accessibilityLabel="Comentario de la valoración"
            value={comentario} onChangeText={setComentario} maxLength={500} multiline editable={!guardando} />
          <Button title={guardando ? 'Guardando…' : 'Enviar valoración'}
            disabled={guardando || positiva === null} onPress={() => guardar(false)} />
        </View>
      ) : <Text>Terminó el plazo de 7 días para valorar.</Text>}

      {caso.agradecimiento ? (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Tu agradecimiento público</Text>
          <Text>{caso.agradecimiento.mensaje}</Text>
        </View>
      ) : caso.tipo === 'recupere' && (
        <View style={styles.seccion}>
          <Text style={styles.subtitulo}>Agradecimiento público</Text>
          <Text>Se verá en el perfil de {caso.contraparte.name}.</Text>
          <TextInput style={styles.input} placeholder="Escribí tu agradecimiento" accessibilityLabel="Agradecimiento público"
            value={mensaje} onChangeText={setMensaje} maxLength={500} multiline editable={!guardando} />
          <Button title="Publicar agradecimiento" disabled={guardando || !mensaje.trim()}
            onPress={() => Alert.alert('Publicar agradecimiento', 'El mensaje será público. ¿Querés publicarlo?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Publicar', onPress: () => guardar(true) },
            ])} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  subtitulo: { fontWeight: '600', color: '#111827' },
  seccion: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, gap: 10 },
  fila: { flexDirection: 'row', justifyContent: 'space-around' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, color: '#111827', minHeight: 48 },
});

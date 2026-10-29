import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import FormularioPublicacion, { FRANJAS } from '../components/FormularioPublicacion';
import useCrearPublicacion from '../hooks/useCrearPublicacion';

export default function CreatePostScreen({ route, navigation }) {
  const [publicada, setPublicada] = useState(null);

  const { publicar, enviando, error: errorEnvio } =
    useCrearPublicacion();

  async function enviar(datos) {
    const resultado = await publicar(datos);

    if (resultado) {
      setPublicada(resultado);
    }
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FormularioPublicacion
        tipoInicial={route.params?.tipo === 'encontre' ? 'encontre' : 'perdi'}
        enviando={enviando}
        errorEnvio={errorEnvio}
        onEnviar={enviar}
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

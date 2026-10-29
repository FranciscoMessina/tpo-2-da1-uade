import { ScrollView, StyleSheet } from 'react-native';
import PublicacionesPendientes from '../components/PublicacionesPendientes';

export default function PublicacionesPendientesScreen({ navigation }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PublicacionesPendientes navigation={navigation} mostrarVacio />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20 },
});

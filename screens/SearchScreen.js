import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SearchForm from '../components/SearchForm';
import { useSearch } from '../context/SearchContext';
import {
  filtrosIniciales,
  resumenBusqueda,
} from '../data/searchDemo';

export default function SearchScreen({ navigation }) {
  const { recientes, recordarBusqueda } = useSearch();

  function buscar(filtros) {
    recordarBusqueda(filtros);

    navigation.push('Resultados', {
      filtros,
    });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.intro}>
        <Text style={styles.title}>
          Encontrá una coincidencia
        </Text>

        <Text style={styles.help}>
          Contanos qué pasó para ayudarte a encontrar
          a la otra persona.
        </Text>

        <Button
          title="Mi perfil"
          onPress={() => navigation.navigate('Perfil')}
        />

        <Button
          title="Mis alertas"
          onPress={() => navigation.navigate('Alertas')}
        />

        <Button
          title="Publicaciones seguidas"
          onPress={() => navigation.navigate('Seguidas')}
        />
      </View>

      <Text style={styles.demo}>
        Vista de prueba con publicaciones de ejemplo.
      </Text>

      <SearchForm
        initialFilters={filtrosIniciales()}
        onSubmit={buscar}
      />

      <View style={styles.recent}>
        <Text style={styles.subtitle}>
          Últimas búsquedas
        </Text>

        {recientes.length === 0 ? (
          <Text style={styles.help}>
            Tus búsquedas aparecerán acá para repetirlas
            con un toque.
          </Text>
        ) : (
          recientes.map((busqueda) => (
            <Pressable
              key={busqueda.clave}
              accessibilityRole="button"
              onPress={() => buscar(busqueda.filtros)}
              style={({ pressed }) => [
                styles.recentButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.recentText}>
                {resumenBusqueda(busqueda.filtros)}
              </Text>

              <Text style={styles.repeat}>
                Repetir búsqueda →
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  intro: {
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  help: {
    color: '#6B7280',
    fontSize: 16,
    lineHeight: 23,
  },
  demo: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
  },
  recent: {
    gap: 12,
    marginTop: 8,
  },
  recentButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  recentText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  repeat: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
});
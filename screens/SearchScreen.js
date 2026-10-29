import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerConsultadasRecientes } from '../services/cacheOffline';
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
  const [consultadas, setConsultadas] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      obtenerConsultadasRecientes().then((items) => {
        if (activo) setConsultadas(items);
      });
      return () => {
        activo = false;
      };
    }, [])
  );

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

        <Button
          title="Mis reclamos"
          onPress={() => navigation.navigate('MisReclamos')}
        />
      </View>

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

      {consultadas.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.subtitle}>
            Publicaciones consultadas (Modo sin conexión)
          </Text>
          <Text style={styles.help}>
            Guardadas en tu dispositivo. Podés volver a verlas aunque no tengas internet.
          </Text>
          {consultadas.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('DetallePublicacion', {
                  publicacionId: item.id,
                })
              }
              style={({ pressed }) => [
                styles.recentButton,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.pubRow}>
                <Text style={styles.pubTipo}>
                  {item.tipo === 'encontrado' ? 'ENCONTRADO' : 'PERDIDO'}
                </Text>
                <Text style={styles.pubBarrio}>{item.barrio}</Text>
              </View>
              <Text style={styles.recentText}>{item.titulo}</Text>
              <Text style={styles.repeat}>Ver publicación guardada →</Text>
            </Pressable>
          ))}
        </View>
      )}
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
  pubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pubTipo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1D4ED8',
  },
  pubBarrio: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});
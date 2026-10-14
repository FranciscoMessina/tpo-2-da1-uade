import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchForm from '../components/SearchForm';
import { useSearch } from '../context/SearchContext';
import {
  buscarPublicaciones,
  claveBusqueda,
  crearPublicacionesEjemplo,
  resumenBusqueda,
} from '../data/searchDemo';

const TAMANIO_PAGINA = 3;

export default function SearchResultsScreen({ route }) {
  const {
    alertas,
    recordarBusqueda,
    guardarAlerta,
  } = useSearch();

  const [filtros, setFiltros] = useState(route.params.filtros);
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const listaRef = useRef(null);

  const publicaciones = buscarPublicaciones(
    crearPublicacionesEjemplo(),
    filtros,
    orden
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(publicaciones.length / TAMANIO_PAGINA)
  );

  const visibles = publicaciones.slice(
    (pagina - 1) * TAMANIO_PAGINA,
    pagina * TAMANIO_PAGINA
  );

  const alertaGuardada = alertas.some(
    (alerta) => alerta.clave === claveBusqueda(filtros)
  );

  function aplicarFiltros(nuevos) {
    setFiltros(nuevos);
    recordarBusqueda(nuevos);
    setPagina(1);
    setMostrarFiltros(false);

    listaRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  }

  function cambiarPagina(nueva) {
    setPagina(nueva);

    listaRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  }

  function elegirOrden(nuevo) {
    setOrden(nuevo);
    cambiarPagina(1);
  }

  function publicar() {
    Alert.alert(
      'Publicar',
      'La pantalla de creación de publicaciones se conectará en una próxima etapa.'
    );
  }

  function guardarBusquedaComoAlerta() {
    guardarAlerta(filtros);

    Alert.alert(
      'Alerta de prueba guardada',
      'Quedará guardada mientras la app esté abierta. Las notificaciones se conectarán más adelante.'
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listaRef}
        data={visibles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>
              {filtros.situacion === 'perdi'
                ? 'Publicaciones de hallazgos'
                : 'Publicaciones de pérdidas'}
            </Text>

            <Text style={styles.help}>
              {resumenBusqueda(filtros)}
            </Text>

            <Text style={styles.help}>
              {publicaciones.length} coincidencias · datos de ejemplo
            </Text>

            <Button
              title="Refinar filtros"
              onPress={() => setMostrarFiltros(true)}
            />

            <View style={styles.order}>
              <View style={styles.orderButton}>
                <Button
                  title={
                    orden === 'recientes'
                      ? '✓ Más recientes'
                      : 'Más recientes'
                  }
                  color={
                    orden === 'recientes'
                      ? '#1D4ED8'
                      : '#6B7280'
                  }
                  onPress={() => elegirOrden('recientes')}
                />
              </View>

              <View style={styles.orderButton}>
                <Button
                  title={
                    orden === 'cercanos'
                      ? '✓ Más cercanos'
                      : 'Más cercanos'
                  }
                  color={
                    orden === 'cercanos'
                      ? '#1D4ED8'
                      : '#6B7280'
                  }
                  onPress={() => elegirOrden('cercanos')}
                />
              </View>
            </View>

            {orden === 'cercanos' && (
              <Text style={styles.help}>
                Distancia desde{' '}
                {filtros.zona || 'la ubicación de ejemplo'}.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View
              style={styles.photo}
              accessibilityLabel={
                `Espacio para fotos de ${item.categoria}`
              }
            >
              <Text style={styles.icon}>{item.icono}</Text>

              <Text style={styles.photoLabel}>
                Foto de ejemplo
              </Text>
            </View>

            <View style={styles.details}>
              <Text style={styles.type}>
                {item.tipo === 'encontrado'
                  ? 'ENCONTRADO'
                  : 'PERDIDO'}
              </Text>

              <Text style={styles.cardTitle}>
                {item.titulo}
              </Text>

              <Text style={styles.help}>
                {item.categoria} · {item.barrio}
              </Text>

              <Text style={styles.help}>
                Fecha del suceso:{' '}
                {item.fecha.split('-').reverse().join('/')}
              </Text>

              <Text style={styles.coordinates}>
                Coordenadas de ejemplo:{' '}
                {item.latitud.toFixed(4)},{' '}
                {item.longitud.toFixed(4)}
              </Text>

              {orden === 'cercanos' && (
                <Text style={styles.distance}>
                  A {item.distancia.toFixed(1)} km del punto
                  de referencia
                </Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.title}>
              No encontramos coincidencias
            </Text>

            <Text style={styles.help}>
              Podés ajustar los filtros, publicar lo que te
              pasó o guardar esta búsqueda como alerta.
            </Text>

            <Button
              title={
                filtros.situacion === 'perdi'
                  ? 'Publicar mi pérdida'
                  : 'Publicar mi hallazgo'
              }
              onPress={publicar}
            />

            <Button
              title={
                alertaGuardada
                  ? 'Alerta guardada en esta sesión'
                  : 'Guardar búsqueda como alerta'
              }
              disabled={alertaGuardada}
              onPress={guardarBusquedaComoAlerta}
            />
          </View>
        }
        ListFooterComponent={
          publicaciones.length > 0 ? (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                disabled={pagina === 1}
                onPress={() => cambiarPagina(pagina - 1)}
              />

              <Text style={styles.page}>
                Página {pagina} de {totalPaginas}
              </Text>

              <Button
                title="Siguiente"
                disabled={pagina === totalPaginas}
                onPress={() => cambiarPagina(pagina + 1)}
              />
            </View>
          ) : null
        }
      />

      <Modal
        visible={mostrarFiltros}
        animationType="slide"
        onRequestClose={() => setMostrarFiltros(false)}
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>
              Refinar filtros
            </Text>

            <Button
              title="Cancelar"
              color="#6B7280"
              onPress={() => setMostrarFiltros(false)}
            />

            {mostrarFiltros && (
              <SearchForm
                key={claveBusqueda(filtros)}
                initialFilters={filtros}
                onSubmit={aplicarFiltros}
                submitLabel="Aplicar filtros"
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 14,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  help: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  order: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  orderButton: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  photo: {
    height: 140,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 48,
  },
  photoLabel: {
    color: '#1D4ED8',
    fontSize: 13,
  },
  details: {
    padding: 18,
    gap: 8,
  },
  type: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  coordinates: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  distance: {
    color: '#1D4ED8',
    fontSize: 14,
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 18,
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  page: {
    color: '#374151',
    fontSize: 14,
  },
});
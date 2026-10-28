import { buscarPublicacionesConCache } from '../services/publicaciones';
import { guardarUltimosResultadosBusqueda } from '../services/cacheOffline';
import { useEffect } from 'react';
import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Pressable,
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

export default function SearchResultsScreen({ route, navigation }) {
  return (
    <ResultadosBusqueda
      key={claveBusqueda(route.params.filtros)}
      route={route}
      navigation={navigation}
    />
  );
}

function ResultadosBusqueda({ route, navigation }) {
  const {
    alertas,
    alertasLoading,
    alertasGuardando,
    alertasError,
    recargarAlertas,
    recordarBusqueda,
    crearAlerta,
  } = useSearch();

  const [filtros, setFiltros] = useState(route.params.filtros);
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const listaRef = useRef(null);

  const [listaPublicaciones, setListaPublicaciones] = useState(() =>
    buscarPublicaciones(crearPublicacionesEjemplo(), filtros, orden)
  );
  const [esOffline, setEsOffline] = useState(false);
  const [cargandoResultados, setCargandoResultados] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargandoResultados(true);

    buscarPublicacionesConCache(filtros, orden)
      .then((res) => {
        if (!activo) return;
        if (res.items && res.items.length > 0) {
          setListaPublicaciones(res.items);
        } else {
          const demos = buscarPublicaciones(crearPublicacionesEjemplo(), filtros, orden);
          setListaPublicaciones(demos);
          if (!res.esOffline) {
            guardarUltimosResultadosBusqueda(demos, filtros, orden);
          }
        }
        setEsOffline(Boolean(res.esOffline));
      })
      .catch(() => {
        if (!activo) return;
        const demos = buscarPublicaciones(crearPublicacionesEjemplo(), filtros, orden);
        setListaPublicaciones(demos);
        setEsOffline(true);
      })
      .finally(() => {
        if (activo) setCargandoResultados(false);
      });

    return () => {
      activo = false;
    };
  }, [filtros, orden]);

  const publicaciones = listaPublicaciones;

  const totalPaginas = Math.max(
    1,
    Math.ceil(publicaciones.length / TAMANIO_PAGINA)
  );

  const visibles = publicaciones.slice(
    (pagina - 1) * TAMANIO_PAGINA,
    pagina * TAMANIO_PAGINA
  );

  const alertaGuardada = alertas.some(
    (alerta) => claveBusqueda(alerta.filtros) === claveBusqueda(filtros)
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
    navigation.navigate('CrearPublicacion', {
      tipo: filtros.situacion,
    });
  }

  async function guardarBusquedaComoAlerta() {
    const guardada = await crearAlerta(filtros);
    if (!guardada) return;

    Alert.alert(
      'Alerta guardada',
      'Podés verla, pausarla o eliminarla desde Mis alertas.'
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
            {esOffline && (
              <View style={styles.bannerOffline}>
                <Text style={styles.bannerOfflineIcon}>⚠️</Text>
                <View style={styles.bannerOfflineTexto}>
                  <Text style={styles.bannerOfflineTitulo}>Modo sin conexión</Text>
                  <Text style={styles.bannerOfflineMensaje}>
                    Mostrando los últimos resultados cargados exitosamente. La información podría no estar actualizada.
                  </Text>
                </View>
              </View>
            )}
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
              title={
                alertaGuardada
                  ? 'Alerta guardada'
                  : alertasGuardando
                    ? 'Guardando alerta…'
                    : 'Guardar búsqueda como alerta'
              }
              disabled={alertaGuardada || alertasGuardando || alertasLoading}
              onPress={guardarBusquedaComoAlerta}
            />

            {alertasError !== '' && (
              <View style={styles.header}>
                <Text accessibilityRole="alert" style={styles.error}>{alertasError}</Text>
                <Button
                  title="Reintentar carga de alertas"
                  onPress={recargarAlertas}
                  disabled={alertasLoading || alertasGuardando}
                />
              </View>
            )}

            <Button
              title="Mis alertas"
              onPress={() => navigation.navigate('Alertas')}
            />

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
          <Pressable
            style={styles.card}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('DetallePublicacion', {
                publicacionId: item.id,
              })
            }
          >
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
          </Pressable>
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
  error: { color: '#991B1B', fontSize: 15 },
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
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
});
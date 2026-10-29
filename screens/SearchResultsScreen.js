import { buscarPublicacionesConCache } from '../services/publicaciones';
import { mensajeErrorApi } from '../services/api';
import { useEffect } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
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
import { claveBusqueda, resumenBusqueda } from '../data/searchDemo';

const ICONOS_CATEGORIA = {
  Documentos: '🪪',
  Llaves: '🔑',
  Electrónica: '🎧',
  Mascotas: '🐕',
  Ropa: '🧥',
  Otros: '🎒',
};

function FotoTarjeta({ uri, categoria }) {
  const [fallo, setFallo] = useState(false);
  const mostrarFoto = Boolean(uri) && !fallo;

  if (mostrarFoto) {
    return (
      <Image
        source={{ uri }}
        style={styles.photo}
        resizeMode="cover"
        accessibilityLabel={`Foto de ${categoria}`}
        onError={() => setFallo(true)}
      />
    );
  }

  return (
    <View
      style={[styles.photo, styles.photoPlaceholder]}
      accessibilityLabel={`Sin foto de ${categoria}`}
    >
      <Text style={styles.icon}>{ICONOS_CATEGORIA[categoria] || '📦'}</Text>

      <Text style={styles.photoLabel}>
        {uri ? 'No se pudo cargar la foto' : 'Sin foto'}
      </Text>
    </View>
  );
}

function fechaHora(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

  const [resultado, setResultado] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [cargandoResultados, setCargandoResultados] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    let activo = true;
    setCargandoResultados(true);
    setErrorBusqueda('');

    buscarPublicacionesConCache(filtros, orden, {
      pagina,
      signal: controlador.signal,
    })
      .then((res) => {
        if (!activo) return;
        // Si la cantidad de páginas bajó mientras navegaba, vuelve a la última existente
        if (!res.esOffline && res.items.length === 0 && res.total > 0 && pagina > res.totalPaginas) {
          setPagina(res.totalPaginas);
          return;
        }
        setResultado(res);
        setCargandoResultados(false);
      })
      .catch((error) => {
        if (!activo) return;
        setResultado(null);
        setErrorBusqueda(mensajeErrorApi(error));
        setCargandoResultados(false);
      });

    return () => {
      activo = false;
      controlador.abort();
    };
  }, [filtros, orden, pagina, intento]);

  const publicaciones = cargandoResultados || !resultado ? [] : resultado.items;
  const esOffline = Boolean(resultado?.esOffline) && !cargandoResultados;
  const sinConexionSinCache = Boolean(resultado?.sinResultadosPrevios);
  const totalPaginas = resultado?.totalPaginas ?? 1;
  const hayResultados = publicaciones.length > 0;

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

  function reintentar() {
    setIntento((n) => n + 1);
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
                    {sinConexionSinCache
                      ? 'No hay conexión a internet y no hay resultados guardados en el dispositivo.'
                      : 'Estos son resultados guardados en el dispositivo, no los de tu búsqueda actual: pueden corresponder a otros filtros y estar desactualizados.'}
                  </Text>
                  {!sinConexionSinCache && resultado?.filtrosGuardados &&
                    typeof resultado.filtrosGuardados.palabras === 'string' && (
                    <Text style={styles.bannerOfflineMensaje}>
                      Búsqueda guardada: {resumenBusqueda(resultado.filtrosGuardados)}
                    </Text>
                  )}
                  {!sinConexionSinCache && resultado?.fechaGuardado && (
                    <Text style={styles.bannerOfflineMensaje}>
                      Guardados el {fechaHora(resultado.fechaGuardado)}
                    </Text>
                  )}
                  <Button title="Reintentar" onPress={reintentar} />
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
              {cargandoResultados
                ? 'Buscando…'
                : esOffline
                  ? `${publicaciones.length} resultados guardados`
                  : errorBusqueda
                    ? 'No se pudo completar la búsqueda'
                    : `${resultado?.total ?? 0} coincidencias`}
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
                {filtros.zona || 'tu ubicación'}.
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
            <FotoTarjeta
              uri={item.fotos?.[0]}
              categoria={item.categoria}
            />

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

              {orden === 'cercanos' && item.distancia != null && (
                <Text style={styles.distance}>
                  A {item.distancia.toFixed(1)} km del punto
                  de referencia
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          cargandoResultados ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#1D4ED8" />
              <Text style={styles.help}>Buscando publicaciones…</Text>
            </View>
          ) : errorBusqueda ? (
            <View style={styles.empty}>
              <Text style={styles.title}>
                No pudimos cargar los resultados
              </Text>

              <Text accessibilityRole="alert" style={styles.error}>
                {errorBusqueda}
              </Text>

              <Button title="Reintentar" onPress={reintentar} />
            </View>
          ) : sinConexionSinCache ? (
            <View style={styles.empty}>
              <Text style={styles.title}>
                Sin conexión
              </Text>

              <Text style={styles.help}>
                Conectate a internet para ver las publicaciones que
                coinciden con tu búsqueda.
              </Text>

              <Button title="Reintentar" onPress={reintentar} />
            </View>
          ) : (
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
                    ? 'Alerta guardada'
                    : alertasGuardando
                      ? 'Guardando alerta…'
                      : 'Guardar búsqueda como alerta'
                }
                disabled={alertaGuardada || alertasGuardando || alertasLoading}
                onPress={guardarBusquedaComoAlerta}
              />
            </View>
          )
        }
        ListFooterComponent={
          hayResultados && !esOffline ? (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                disabled={pagina <= 1}
                onPress={() => cambiarPagina(pagina - 1)}
              />

              <Text style={styles.page}>
                Página {pagina} de {totalPaginas}
              </Text>

              <Button
                title="Siguiente"
                disabled={pagina >= totalPaginas}
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
  },
  photoPlaceholder: {
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
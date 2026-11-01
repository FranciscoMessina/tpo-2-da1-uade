import { buscarPublicacionesConCache } from '../services/publicaciones';
import { estaConectado } from '../services/conexion';
import { esMensajeSinConexion, mensajeErrorApi } from '../services/api';
import { useEffect } from 'react';
import { useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import SearchForm from '../components/SearchForm';
import TarjetaPublicacion from '../components/TarjetaPublicacion';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';
import { claveBusqueda, resumenBusqueda } from '../data/searchDemo';
import {
  AvisoSinConexion,
  Boton,
  Cargando,
  ErrorConReintento,
  EstadoVacio,
  Fila,
  GrupoOpciones,
  ModalPantalla,
  Paginacion,
  Texto,
  espacio,
  estilosPantalla,
  irAPestana,
} from '../components/ui';

const MENSAJE_ALERTA_SIN_CONEXION =
  'Sin conexión: no se puede guardar la alerta. Podés seguir viendo los resultados y guardarla cuando vuelva la conexión.';

function esCoordenada(valor, limite) {
  return typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) <= limite;
}

// Coordenadas públicas de la publicación (la API ya las devuelve redondeadas, nunca la dirección
// exacta). Se vuelven a redondear acá para no mostrar más precisión que la aproximada, y se
// devuelve null si faltan o no son válidas.
function ubicacionAproximada(publicacion) {
  const origen = publicacion.ubicacion ?? publicacion;
  const { latitud, longitud } = origen;
  if (!esCoordenada(latitud, 90) || !esCoordenada(longitud, 180)) return null;
  return { latitud: latitud.toFixed(3), longitud: longitud.toFixed(3) };
}

function UbicacionAproximada({ publicacion }) {
  const ubicacion = ubicacionAproximada(publicacion);
  if (!ubicacion) return null;

  return (
    <Texto variante="leyenda" tono="secundario">
      Ubicación aproximada: {ubicacion.latitud}, {ubicacion.longitud}
    </Texto>
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

  const { hayConexion } = useConexion();
  const sinConexion = !hayConexion;

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

  const alertaDeshabilitada =
    alertaGuardada || alertasGuardando || alertasLoading || sinConexion;

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
    // Guardar es una mutación: se vuelve a comprobar la conexión al tocar, por si cayó
    // entre el último render y el toque.
    if (!estaConectado()) {
      Alert.alert('Sin conexión', MENSAJE_ALERTA_SIN_CONEXION);
      return;
    }

    const guardada = await crearAlerta(filtros);
    if (!guardada) return;

    Alert.alert(
      'Alerta guardada',
      'Podés verla, pausarla o eliminarla desde Mis alertas.'
    );
  }

  const tituloAlerta = alertaGuardada
    ? 'Alerta guardada'
    : alertasGuardando
      ? 'Guardando alerta…'
      : 'Guardar búsqueda como alerta';

  return (
    <View style={estilosPantalla.pantalla}>
      <FlatList
        ref={listaRef}
        data={publicaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilosPantalla.contenido}
        ListHeaderComponent={
          <View style={styles.encabezado}>
            {esOffline && (
              <AvisoSinConexion
                mensaje={
                  sinConexionSinCache
                    ? 'No hay conexión a internet y no hay resultados guardados en el dispositivo.'
                    : 'Estos son resultados guardados en el dispositivo, no los de tu búsqueda actual: pueden corresponder a otros filtros y estar desactualizados.'
                }
                accion={{ titulo: 'Reintentar', onPress: reintentar }}
              >
                {!sinConexionSinCache && resultado?.filtrosGuardados &&
                  typeof resultado.filtrosGuardados.palabras === 'string' && (
                  <Texto variante="cuerpoChico" tono="aviso">
                    Búsqueda guardada: {resumenBusqueda(resultado.filtrosGuardados)}
                  </Texto>
                )}
                {!sinConexionSinCache && resultado?.fechaGuardado && (
                  <Texto variante="cuerpoChico" tono="aviso">
                    Guardados el {fechaHora(resultado.fechaGuardado)}
                  </Texto>
                )}
              </AvisoSinConexion>
            )}

            <View style={styles.resumen}>
              <Texto variante="pantalla">
                {filtros.situacion === 'perdi'
                  ? 'Publicaciones de hallazgos'
                  : 'Publicaciones de pérdidas'}
              </Texto>

              <Texto variante="cuerpoChico" tono="secundario">
                {resumenBusqueda(filtros)}
              </Texto>

              <Texto variante="etiqueta" tono="secundario">
                {cargandoResultados
                  ? 'Buscando…'
                  : esOffline
                    ? `${publicaciones.length} resultados guardados`
                    : errorBusqueda
                      ? 'No se pudo completar la búsqueda'
                      : `${resultado?.total ?? 0} coincidencias`}
              </Texto>
            </View>

            <Fila>
              <Boton
                titulo="Refinar filtros"
                icono="filter-variant"
                variante="secundario"
                chico
                flexible
                onPress={() => setMostrarFiltros(true)}
              />

              <Boton
                titulo="Mis alertas"
                icono="bell-outline"
                variante="secundario"
                chico
                flexible
                onPress={() => irAPestana(navigation, 'Alertas')}
              />
            </Fila>

            <Boton
              titulo={tituloAlerta}
              icono="bell-plus-outline"
              variante="terciario"
              chico
              cargando={alertasGuardando}
              disabled={alertaDeshabilitada}
              onPress={guardarBusquedaComoAlerta}
            />

            {sinConexion && !alertaGuardada && (
              <Texto variante="cuerpoChico" tono="aviso" accessibilityRole="alert">
                {MENSAJE_ALERTA_SIN_CONEXION}
              </Texto>
            )}

            {alertasError !== '' && (
              <View style={styles.resumen}>
                <Texto
                  variante="cuerpoChico"
                  tono={esMensajeSinConexion(alertasError) ? 'aviso' : 'peligro'}
                  accessibilityRole="alert"
                >
                  {alertasError}
                </Texto>
                <Boton
                  titulo="Reintentar carga de alertas"
                  variante="terciario"
                  chico
                  onPress={recargarAlertas}
                  disabled={alertasLoading || alertasGuardando}
                />
              </View>
            )}

            <GrupoOpciones
              chico
              opciones={[
                { valor: 'recientes', nombre: 'Más recientes' },
                { valor: 'cercanos', nombre: 'Más cercanos' },
              ]}
              valor={orden}
              onChange={elegirOrden}
            />

            {orden === 'cercanos' && (
              <Texto variante="cuerpoChico" tono="secundario">
                Distancia desde{' '}
                {filtros.zona || 'tu ubicación'}.
              </Texto>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TarjetaPublicacion
            publicacion={item}
            onPress={() =>
              navigation.navigate('DetallePublicacion', {
                publicacionId: item.id,
              })
            }
          >
            <UbicacionAproximada publicacion={item} />

            {orden === 'cercanos' && item.distancia != null && (
              <Texto variante="etiqueta" tono="primario">
                A {item.distancia.toFixed(1)} km del punto de referencia
              </Texto>
            )}
          </TarjetaPublicacion>
        )}
        ListEmptyComponent={
          cargandoResultados ? (
            <Cargando etiqueta="Buscando publicaciones…" />
          ) : errorBusqueda ? (
            <ErrorConReintento
              titulo="No pudimos cargar los resultados"
              mensaje={errorBusqueda}
              onReintentar={reintentar}
            />
          ) : sinConexionSinCache ? (
            <EstadoVacio
              icono="wifi-off"
              tono="aviso"
              titulo="Sin conexión"
              mensaje="Conectate a internet para ver las publicaciones que coinciden con tu búsqueda."
            >
              <Boton
                titulo="Reintentar"
                icono="refresh"
                variante="secundario"
                onPress={reintentar}
              />
            </EstadoVacio>
          ) : (
            <EstadoVacio
              icono="magnify"
              titulo="No encontramos coincidencias"
              mensaje="Podés ajustar los filtros, publicar lo que te pasó o guardar esta búsqueda como alerta."
            >
              <Boton
                titulo={
                  filtros.situacion === 'perdi'
                    ? 'Publicar mi pérdida'
                    : 'Publicar mi hallazgo'
                }
                icono="plus"
                onPress={publicar}
              />

              <Boton
                titulo={tituloAlerta}
                icono="bell-plus-outline"
                variante="secundario"
                cargando={alertasGuardando}
                disabled={alertaDeshabilitada}
                onPress={guardarBusquedaComoAlerta}
              />
            </EstadoVacio>
          )
        }
        ListFooterComponent={
          hayResultados && !esOffline ? (
            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              onCambiar={cambiarPagina}
            />
          ) : null
        }
      />

      <ModalPantalla
        visible={mostrarFiltros}
        titulo="Refinar filtros"
        onCerrar={() => setMostrarFiltros(false)}
      >
        {mostrarFiltros && (
          <SearchForm
            key={claveBusqueda(filtros)}
            initialFilters={filtros}
            onSubmit={aplicarFiltros}
            submitLabel="Aplicar filtros"
          />
        )}
      </ModalPantalla>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: { gap: espacio.sm, marginBottom: espacio.xxs },
  resumen: { gap: espacio.xxs },
});

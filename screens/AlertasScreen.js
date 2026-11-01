import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';
import { resumenBusqueda } from '../data/busqueda';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Cargando,
  EstadoVacio,
  FilaInterruptor,
  Insignia,
  Separador,
  Tarjeta,
  Texto,
  Tocable,
  espacio,
  estilosPantalla,
  radios,
} from '../components/ui';

export default function AlertasScreen({ navigation }) {
  const {
    alertas,
    alertasLoading,
    alertasError,
    alertasGuardando,
    recargarAlertas,
    eliminarAlerta,
    activarAlerta,
    novedadesPorAlerta,
    novedadesLoading,
    novedadesError,
    novedadesGuardando,
    recargarNovedades,
    marcarAlertaLeida,
  } = useSearch();

  const { hayConexion } = useConexion();
  const sinConexion = !hayConexion;

  const actualizar = useCallback(() => {
    recargarAlertas();
    recargarNovedades();
  }, [recargarAlertas, recargarNovedades]);

  useFocusEffect(actualizar);

  const bloqueado = alertasLoading || alertasGuardando || novedadesGuardando;

  function confirmarEliminar(alerta) {
    if (sinConexion) return;

    Alert.alert(
      'Eliminar alerta',
      '¿Querés eliminar esta alerta? No vas a recibir más avisos de esta búsqueda.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => eliminarAlerta(alerta.id),
        },
      ]
    );
  }

  function ejecutar(alerta) {
    navigation.navigate('Resultados', { filtros: alerta.filtros });
  }

  return (
    <FlatList
      style={estilosPantalla.pantalla}
      contentContainerStyle={estilosPantalla.contenido}
      data={alertas}
      extraData={novedadesPorAlerta}
      refreshing={alertasLoading || novedadesLoading}
      onRefresh={actualizar}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.encabezado}>
          {sinConexion && (
            <AvisoSinConexion
              mensaje="Podés ver tus alertas guardadas, pero no pausarlas, eliminarlas ni marcar novedades como leídas hasta que vuelva la conexión."
            />
          )}
          {!sinConexion && alertasError !== '' && (
            <Aviso tono="peligro" mensaje={alertasError} accessibilityRole="alert" />
          )}
          {!sinConexion && novedadesError !== '' && (
            <Aviso
              tono="peligro"
              mensaje={`No se pudieron actualizar las novedades. ${novedadesError}`}
              accessibilityRole="alert"
            />
          )}

          <Boton
            titulo={alertasError || novedadesError ? 'Reintentar' : 'Actualizar alertas'}
            icono="refresh"
            variante="terciario"
            chico
            ajustado
            onPress={actualizar}
            cargando={novedadesLoading}
            disabled={bloqueado}
          />

          {novedadesLoading && (
            <Texto variante="cuerpoChico" tono="secundario">Actualizando novedades…</Texto>
          )}
          {(alertasGuardando || novedadesGuardando) && (
            <Cargando etiqueta="Guardando cambios…" chico />
          )}
        </View>
      }
      renderItem={({ item }) => {
        const nuevas = novedadesPorAlerta.get(item.id) || 0;

        return (
          <Tarjeta destacada={nuevas > 0}>
            <Tocable
              radio={radios.chico}
              accessibilityLabel={`Ejecutar búsqueda: ${resumenBusqueda(item.filtros)}`}
              onPress={() => ejecutar(item)}
              style={styles.alerta}
            >
              <Texto variante="subtitulo">{resumenBusqueda(item.filtros)}</Texto>

              {item.filtros.ubicacion && (
                <Texto variante="cuerpoChico" tono="secundario">
                  Centro fijo: la alerta no sigue tu ubicación.
                </Texto>
              )}

              {nuevas > 0 ? (
                <Insignia
                  tono="info"
                  texto={nuevas === 1 ? '1 publicación nueva' : `${nuevas} publicaciones nuevas`}
                />
              ) : (
                <Texto variante="cuerpoChico" tono="secundario">
                  {novedadesLoading ? 'Consultando novedades…'
                    : novedadesError ? 'Novedades sin actualizar'
                      : '0 publicaciones nuevas'}
                </Texto>
              )}

              <Texto variante="etiqueta" tono="primario">Ver resultados</Texto>
            </Tocable>

            {nuevas > 0 && (
              <Boton
                titulo="Marcar novedades como leídas"
                variante="secundario"
                chico
                onPress={() => marcarAlertaLeida(item.id)}
                disabled={bloqueado || novedadesLoading}
                requiereConexion
              />
            )}

            <Separador />

            <View style={styles.pie}>
              <View style={styles.interruptor}>
                <FilaInterruptor
                  etiqueta={item.activa ? 'Activa' : 'Desactivada'}
                  accessibilityLabel="Alerta activa"
                  valor={item.activa}
                  disabled={bloqueado || sinConexion}
                  onChange={(valor) => activarAlerta(item.id, valor)}
                />
              </View>

              <Boton
                titulo="Eliminar"
                icono="trash-can-outline"
                variante="peligro"
                chico
                disabled={bloqueado}
                requiereConexion
                onPress={() => confirmarEliminar(item)}
              />
            </View>
          </Tarjeta>
        );
      }}
      ListEmptyComponent={alertasLoading ? (
        <Cargando etiqueta="Cargando alertas…" />
      ) : alertasError ? null : (
        <EstadoVacio
          icono="bell-outline"
          titulo="Todavía no tenés alertas"
          mensaje="Desde cualquier búsqueda podés guardar una alerta para recibir novedades de publicaciones que coincidan."
        >
          <Boton
            titulo="Ir al buscador"
            variante="secundario"
            onPress={() => navigation.navigate('Buscador')}
          />
        </EstadoVacio>
      )}
    />
  );
}

const styles = StyleSheet.create({
  encabezado: { gap: espacio.xs, marginBottom: espacio.xxs },
  alerta: { gap: espacio.xs },
  pie: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  interruptor: { flex: 1 },
});

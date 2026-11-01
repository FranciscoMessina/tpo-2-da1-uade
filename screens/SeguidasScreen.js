import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import TarjetaPublicacion from '../components/TarjetaPublicacion';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Cargando,
  EstadoVacio,
  Insignia,
  Texto,
  espacio,
  estilosPantalla,
} from '../components/ui';

export default function SeguidasScreen({ navigation }) {
  const {
    seguidas,
    seguidasLoading,
    seguidasError,
    seguidasGuardando,
    recargarSeguidas,
    dejarDeSeguirPublicacion,
    novedadesPorPublicacion,
    novedadesLoading,
    novedadesError,
    novedadesGuardando,
    recargarNovedades,
    marcarPublicacionLeida,
  } = useSearch();

  const { hayConexion } = useConexion();
  const sinConexion = !hayConexion;

  const actualizar = useCallback(() => {
    recargarSeguidas();
    recargarNovedades();
  }, [recargarSeguidas, recargarNovedades]);

  useFocusEffect(actualizar);

  const bloqueado = seguidasLoading || seguidasGuardando || novedadesGuardando;

  function confirmarDejarDeSeguir(publicacion) {
    if (sinConexion) return;

    Alert.alert(
      'Dejar de seguir',
      `¿Querés dejar de recibir novedades de "${publicacion.titulo}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dejar de seguir',
          style: 'destructive',
          onPress: () => dejarDeSeguirPublicacion(publicacion.id),
        },
      ]
    );
  }

  return (
    <FlatList
      style={estilosPantalla.pantalla}
      contentContainerStyle={estilosPantalla.contenido}
      data={seguidas}
      extraData={novedadesPorPublicacion}
      keyExtractor={(item) => item.id}
      refreshing={seguidasLoading || novedadesLoading}
      onRefresh={actualizar}
      ListHeaderComponent={
        <View style={styles.encabezado}>
          {sinConexion && (
            <AvisoSinConexion
              mensaje="Podés ver las publicaciones que seguís, pero no dejar de seguirlas ni marcar novedades como leídas hasta que vuelva la conexión."
            />
          )}
          {!sinConexion && seguidasError !== '' && (
            <Aviso tono="peligro" mensaje={seguidasError} accessibilityRole="alert" />
          )}
          {!sinConexion && novedadesError !== '' && (
            <Aviso
              tono="peligro"
              mensaje={`No se pudieron actualizar las novedades. ${novedadesError}`}
              accessibilityRole="alert"
            />
          )}

          <Boton
            titulo={seguidasError || novedadesError ? 'Reintentar' : 'Actualizar seguidas'}
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
          {(seguidasGuardando || novedadesGuardando) && (
            <Cargando etiqueta="Guardando cambios…" chico />
          )}
        </View>
      }
      renderItem={({ item }) => {
        const nuevas = novedadesPorPublicacion.get(item.id) || 0;

        return (
          <TarjetaPublicacion
            publicacion={item}
            mostrarEstado
            destacada={nuevas > 0}
            accessibilityLabel={`Ver ${item.titulo}`}
            onPress={() => navigation.navigate('DetallePublicacion', {
              publicacionId: item.id,
            })}
            pie={
              <>
                {nuevas > 0 && (
                  <Boton
                    titulo="Marcar novedades como leídas"
                    variante="secundario"
                    chico
                    onPress={() => marcarPublicacionLeida(item.id)}
                    disabled={bloqueado || novedadesLoading}
                    requiereConexion
                  />
                )}
                <Boton
                  titulo="Dejar de seguir"
                  variante="terciario"
                  chico
                  disabled={bloqueado}
                  requiereConexion
                  onPress={() => confirmarDejarDeSeguir(item)}
                />
              </>
            }
          >
            {nuevas > 0 ? (
              <Insignia
                tono="info"
                texto={nuevas === 1 ? '1 novedad pendiente' : `${nuevas} novedades pendientes`}
              />
            ) : (
              <Texto variante="cuerpoChico" tono="secundario">
                {novedadesLoading ? 'Consultando novedades…'
                  : novedadesError ? 'Novedades sin actualizar'
                    : 'Sin novedades pendientes'}
              </Texto>
            )}
          </TarjetaPublicacion>
        );
      }}
      ListEmptyComponent={seguidasLoading ? (
        <Cargando etiqueta="Cargando publicaciones seguidas…" />
      ) : seguidasError ? null : (
        <EstadoVacio
          icono="bookmark-outline"
          titulo="Todavía no seguís publicaciones"
          mensaje="Desde el detalle de una publicación podés seguirla para consultar sus novedades."
        >
          <Boton
            titulo="Buscar publicaciones"
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
});

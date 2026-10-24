import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSearch } from '../context/SearchContext';

const ESTADOS = {
  abierta: 'Abierta',
  en_reclamo: 'En reclamo',
  resuelta: 'Resuelta',
  vencida: 'Vencida',
};

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

  const actualizar = useCallback(() => {
    recargarSeguidas();
    recargarNovedades();
  }, [recargarSeguidas, recargarNovedades]);

  useFocusEffect(actualizar);

  const bloqueado = seguidasLoading || seguidasGuardando || novedadesGuardando;

  function confirmarDejarDeSeguir(publicacion) {
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
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={seguidas}
      extraData={novedadesPorPublicacion}
      keyExtractor={(item) => item.id}
      refreshing={seguidasLoading || novedadesLoading}
      onRefresh={actualizar}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Publicaciones seguidas</Text>
          <Text style={styles.help}>
            Consultá las publicaciones que te interesan y entrá a su detalle.
          </Text>
          <Text style={styles.help}>
            Los cambios pendientes de leer se destacan en cada publicación.
          </Text>
          {seguidasError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>{seguidasError}</Text>
          )}
          {novedadesError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>
              No se pudieron actualizar las novedades. {novedadesError}
            </Text>
          )}
          <Button
            title={seguidasError || novedadesError ? 'Reintentar' : 'Actualizar seguidas'}
            onPress={actualizar}
            disabled={bloqueado || novedadesLoading}
          />
          {novedadesLoading && <Text style={styles.help}>Actualizando novedades…</Text>}
          {(seguidasGuardando || novedadesGuardando) && (
            <View style={styles.row}>
              <ActivityIndicator color="#1D4ED8" />
              <Text style={styles.help}>Guardando cambios…</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const nuevas = novedadesPorPublicacion.get(item.id) || 0;
        return (
          <View style={[styles.card, nuevas > 0 && styles.cardNew]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver ${item.titulo}`}
              onPress={() => navigation.navigate('DetallePublicacion', {
                publicacionId: item.id,
              })}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.photo}>
                {item.fotos[0] ? (
                  <Image
                    source={{ uri: item.fotos[0] }}
                    accessibilityLabel={`Foto de ${item.titulo}`}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.help}>Sin foto</Text>
                )}
              </View>
              <View style={styles.details}>
                <Text style={styles.type}>
                  {item.tipo === 'encontrado' ? 'ENCONTRADO' : 'PERDIDO'}
                </Text>
                <Text style={styles.cardTitle}>{item.titulo}</Text>
                {nuevas > 0 ? (
                  <Text style={styles.badge}>
                    {nuevas === 1 ? '1 novedad pendiente' : `${nuevas} novedades pendientes`}
                  </Text>
                ) : (
                  <Text style={styles.help}>
                    {novedadesLoading ? 'Consultando novedades…'
                      : novedadesError ? 'Novedades sin actualizar'
                        : 'Sin novedades pendientes'}
                  </Text>
                )}
                <Text style={styles.help}>{item.categoria} · {item.barrio}</Text>
                <Text style={styles.help}>
                  Fecha del suceso: {item.fecha.split('-').reverse().join('/')}
                </Text>
                <Text style={styles.status}>
                  {ESTADOS[item.estado] || item.estado}
                </Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              {nuevas > 0 && (
                <Button
                  title="Marcar novedades como leídas"
                  onPress={() => marcarPublicacionLeida(item.id)}
                  disabled={bloqueado || novedadesLoading}
                />
              )}
              <Button
                title="Dejar de seguir"
                color="#B91C1C"
                disabled={bloqueado}
                onPress={() => confirmarDejarDeSeguir(item)}
              />
            </View>
          </View>
        );
      }}
      ListEmptyComponent={seguidasLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.help}>Cargando publicaciones seguidas…</Text>
        </View>
      ) : seguidasError ? null : (
        <View style={styles.empty}>
          <Text style={styles.cardTitle}>Todavía no seguís publicaciones</Text>
          <Text style={styles.help}>
            Desde el detalle de una publicación podés seguirla para consultar sus novedades.
          </Text>
          <Button
            title="Buscar publicaciones"
            onPress={() => navigation.navigate('Buscador')}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, gap: 16 },
  header: { gap: 12, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  help: { color: '#6B7280', fontSize: 15, lineHeight: 22 },
  error: { color: '#991B1B', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'transparent',
  },
  cardNew: { borderColor: '#2563EB' },
  badge: {
    alignSelf: 'flex-start', color: '#1E40AF', backgroundColor: '#DBEAFE',
    fontWeight: 'bold', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  photo: { height: 140, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  details: { padding: 18, gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  type: { fontSize: 12, fontWeight: 'bold', color: '#1D4ED8' },
  status: { fontSize: 14, fontWeight: 'bold', color: '#374151' },
  actions: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.7 },
  empty: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, gap: 14 },
});

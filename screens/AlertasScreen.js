import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSearch } from '../context/SearchContext';
import { resumenBusqueda } from '../data/searchDemo';

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

  const actualizar = useCallback(() => {
    recargarAlertas();
    recargarNovedades();
  }, [recargarAlertas, recargarNovedades]);

  useFocusEffect(actualizar);

  const bloqueado = alertasLoading || alertasGuardando || novedadesGuardando;

  function confirmarEliminar(alerta) {
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
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={alertas}
      extraData={novedadesPorAlerta}
      refreshing={alertasLoading || novedadesLoading}
      onRefresh={actualizar}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Alertas guardadas</Text>
          <Text style={styles.help}>
            Tocá una alerta para repetir su búsqueda. Podés pausarla o
            eliminarla cuando quieras.
          </Text>
          <Text style={styles.help}>
            Las publicaciones nuevas que coincidan se destacan en cada alerta.
            Un período como «Hoy» o «Última semana» se evalúa cuando se publica
            algo; un rango de fechas queda fijo.
          </Text>
          {alertasError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>{alertasError}</Text>
          )}
          {novedadesError !== '' && (
            <Text accessibilityRole="alert" style={styles.error}>
              No se pudieron actualizar las novedades. {novedadesError}
            </Text>
          )}
          <Button
            title={alertasError || novedadesError ? 'Reintentar' : 'Actualizar alertas'}
            onPress={actualizar}
            disabled={bloqueado || novedadesLoading}
          />
          {novedadesLoading && <Text style={styles.help}>Actualizando novedades…</Text>}
          {(alertasGuardando || novedadesGuardando) && (
            <View style={styles.switchRow}>
              <ActivityIndicator color="#1D4ED8" />
              <Text style={styles.help}>Guardando cambios…</Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const nuevas = novedadesPorAlerta.get(item.id) || 0;
        return (
          <View style={[
            styles.card,
            nuevas > 0 && styles.cardNew,
            !item.activa && styles.inactive,
          ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ejecutar búsqueda: ${resumenBusqueda(item.filtros)}`}
              onPress={() => ejecutar(item)}
              style={({ pressed }) => [styles.body, pressed && styles.pressed]}
            >
              <Text style={styles.summary}>{resumenBusqueda(item.filtros)}</Text>
              {item.filtros.ubicacion && (
                <Text style={styles.help}>
                  Centro fijo: la alerta no sigue tu ubicación.
                </Text>
              )}
              {nuevas > 0 ? (
                <Text style={styles.badge}>
                  {nuevas === 1 ? '1 publicación nueva' : `${nuevas} publicaciones nuevas`}
                </Text>
              ) : (
                <Text style={styles.help}>
                  {novedadesLoading ? 'Consultando novedades…'
                    : novedadesError ? 'Novedades sin actualizar'
                      : '0 publicaciones nuevas'}
                </Text>
              )}
              <Text style={styles.repeat}>Ver resultados →</Text>
            </Pressable>

            {nuevas > 0 && (
              <Button
                title="Marcar novedades como leídas"
                onPress={() => marcarAlertaLeida(item.id)}
                disabled={bloqueado || novedadesLoading}
              />
            )}
            <View style={styles.actions}>
              <View style={styles.switchRow}>
                <Switch
                  value={item.activa}
                  disabled={bloqueado}
                  onValueChange={(valor) => activarAlerta(item.id, valor)}
                  accessibilityLabel="Alerta activa"
                />
                <Text style={styles.help}>
                  {item.activa ? 'Activa' : 'Desactivada'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={bloqueado}
                accessibilityState={{ disabled: bloqueado }}
                onPress={() => confirmarEliminar(item)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.delete}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={alertasLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.help}>Cargando alertas…</Text>
        </View>
      ) : alertasError ? null : (
        <View style={styles.empty}>
          <Text style={styles.subtitle}>Todavía no tenés alertas</Text>
          <Text style={styles.help}>
            Desde cualquier búsqueda podés guardar una alerta para recibir
            novedades de publicaciones que coincidan.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Buscador')}
          >
            <Text style={styles.repeat}>Ir al buscador →</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 20, gap: 16 },
  header: { gap: 10, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  help: { color: '#6B7280', fontSize: 15, lineHeight: 22 },
  error: {
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardNew: { borderColor: '#2563EB' },
  badge: {
    alignSelf: 'flex-start',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  inactive: { opacity: 0.6 },
  body: { gap: 10 },
  pressed: { opacity: 0.7 },
  summary: { color: '#374151', fontSize: 15, lineHeight: 22 },
  repeat: { color: '#1D4ED8', fontWeight: 'bold' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delete: { color: '#B91C1C', fontWeight: 'bold' },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
});

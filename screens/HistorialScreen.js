import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import CasoResuelto from '../components/CasoResuelto';
import { obtenerHistorial } from '../services/historial';
import { mensajeErrorApi } from '../services/api';

function fechaValida(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    !Number.isNaN(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
}

export default function HistorialScreen({ navigation }) {
  const [tipo, setTipo] = useState('devolvi');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtros, setFiltros] = useState({});
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ items: [], totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorFiltro, setErrorFiltro] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setError('');
    obtenerHistorial({ ...filtros, tipo, page: pagina })
      .then((datos) => { if (activo) setResultado(datos); })
      .catch((e) => { if (activo) setError(mensajeErrorApi(e)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tipo, filtros, pagina, actualizacion]));

  function aplicarFiltros() {
    const inicio = desde.trim();
    const fin = hasta.trim();
    if ((inicio && !fechaValida(inicio)) || (fin && !fechaValida(fin))) {
      setErrorFiltro('Usá fechas válidas con formato AAAA-MM-DD.');
      return;
    }
    if (inicio && fin && inicio > fin) {
      setErrorFiltro('La fecha desde debe ser anterior o igual a hasta.');
      return;
    }
    setErrorFiltro('');
    setPagina(1);
    setFiltros({ desde: inicio || undefined, hasta: fin || undefined });
  }

  function recargar() { setActualizacion((n) => n + 1); }

  return (
    <View style={styles.screen}>
      <View style={styles.filtros}>
        <View style={styles.fila}>
          {[['devolvi', 'Devolví'], ['recupere', 'Recuperé']].map(([valor, texto]) => (
            <Pressable key={valor} accessibilityRole="button" accessibilityState={{ selected: tipo === valor }}
              style={[styles.tab, tipo === valor && styles.tabActiva]}
              onPress={() => { setTipo(valor); setPagina(1); }}>
              <Text style={styles.tabTexto}>{texto}</Text>
            </Pressable>
          ))}
        </View>
        <Text>Fecha de devolución (AAAA-MM-DD)</Text>
        <View style={styles.fila}>
          <TextInput style={styles.input} placeholder="Desde" accessibilityLabel="Fecha desde"
            value={desde} onChangeText={setDesde} maxLength={10} />
          <TextInput style={styles.input} placeholder="Hasta" accessibilityLabel="Fecha hasta"
            value={hasta} onChangeText={setHasta} maxLength={10} />
        </View>
        {!!errorFiltro && <Text style={styles.error}>{errorFiltro}</Text>}
        <View style={styles.fila}>
          <Button title="Filtrar" onPress={aplicarFiltros} />
          <Button title="Limpiar fechas" onPress={() => {
            setDesde(''); setHasta(''); setFiltros({}); setPagina(1); setErrorFiltro('');
          }} />
        </View>
      </View>
      {cargando ? <ActivityIndicator style={styles.center} size="large" color="#1D4ED8" /> : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Reintentar" onPress={recargar} />
        </View>
      ) : (
        <FlatList data={resultado.items} keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista} refreshing={cargando} onRefresh={recargar}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <CasoResuelto caso={item} navigation={navigation} onGuardar={recargar} />}
          ListEmptyComponent={<Text style={styles.center}>No hay casos resueltos para estos filtros.</Text>}
          ListFooterComponent={resultado.totalPages > 1 ? (
            <View style={styles.paginacion}>
              <Button title="Anterior" disabled={pagina === 1} onPress={() => setPagina(pagina - 1)} />
              <Text>{pagina} / {resultado.totalPages}</Text>
              <Button title="Siguiente" disabled={pagina >= resultado.totalPages} onPress={() => setPagina(pagina + 1)} />
            </View>
          ) : null} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  filtros: { padding: 16, gap: 10, backgroundColor: '#FFFFFF' },
  fila: { flexDirection: 'row', gap: 12 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#E5E7EB' },
  tabActiva: { borderBottomColor: '#1D4ED8', backgroundColor: '#DBEAFE' },
  tabTexto: { fontWeight: '600', color: '#1D4ED8' },
  input: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, color: '#111827' },
  lista: { padding: 16, gap: 16 },
  center: { padding: 24, textAlign: 'center' },
  error: { color: '#B91C1C', marginBottom: 8 },
  paginacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
});

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { obtenerAgradecimientos } from '../services/historial';
import { mensajeErrorApi } from '../services/api';

export default function AgradecimientosPublicos({ usuarioId }) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ items: [], totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setError('');
    obtenerAgradecimientos(usuarioId, pagina)
      .then((datos) => { if (activo) setResultado(datos); })
      .catch((e) => { if (activo) setError(mensajeErrorApi(e)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [usuarioId, pagina, intento]));

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Agradecimientos</Text>
      {cargando ? <ActivityIndicator color="#1D4ED8" /> : error ? (
        <View>
          <Text>{error}</Text>
          <Button title="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      ) : (
        <View style={styles.lista}>
          {resultado.items.length === 0 && <Text>Todavía no recibió agradecimientos.</Text>}
          {resultado.items.map((item) => (
            <View key={item.id} style={styles.mensaje}>
              <Text style={styles.autor}>{item.autor.name}</Text>
              <Text>{item.mensaje}</Text>
              <Text style={styles.fecha}>{new Date(item.createdAt).toLocaleDateString('es-AR')}</Text>
            </View>
          ))}
          {resultado.totalPages > 1 && (
            <View>
              <Text>Página {pagina} de {resultado.totalPages}</Text>
              <Button title="Anterior" disabled={pagina === 1} onPress={() => setPagina(pagina - 1)} />
              <Button title="Siguiente" disabled={pagina >= resultado.totalPages} onPress={() => setPagina(pagina + 1)} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, gap: 12 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  lista: { gap: 16 },
  mensaje: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, gap: 6 },
  autor: { fontWeight: '600', color: '#111827' },
  fecha: { color: '#6B7280', fontSize: 12 },
});

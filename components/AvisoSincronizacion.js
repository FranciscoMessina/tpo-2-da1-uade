import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColaPublicaciones } from '../context/ColaPublicacionesContext';
import useAuth from '../hooks/useAuth';
import { textoResumenCola } from '../services/colaPublicaciones';

// Franja inferior con lo que quedó pendiente de sincronizar: publicaciones recién enviadas,
// sesión sin validar (restaurada sin conexión) y estado de la cola de publicaciones.
export default function AvisoSincronizacion({ navegar }) {
  const { autenticado, sesionOffline } = useAuth();
  const { resumen, avisos, descartarAviso } = useColaPublicaciones();

  if (!autenticado) return null;

  const textoCola = textoResumenCola(resumen);
  if (!textoCola && !sesionOffline && avisos.length === 0) return null;

  return (
    <View>
      {avisos.map((aviso) => (
        <View key={aviso.id} style={[styles.franja, styles.exito]} accessibilityRole="alert">
          <Text style={styles.textoExito}>Se publicó "{aviso.titulo}".</Text>

          {aviso.publicacionId && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                descartarAviso(aviso.id);
                navegar('GestionPublicacion', { publicacionId: aviso.publicacionId });
              }}
            >
              <Text style={styles.accion}>Ver</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            onPress={() => descartarAviso(aviso.id)}
          >
            <Text style={styles.accion}>✕</Text>
          </Pressable>
        </View>
      ))}

      {sesionOffline && (
        <View style={[styles.franja, styles.neutro]}>
          <Text style={styles.textoNeutro}>
            Sesión sin validar: estás viendo datos guardados en este dispositivo. Se validará al
            volver la conexión.
          </Text>
        </View>
      )}

      {textoCola && (
        <Pressable
          accessibilityRole="button"
          style={[styles.franja, resumen.conError > 0 ? styles.error : styles.aviso]}
          onPress={() => navegar('PublicacionesPendientes')}
        >
          <Text style={resumen.conError > 0 ? styles.textoError : styles.textoAviso}>
            {textoCola}
          </Text>
          <Text style={styles.accion}>Ver</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  exito: { backgroundColor: '#DCFCE7' },
  neutro: { backgroundColor: '#E5E7EB' },
  aviso: { backgroundColor: '#FEF3C7' },
  error: { backgroundColor: '#FEE2E2' },
  textoExito: { flex: 1, color: '#166534', fontSize: 14 },
  textoNeutro: { flex: 1, color: '#374151', fontSize: 13 },
  textoAviso: { flex: 1, color: '#92400E', fontSize: 14 },
  textoError: { flex: 1, color: '#991B1B', fontSize: 14, fontWeight: '600' },
  accion: { color: '#1D4ED8', fontWeight: 'bold', fontSize: 14 },
});

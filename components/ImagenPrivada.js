import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, API_URL } from '../services/api';

const BASE_URL = API_URL.replace(/\/+$/, '');
const RUTA_PRIVADA = '/uploads/pruebas/';

// Acepta una ruta relativa del backend o una URL absoluta de la propia API
function resolverRuta(ruta) {
  if (!ruta || typeof ruta !== 'string') return null;
  const relativa = ruta.startsWith(BASE_URL) ? ruta.slice(BASE_URL.length) : ruta;
  if (!relativa.startsWith('/uploads/')) return null;
  return { uri: `${BASE_URL}${relativa}`, privada: relativa.startsWith(RUTA_PRIVADA) };
}

/**
 * Imagen que vive en /uploads/pruebas: el backend solo la entrega con el token
 * de la sesión actual, así que se pide con el header Authorization y sin caché.
 * Las imágenes públicas (/uploads/...) se cargan sin enviar credenciales.
 */
export default function ImagenPrivada({
  ruta,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
}) {
  const destino = resolverRuta(ruta);
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setFallo(false);
    setCargando(true);
  }, [ruta, intento]);

  if (!destino) return null;

  const token = api.defaults.headers.common.Authorization;

  if (destino.privada && !token) {
    return (
      <View style={[styles.contenedor, style]}>
        <Text style={styles.error}>Iniciá sesión para ver esta imagen.</Text>
      </View>
    );
  }

  if (fallo) {
    return (
      <View style={[styles.contenedor, style]}>
        <Text style={styles.error}>No pudimos cargar la imagen.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIntento((n) => n + 1)}
        >
          <Text style={styles.reintentar}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const source = destino.privada
    ? {
        uri: destino.uri,
        headers: { Authorization: token },
        // iOS: evita reutilizar una copia en caché; Android no usa este campo
        cache: 'reload',
      }
    : { uri: destino.uri };

  return (
    <View style={[styles.contenedor, style]}>
      <Image
        key={intento}
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        accessibilityLabel={accessibilityLabel}
        onLoadEnd={() => setCargando(false)}
        onError={() => setFallo(true)}
      />
      {cargando && (
        <ActivityIndicator style={StyleSheet.absoluteFill} color="#1D4ED8" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  error: { color: '#991B1B', fontSize: 13, textAlign: 'center', padding: 8 },
  reintentar: { color: '#1D4ED8', fontSize: 13, fontWeight: '600' },
});

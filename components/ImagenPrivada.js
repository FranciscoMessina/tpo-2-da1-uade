import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { api, API_URL } from '../services/api';
import { Boton, Texto, colores, espacio, radios, tonos } from './ui';

const BASE_URL = API_URL.replace(/\/+$/, '');
const RUTA_PRIVADA = '/uploads/pruebas/';
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

// Acepta una ruta relativa del backend o una URL absoluta de la propia API
function resolverRuta(ruta) {
  if (!ruta || typeof ruta !== 'string') return null;
  const relativa = ruta.startsWith(BASE_URL) ? ruta.slice(BASE_URL.length) : ruta;
  if (!relativa.startsWith('/uploads/')) return null;
  return { relativa, uri: `${BASE_URL}${relativa}`, privada: relativa.startsWith(RUTA_PRIVADA) };
}

function aBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const TRAMO = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += TRAMO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  }
  return btoa(binario);
}

function tipoDeImagen(cabecera) {
  const tipo = String(cabecera ?? '').split(';')[0].trim().toLowerCase();
  return TIPOS_IMAGEN.includes(tipo) ? tipo : null;
}

/**
 * Imagen que vive en /uploads/pruebas: el backend solo la entrega con el token de la sesión
 * actual. Se descarga con el mismo cliente HTTP que el resto de la app (que ya envía el token)
 * y se muestra desde memoria: la prueba privada nunca se guarda en el dispositivo.
 * Las imágenes públicas (/uploads/...) las carga `Image` directamente, sin credenciales.
 */
export default function ImagenPrivada({
  ruta,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
}) {
  const destino = resolverRuta(ruta);
  const privada = destino?.privada === true;
  const relativa = destino?.relativa ?? null;
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [uriPrivada, setUriPrivada] = useState(null);

  const hayToken = Boolean(api.defaults.headers.common.Authorization);

  useEffect(() => {
    setFallo(false);
    setCargando(true);
    setUriPrivada(null);

    if (!privada || !hayToken) return undefined;

    let activo = true;
    api
      .get(relativa, { responseType: 'arraybuffer' })
      .then((respuesta) => {
        if (!activo) return;
        const tipo = tipoDeImagen(respuesta.headers?.['content-type']);
        if (!tipo || !respuesta.data?.byteLength) throw new Error('Respuesta que no es una imagen');
        setUriPrivada(`data:${tipo};base64,${aBase64(respuesta.data)}`);
      })
      .catch(() => {
        if (!activo) return;
        setFallo(true);
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [privada, relativa, hayToken, intento]);

  if (!destino) return null;

  if (privada && !hayToken) {
    return (
      <View style={[styles.contenedor, style]}>
        <Texto variante="cuerpoChico" tono="peligro" centrado>
          Iniciá sesión para ver esta imagen.
        </Texto>
      </View>
    );
  }

  if (fallo) {
    return (
      <View style={[styles.contenedor, style]}>
        <Texto variante="cuerpoChico" tono="peligro" centrado>
          No pudimos cargar la imagen.
        </Texto>
        <Boton
          titulo="Reintentar"
          variante="terciario"
          chico
          onPress={() => setIntento((n) => n + 1)}
        />
      </View>
    );
  }

  const uri = privada ? uriPrivada : destino.uri;

  return (
    <View style={[styles.contenedor, style]}>
      {uri && (
        <Image
          key={intento}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          accessibilityLabel={accessibilityLabel}
          onLoadEnd={() => setCargando(false)}
          onError={() => {
            setFallo(true);
            setCargando(false);
          }}
        />
      )}
      {cargando && (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={colores.primario} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: tonos.neutro.fondo,
    borderRadius: radios.chico,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacio.xxs,
    padding: espacio.xs,
  },
});

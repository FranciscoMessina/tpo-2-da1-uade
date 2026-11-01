import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  Fila,
  Icono,
  InsigniaEstado,
  InsigniaTipo,
  Tarjeta,
  Texto,
  Tocable,
  colores,
  espacio,
  iconoCategoria,
  radios,
  tonos,
} from './ui';
import { useConexion } from '../context/ConexionContext';

function Miniatura({ uri = undefined, categoria }) {
  // Se guarda qué foto falló, no un simple "falló": si la publicación cambia de foto, la nueva
  // se intenta sola, y el error tardío de una foto anterior no oculta a la actual.
  const [uriFallida, setUriFallida] = useState(null);
  const { hayConexion } = useConexion();
  const fallo = !!uri && uri === uriFallida;

  // Un único reintento de la misma foto cuando vuelve la conexión. Si falla otra vez, espera
  // a otro corte y reconexión real: no reintenta en cada render. Se ajusta durante el render
  // (patrón de React para derivar estado de una prop que cambia) en lugar de en un efecto.
  const [conexionPrevia, setConexionPrevia] = useState(hayConexion);
  if (conexionPrevia !== hayConexion) {
    setConexionPrevia(hayConexion);
    if (hayConexion) setUriFallida(null);
  }

  if (uri && !fallo) {
    return (
      <Image
        source={{ uri }}
        style={styles.miniatura}
        resizeMode="cover"
        accessibilityLabel={`Foto de ${categoria}`}
        onError={() => setUriFallida(uri)}
      />
    );
  }

  return (
    <View
      style={[styles.miniatura, styles.sinFoto]}
      accessibilityLabel={uri ? 'No se pudo cargar la foto' : `Sin foto de ${categoria}`}
    >
      <Icono
        nombre={uri ? 'image-broken-variant' : iconoCategoria(categoria)}
        tamano={32}
        color={tonos.info.texto}
      />
    </View>
  );
}

// Fecha del suceso de AAAA-MM-DD a DD/MM/AAAA
export function fechaSuceso(fecha) {
  return fecha.split('-').reverse().join('/');
}

/**
 * Publicación en una lista: foto, tipo, título y datos para reconocerla de un vistazo.
 * `children` agrega líneas propias de cada lista; `pie` va fuera del área tocable (acciones).
 */
export default function TarjetaPublicacion({
  publicacion,
  onPress,
  mostrarEstado = false,
  destacada = false,
  accessibilityLabel = undefined,
  children = undefined,
  pie = undefined,
}) {
  return (
    <Tarjeta sinRelleno destacada={destacada}>
      <Tocable
        radio={radios.tarjeta}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={styles.cuerpo}
      >
        <Miniatura uri={publicacion.fotos?.[0]} categoria={publicacion.categoria} />

        <View style={styles.datos}>
          <Fila>
            <InsigniaTipo tipo={publicacion.tipo} />
            {mostrarEstado && <InsigniaEstado estado={publicacion.estado} />}
          </Fila>

          <Texto variante="subtitulo" numberOfLines={2}>{publicacion.titulo}</Texto>

          <Texto variante="cuerpoChico" tono="secundario">
            {publicacion.categoria} · {publicacion.barrio}
          </Texto>

          <Texto variante="cuerpoChico" tono="secundario">
            Fecha del suceso: {fechaSuceso(publicacion.fecha)}
          </Texto>

          {children}
        </View>
      </Tocable>

      {!!pie && <View style={styles.pie}>{pie}</View>}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  cuerpo: {
    flexDirection: 'row',
    gap: espacio.sm,
    padding: espacio.sm,
  },
  miniatura: {
    width: 88,
    height: 88,
    borderRadius: radios.control,
    backgroundColor: colores.primarioSuave,
  },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, gap: espacio.xxs },
  pie: {
    paddingHorizontal: espacio.sm,
    paddingBottom: espacio.sm,
    gap: espacio.xs,
  },
});

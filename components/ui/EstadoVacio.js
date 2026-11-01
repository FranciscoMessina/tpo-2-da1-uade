import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Boton from './Boton';
import Icono from './Icono';
import Texto from './Texto';
import { colores, espacio, estilosPantalla, radios, tonos } from './tema';

// Lista o pantalla sin contenido: explica qué pasa y qué se puede hacer
export function EstadoVacio({
  icono,
  titulo = undefined,
  mensaje = undefined,
  tono = 'info',
  rolMensaje = undefined,
  children = undefined,
}) {
  const { fondo, texto: color } = tonos[tono];

  return (
    <View style={styles.vacio}>
      <View style={[styles.medalla, { backgroundColor: fondo }]}>
        <Icono nombre={icono} tamano={28} color={color} />
      </View>

      {!!titulo && <Texto variante="seccion" centrado>{titulo}</Texto>}
      {!!mensaje && (
        <Texto
          variante="cuerpoChico"
          tono="secundario"
          centrado
          accessibilityRole={rolMensaje}
          style={styles.mensaje}
        >
          {mensaje}
        </Texto>
      )}

      {!!children && <View style={styles.acciones}>{children}</View>}
    </View>
  );
}

export function ErrorConReintento({
  mensaje,
  titulo = undefined,
  onReintentar,
  textoReintentar = 'Reintentar',
}) {
  return (
    <EstadoVacio
      icono="alert-circle-outline"
      tono="peligro"
      titulo={titulo}
      mensaje={mensaje}
      rolMensaje="alert"
    >
      <Boton titulo={textoReintentar} variante="secundario" icono="refresh" onPress={onReintentar} />
    </EstadoVacio>
  );
}

export function Cargando({ etiqueta = undefined, pantalla = false, chico = false }) {
  return (
    <View style={pantalla ? estilosPantalla.centrado : styles.cargando}>
      <ActivityIndicator
        size={chico ? 'small' : 'large'}
        color={colores.primario}
        accessibilityLabel={etiqueta ?? 'Cargando'}
      />
      {!!etiqueta && <Texto variante="cuerpoChico" tono="secundario" centrado>{etiqueta}</Texto>}
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: {
    alignItems: 'center',
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.xl,
    gap: espacio.xs,
  },
  medalla: {
    width: 56,
    height: 56,
    borderRadius: radios.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xxs,
  },
  mensaje: { maxWidth: 320 },
  acciones: { alignSelf: 'stretch', gap: espacio.xs, marginTop: espacio.xs },
  cargando: {
    alignItems: 'center',
    paddingVertical: espacio.lg,
    gap: espacio.xs,
  },
});

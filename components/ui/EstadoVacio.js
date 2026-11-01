import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { motivoSinConexion } from '../../services/api';
import { ICONOS_CONEXION } from './Aviso';
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

const TITULOS_CONEXION = { internet: 'Sin conexión a internet', servidor: 'Servidor no disponible' };

export function ErrorConReintento({
  mensaje,
  titulo = undefined,
  onReintentar,
  textoReintentar = 'Reintentar',
}) {
  const motivo = motivoSinConexion(mensaje);

  return (
    <EstadoVacio
      icono={motivo ? ICONOS_CONEXION[motivo] : 'alert-circle-outline'}
      tono={motivo ? 'aviso' : 'peligro'}
      titulo={titulo ?? TITULOS_CONEXION[motivo]}
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

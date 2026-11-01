import { StyleSheet, View } from 'react-native';
import Icono from './Icono';
import Texto from './Texto';
import Tocable from './Tocable';
import { esMensajeSinConexion } from '../../services/api';
import { espacio, radios, tonos } from './tema';

const ICONOS = {
  neutro: 'information-outline',
  info: 'information-outline',
  exito: 'check-circle-outline',
  aviso: 'alert-outline',
  peligro: 'alert-circle-outline',
};

/**
 * Mensaje de estado dentro del contenido: errores, confirmaciones y estado de un trámite.
 * `accion` ({ titulo, onPress, disabled }) agrega un botón de texto.
 */
export function Aviso({
  tono = 'info',
  titulo = undefined,
  mensaje = undefined,
  children = undefined,
  icono = undefined,
  accion = undefined,
  accessibilityRole = undefined,
  style = undefined,
}) {
  // Un error por falta de conexión no es una falla de la persona ni de la app: tono de aviso
  const sinConexion = tono === 'peligro' && esMensajeSinConexion(mensaje);
  const { fondo, texto: color } = tonos[sinConexion ? 'aviso' : tono];

  return (
    <View
      accessible={Boolean(accessibilityRole) && !accion}
      accessibilityRole={accessibilityRole}
      style={[styles.aviso, { backgroundColor: fondo }, style]}
    >
      <Icono
        nombre={icono ?? (sinConexion ? 'wifi-off' : ICONOS[tono])}
        tamano={20}
        color={color}
      />

      <View style={styles.cuerpo}>
        {!!titulo && <Texto variante="etiqueta" style={{ color }}>{titulo}</Texto>}
        {!!mensaje && <Texto variante="cuerpoChico" style={{ color }}>{mensaje}</Texto>}
        {children}

        {!!accion && (
          <Tocable
            radio={radios.chico}
            onPress={accion.onPress}
            disabled={accion.disabled}
            hitSlop={8}
            estiloContenedor={styles.accion}
            style={styles.accionInterior}
          >
            <Texto variante="etiqueta" style={[styles.accionTexto, { color }]}>
              {accion.titulo}
            </Texto>
          </Tocable>
        )}
      </View>
    </View>
  );
}

export function AvisoSinConexion({
  titulo = 'Modo sin conexión',
  mensaje = undefined,
  children = undefined,
  accion = undefined,
  style = undefined,
}) {
  return (
    <Aviso tono="aviso" icono="wifi-off" titulo={titulo} mensaje={mensaje} accion={accion} style={style}>
      {children}
    </Aviso>
  );
}

// Explica debajo de un botón por qué está deshabilitado sin conexión
export function NotaSinConexion({ children }) {
  return (
    <View style={styles.nota}>
      <Icono nombre="wifi-off" tamano={16} color={tonos.aviso.texto} style={styles.notaIcono} />
      <Texto variante="cuerpoChico" tono="aviso" style={styles.notaTexto}>{children}</Texto>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    gap: espacio.sm,
    padding: espacio.sm,
    borderRadius: radios.control,
  },
  cuerpo: { flex: 1, gap: espacio.xxs },
  accion: { alignSelf: 'flex-start', marginTop: espacio.xxs },
  accionInterior: { paddingVertical: espacio.xxs },
  accionTexto: { textDecorationLine: 'underline' },
  nota: { flexDirection: 'row', gap: espacio.xs },
  notaIcono: { marginTop: 2 },
  notaTexto: { flex: 1 },
});

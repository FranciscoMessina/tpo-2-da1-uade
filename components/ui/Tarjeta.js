import { StyleSheet, View } from 'react-native';
import Texto from './Texto';
import { colores, espacio, radios } from './tema';

export function Tarjeta({ children, destacada = false, sinRelleno = false, style = undefined }) {
  return (
    <View
      style={[
        styles.tarjeta,
        sinRelleno && styles.sinRelleno,
        destacada && styles.destacada,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Tarjeta con título: el bloque básico de formularios y detalles
export function Seccion({ titulo, descripcion = undefined, children = undefined, style = undefined }) {
  return (
    <Tarjeta style={style}>
      <View style={styles.encabezado}>
        <Texto variante="seccion">{titulo}</Texto>
        {!!descripcion && (
          <Texto variante="cuerpoChico" tono="secundario">{descripcion}</Texto>
        )}
      </View>
      {children}
    </Tarjeta>
  );
}

// Grupo de contenido dentro de una tarjeta, sin anidar otra tarjeta blanca
export function Panel({ children, style = undefined }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Separador({ style = undefined }) {
  return <View style={[styles.separador, style]} />;
}

// Fila de elementos que pasa a la línea siguiente si no entran
export function Fila({ children, style = undefined }) {
  return <View style={[styles.fila, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radios.tarjeta,
    padding: espacio.md,
    gap: espacio.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sinRelleno: { padding: 0, gap: 0, overflow: 'hidden' },
  destacada: { borderColor: colores.primario },
  encabezado: { gap: espacio.xxs },
  panel: {
    backgroundColor: colores.superficieHundida,
    borderRadius: radios.control,
    padding: espacio.sm,
    gap: espacio.xs,
  },
  separador: { height: 1, backgroundColor: colores.borde },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacio.xs,
  },
});

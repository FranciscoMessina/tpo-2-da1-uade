import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useConexion } from '../../context/ConexionContext';
import { NotaSinConexion } from './Aviso';
import Icono from './Icono';
import Texto from './Texto';
import Tocable from './Tocable';
import { alturaControl, colores, espacio, radios, tonos } from './tema';

const VARIANTES = {
  // La acción principal de la vista: una sola por grupo
  primario: {
    fondo: colores.primario,
    contenido: colores.textoInverso,
    onda: colores.ondaInversa,
  },
  secundario: {
    fondo: colores.primarioSuave,
    contenido: tonos.info.texto,
    onda: colores.onda,
  },
  terciario: {
    fondo: 'transparent',
    contenido: colores.primario,
    onda: colores.onda,
  },
  // Acciones que borran, rechazan o cierran algo
  peligro: {
    fondo: tonos.peligro.fondo,
    contenido: tonos.peligro.texto,
    onda: colores.onda,
  },
};

/**
 * Botón de la app.
 * - variante: primario | secundario | terciario | peligro.
 * - chico: versión compacta para filas de acciones; el área táctil sigue siendo de 48 dp.
 * - cargando: muestra el indicador y bloquea el toque. El texto lo decide la pantalla
 *   («Guardando…»), así el lector de pantalla también lo anuncia.
 * - flexible: reparte el ancho de su fila con los botones vecinos.
 * - ajustado: ocupa solo lo que necesita su texto.
 * - requiereConexion: la acción no existe sin el backend. Sin conexión el botón queda bloqueado
 *   y, si hay notaSinConexion, la explica debajo (solo en disposiciones en columna).
 */
export default function Boton({
  titulo,
  onPress,
  variante = 'primario',
  chico = false,
  icono = undefined,
  cargando = false,
  disabled = false,
  flexible = false,
  ajustado = false,
  accessibilityLabel = undefined,
  estilo = undefined,
  requiereConexion = false,
  notaSinConexion = undefined,
}) {
  const { hayConexion } = useConexion();
  const sinConexion = requiereConexion && !hayConexion;
  const inactivo = disabled || cargando || sinConexion;
  const base = VARIANTES[variante];
  const transparente = variante === 'terciario';
  const fondo = inactivo && !transparente ? colores.deshabilitado : base.fondo;
  const contenido = inactivo ? colores.textoTenue : base.contenido;

  const boton = (
    <Tocable
      onPress={onPress}
      disabled={inactivo}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: cargando }}
      colorOnda={base.onda}
      hitSlop={chico ? 4 : undefined}
      estiloContenedor={[
        flexible && styles.flexible,
        ajustado && styles.ajustado,
        ajustado && transparente && styles.alineado,
        estilo,
      ]}
      style={[styles.boton, chico && styles.chico, { backgroundColor: fondo }]}
    >
      <View style={styles.fila}>
        {cargando ? (
          <ActivityIndicator size="small" color={contenido} />
        ) : (
          !!icono && <Icono nombre={icono} tamano={18} color={contenido} />
        )}
        <Texto variante="boton" centrado style={[styles.titulo, { color: contenido }]}>
          {titulo}
        </Texto>
      </View>
    </Tocable>
  );

  if (!sinConexion || !notaSinConexion) return boton;

  return (
    <>
      {boton}
      <NotaSinConexion>{notaSinConexion}</NotaSinConexion>
    </>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: alturaControl,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.xs,
    borderRadius: radios.control,
    justifyContent: 'center',
  },
  chico: {
    minHeight: 40,
    paddingHorizontal: espacio.sm,
    paddingVertical: 6,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
  },
  titulo: { flexShrink: 1 },
  flexible: { flex: 1 },
  ajustado: { alignSelf: 'flex-start' },
  // El texto del botón sin fondo se alinea con el contenido que tiene arriba
  alineado: { marginLeft: -espacio.sm },
});
